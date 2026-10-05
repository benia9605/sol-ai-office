/**
 * @file src/services/sourceSnapshots.service.ts
 * @description 하루 snapshot 수신·영속·조회 (계약 0.2.0 §7) — GPT-R1-O2 / INT-004
 *
 * - 원문(raw_body)·수신 bytes 해시(raw_sha256)·내용 digest(content_digest)를 보존한다.
 * - scope = (workspace, source_system, environment, usage, business_date, schema_version).
 * - revision 규칙: 같은 scope+revision 은 같은 bytes → 기존 결과 재사용(200).
 *   같은 scope+revision 에 다른 bytes → 409 충돌. 낮은 revision 이 늦게 와도 latest 를 되돌리지 않는다.
 * - 같은 내용(content_digest 동일)이 관찰 시각만 달라져 오면 새 revision 을 만들지 않고
 *   source_snapshot_latest.last_confirmed_at 만 올린다(원문 행은 immutable · 마이그 061).
 * - 실패는 source_ingest_errors 에 남긴다. 빈 배열·0 매출로 바꾸지 않는다(계약 §8).
 *
 * ⚠️ 모델 API 를 호출하지 않는다(D-007). 이 파일은 provider client 를 import 하지 않는다.
 * 마이그레이션: 060_simok_contract_guards.sql + 061_snapshot_last_confirmed.sql.
 * Mock 동기화: mockSupabase.ts source_snapshots / source_snapshot_latest.
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import {
  DailySnapshot, SnapshotScope, ContractError, SCHEMA_VERSION,
  parseSnapshotText, validateSnapshot, contentDigest, sha256Hex,
} from '../contracts/dailySnapshot';
import { SnapshotProjection, projectSnapshot } from '../contracts/projection';

/** 수신 결과 — 계약 §7.7: 첫 저장 201 / 중복 200 의 의미를 코드로 구별한다. */
export type IngestOutcome =
  | { status: 'created'; snapshotPk: string; revision: number; rawSha256: string }
  | { status: 'duplicate'; snapshotPk: string; revision: number; rawSha256: string }
  | { status: 'unchanged_content'; snapshotPk: string; revision: number; rawSha256: string }
  | { status: 'superseded'; latestRevision: number; receivedRevision: number }
  | { status: 'conflict'; revision: number; existingSha256: string; receivedSha256: string };

export interface SnapshotRow {
  id: string;
  workspace_id: string;
  source_system: string;
  environment: string;
  usage: string;
  business_date: string;
  schema_version: string;
  revision: number;
  snapshot_id: string;
  raw_body: DailySnapshot;
  raw_sha256: string;
  content_digest: string;
  generated_at: string;
  source_updated_at: string | null;
  received_at: string;
  /** 수신 시점 값으로 고정(이 테이블은 immutable). 재확인 시각은 source_snapshot_latest.last_confirmed_at */
  last_seen_at: string;
  quality: unknown;
}

function scopeOf(workspaceId: string, s: DailySnapshot): SnapshotScope {
  return {
    workspaceId,
    sourceSystem: s.source_system,
    environment: s.environment,
    usage: s.usage,
    businessDate: s.business_date,
    schemaVersion: s.schema_version,
  };
}

/** scope 6개 컬럼을 그대로 eq 체이닝. 계약 §7: 정확한 schema_version 으로 건다(major 만으로 섞지 않는다). */
interface Eqable { eq(column: string, value: unknown): Eqable }

function scopeFilter<T extends Eqable>(q: T, sc: SnapshotScope): Eqable {
  return (q as Eqable)
    .eq('workspace_id', sc.workspaceId)
    .eq('source_system', sc.sourceSystem)
    .eq('environment', sc.environment)
    .eq('usage', sc.usage)
    .eq('business_date', sc.businessDate)
    .eq('schema_version', sc.schemaVersion);
}

/** quality 요약 — 연결 상태 화면이 상세 원문을 열지 않고도 읽을 수 있게 */
function qualitySummary(s: DailySnapshot) {
  return {
    commerce_channel_coverage: s.commerce.channel_coverage.status,
    commerce_totals: s.commerce.totals.quality.status,
    by_channel: s.commerce.by_channel.map(c => ({ channel_id: c.channel_id, status: c.quality.status })),
    products_coverage: s.products.coverage.status,
    inventory_coverage: s.inventory.coverage.status,
    traffic: s.traffic.quality.status,
  };
}

/** 실패 기록 (계약 §8) — 호출자가 에러를 삼키더라도 원장에는 남는다 */
export async function recordIngestError(args: {
  workspaceId: string; sourceSystem?: string; businessDate?: string;
  environment?: string; usage?: string;
  code: string; message: string; retryable?: boolean; rawSha256?: string;
}): Promise<void> {
  const traceId = crypto.randomUUID();
  try {
    await supabase.from('source_ingest_errors').insert({
      workspace_id: args.workspaceId,
      source_system: args.sourceSystem ?? null,
      business_date: args.businessDate ?? null,
      environment: args.environment ?? null,
      usage: args.usage ?? null,
      code: args.code,
      message: args.message,
      retryable: args.retryable ?? false,
      trace_id: traceId,
      raw_sha256: args.rawSha256 ?? null,
    });
  } catch {
    // 오류 기록 실패가 본래 오류를 가리지 않게 한다.
    console.warn('[sourceSnapshots] 오류 기록 실패', args.code, traceId);
  }
}

/**
 * 검증된 snapshot 을 영속 저장한다. workspace 는 **호출자가 정한 값이 아니라** 서버/연결이 정한 값이어야 한다.
 * (브라우저 수동 import 경로에서는 RLS 가 멤버십을 보장한다 — 계약 §2.)
 */
export async function ingestSnapshot(
  workspaceId: string,
  snapshot: DailySnapshot,
  rawSha256: string,
): Promise<IngestOutcome> {
  const sc = scopeOf(workspaceId, snapshot);
  const digest = await contentDigest(snapshot);

  // 같은 scope 의 기존 행을 모두 본다(혹시 r2 가 이미 있는지, 같은 revision 이 있는지).
  const { data, error } = await (scopeFilter(
    supabase.from('source_snapshots').select('id, revision, raw_sha256, content_digest') as unknown as Eqable,
    sc,
  ) as unknown as { order: (c: string, o: { ascending: boolean }) => Promise<unknown> })
    .order('revision', { ascending: false }) as unknown as {
    data: { id: string; revision: number; raw_sha256: string; content_digest: string }[] | null;
    error: unknown;
  };
  if (error) throw error;
  const existing = data ?? [];

  const sameRevision = existing.find(r => r.revision === snapshot.revision);
  if (sameRevision) {
    // 계약 §7.5: 같은 key + 같은 bytes → 기존 결과. 같은 key + 다른 bytes → 409.
    if (sameRevision.raw_sha256 === rawSha256) {
      return { status: 'duplicate', snapshotPk: sameRevision.id, revision: snapshot.revision, rawSha256 };
    }
    await recordIngestError({
      workspaceId, sourceSystem: sc.sourceSystem, businessDate: sc.businessDate,
      environment: sc.environment, usage: sc.usage,
      code: 'conflict',
      message: `같은 revision(${snapshot.revision})에 다른 본문이 도착했습니다. 의도한 수정은 새 revision 으로 보내야 합니다.`,
      rawSha256,
    });
    return {
      status: 'conflict', revision: snapshot.revision,
      existingSha256: sameRevision.raw_sha256, receivedSha256: rawSha256,
    };
  }

  const latest = existing[0];
  // 계약 §7.5: 낮은 revision 이 늦게 도착해도 latest pointer 를 내리지 않는다.
  if (latest && snapshot.revision < latest.revision) {
    // 원문은 보존 가치가 있으므로 저장하되 pointer 는 건드리지 않는다.
    await insertRow(workspaceId, snapshot, rawSha256, digest);
    return { status: 'superseded', latestRevision: latest.revision, receivedRevision: snapshot.revision };
  }

  // 계약 §7.2·§7.3: 내용이 그대로인데 관찰 시각만 달라진 재전송은 새 revision 사유가 아니다.
  // ★ 재확인 시각은 **원문 행이 아니라** 쓰기 가능한 pointer 에 쓴다.
  //   source_snapshots 는 immutable(SELECT+INSERT 정책만)이라 UPDATE 가 RLS 에 조용히 막힌다.
  //   계약 §7.3 "마지막 재확인 시각은 별도 운영 메타데이터에 저장한다" 도 같은 요구다. (마이그 061)
  if (latest && latest.content_digest === digest) {
    await touchLatestConfirmed(sc);
    return { status: 'unchanged_content', snapshotPk: latest.id, revision: latest.revision, rawSha256 };
  }

  const pk = await insertRow(workspaceId, snapshot, rawSha256, digest);
  await upsertLatest(sc, snapshot.revision, pk);
  return { status: 'created', snapshotPk: pk, revision: snapshot.revision, rawSha256 };
}

async function insertRow(
  workspaceId: string, s: DailySnapshot, rawSha256: string, digest: string,
): Promise<string> {
  const userId = await getCurrentUserId().catch(() => null);
  const { data, error } = await supabase.from('source_snapshots').insert({
    workspace_id: workspaceId,
    source_system: s.source_system,
    environment: s.environment,
    usage: s.usage,
    business_date: s.business_date,
    schema_version: s.schema_version,
    revision: s.revision,
    snapshot_id: s.snapshot_id,
    raw_body: s,
    raw_sha256: rawSha256,
    content_digest: digest,
    generated_at: s.generated_at,
    source_updated_at: s.source_updated_at,
    quality: qualitySummary(s),
    created_by: userId,
  }).select('id').single() as unknown as { data: { id: string } | null; error: unknown };
  if (error) throw error;
  return data!.id;
}

async function upsertLatest(sc: SnapshotScope, revision: number, snapshotPk: string): Promise<void> {
  const row = {
    workspace_id: sc.workspaceId,
    source_system: sc.sourceSystem,
    environment: sc.environment,
    usage: sc.usage,
    business_date: sc.businessDate,
    schema_version: sc.schemaVersion,
    revision,
    snapshot_pk: snapshotPk,
    updated_at: new Date().toISOString(),
  };
  // 존재 여부를 보고 update/insert 로 나눈다 (mock/real 공통 — MockQueryBuilder 는 onConflict 미지원)
  const { data: found } = await (scopeFilter(
    supabase.from('source_snapshot_latest').select('revision') as unknown as Eqable, sc,
  ) as unknown as { limit: (n: number) => Promise<unknown> })
    .limit(1) as unknown as { data: { revision: number }[] | null };

  if (found && found.length > 0) {
    if (found[0].revision >= revision) return; // 되돌리지 않는다
    const { error } = await scopeFilter(
      supabase.from('source_snapshot_latest').update(row) as unknown as Eqable, sc,
    ) as unknown as { error: unknown };
    if (error) throw error;
  } else {
    const { error } = await supabase.from('source_snapshot_latest').insert(row) as unknown as { error: unknown };
    if (error) throw error;
  }
}

/**
 * 같은 내용을 다시 확인했을 때 pointer 의 재확인 시각만 올린다(마이그 061).
 * 실패해도 수신 자체는 성공으로 둔다 — 운영 메타데이터이고 원문·revision 에는 영향이 없다.
 */
async function touchLatestConfirmed(sc: SnapshotScope): Promise<void> {
  try {
    const { error } = await scopeFilter(
      supabase.from('source_snapshot_latest')
        .update({ last_confirmed_at: new Date().toISOString() }) as unknown as Eqable,
      sc,
    ) as unknown as { error: unknown };
    if (error) throw error;
  } catch {
    console.warn('[sourceSnapshots] 재확인 시각 기록 실패 (수신 결과에는 영향 없음)');
  }
}

/**
 * 파일(JSON 텍스트)로 수동 import. O1/O2 의 첫 왕복 경로.
 * 검증 실패는 저장하지 않고 오류 원장에 남긴다.
 */
export async function importSnapshotText(
  workspaceId: string, text: string,
): Promise<IngestOutcome> {
  let snapshot: DailySnapshot;
  let rawSha256: string;
  try {
    const parsed = parseSnapshotText(text);
    snapshot = parsed.snapshot;
    rawSha256 = await parsed.rawSha256;
  } catch (e) {
    const err = e instanceof ContractError ? e : new ContractError(String((e as Error)?.message ?? e));
    await recordIngestError({
      workspaceId, code: err.code, message: err.message,
      rawSha256: await sha256Hex(text).catch(() => undefined) as string | undefined,
    });
    throw err;
  }
  return ingestSnapshot(workspaceId, snapshot, rawSha256);
}

/** 운영 조회는 production+operational 만 (계약 §2) */
export interface ReadOptions {
  environment?: DailySnapshot['environment'];
  usage?: DailySnapshot['usage'];
  sourceSystem?: string;
  schemaVersion?: string;
}

const OPERATIONAL: Required<Pick<ReadOptions, 'environment' | 'usage'>> = {
  environment: 'production', usage: 'operational',
};

/**
 * 날짜 범위의 **최신 revision** projection 을 읽는다.
 * 기본값은 운영 조합(production+operational) — 검증 자료가 운영 집계에 섞이지 않게 한다.
 */
export async function fetchSnapshotProjections(
  workspaceId: string,
  fromDate: string,
  toDate: string,
  opts: ReadOptions = {},
): Promise<SnapshotProjection[]> {
  const o = { ...OPERATIONAL, ...opts };
  let q = supabase.from('source_snapshots')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('environment', o.environment)
    .eq('usage', o.usage)
    .gte('business_date', fromDate)
    .lte('business_date', toDate);
  if (o.sourceSystem) q = q.eq('source_system', o.sourceSystem);
  q = q.eq('schema_version', o.schemaVersion ?? SCHEMA_VERSION);

  const { data, error } = await q.order('business_date', { ascending: false }) as unknown as {
    data: SnapshotRow[] | null; error: unknown;
  };
  if (error) throw error;

  // 날짜별 최신 revision 만 (계약 §7.5 — 합계는 덧셈이 아니라 최신 revision 에서 읽는다)
  const best = new Map<string, SnapshotRow>();
  for (const r of data ?? []) {
    const cur = best.get(r.business_date);
    if (!cur || r.revision > cur.revision) best.set(r.business_date, r);
  }
  return [...best.values()]
    .sort((a, b) => (a.business_date < b.business_date ? 1 : -1))
    .map(r => projectSnapshot(validateSnapshot(r.raw_body)));
}

/** 하루 조회 (latest revision) */
export async function fetchSnapshotProjection(
  workspaceId: string, businessDate: string, opts: ReadOptions = {},
): Promise<SnapshotProjection | null> {
  const list = await fetchSnapshotProjections(workspaceId, businessDate, businessDate, opts);
  return list[0] ?? null;
}

/** 연결 상태 화면: 최근 수신·실패 요약 */
export interface ConnectionHealth {
  lastReceivedAt: string | null;
  lastBusinessDate: string | null;
  lastRevision: number | null;
  recentErrors: { code: string; message: string; retryable: boolean; createdAt: string }[];
}

export async function fetchConnectionHealth(
  workspaceId: string, opts: ReadOptions = {},
): Promise<ConnectionHealth> {
  const o = { ...OPERATIONAL, ...opts };
  const [{ data: snaps }, { data: errs }] = await Promise.all([
    supabase.from('source_snapshots')
      .select('received_at, business_date, revision')
      .eq('workspace_id', workspaceId)
      .eq('environment', o.environment)
      .eq('usage', o.usage)
      .order('received_at', { ascending: false })
      .limit(1) as unknown as Promise<{ data: { received_at: string; business_date: string; revision: number }[] | null }>,
    supabase.from('source_ingest_errors')
      .select('code, message, retryable, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(5) as unknown as Promise<{ data: { code: string; message: string; retryable: boolean; created_at: string }[] | null }>,
  ]);
  const top = snaps?.[0];
  return {
    lastReceivedAt: top?.received_at ?? null,
    lastBusinessDate: top?.business_date ?? null,
    lastRevision: top?.revision ?? null,
    recentErrors: (errs ?? []).map(e => ({
      code: e.code, message: e.message, retryable: e.retryable, createdAt: e.created_at,
    })),
  };
}
