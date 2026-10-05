/**
 * @file src/services/webAnalytics.service.ts
 * @description 방문·유입 집계 보관·조회 — WEB-O1
 *
 * 기준: 10_WEB_ANALYTICS_PLAN.md §5 (web-analytics.v1), 마이그 062
 *
 * ★ 이 서비스가 지키는 것
 *  - GA 관측 블록과 내부 주문 유입 블록을 **섞지 않는다.** 타입부터 분리한다.
 *  - 모르는 값은 0이 아니라 `Measure{known:false}` 로 올린다(계약 §5 와 같은 규칙).
 *  - 연결률은 분모(웹 결제 주문)가 0/미상이면 **null**. 구매 전환율이라고 부르지 않는다.
 *  - 수집 시작일 이전 기간은 '수집 전' 이다. 0으로 채우지 않는다.
 *  - 운영 조회 기본값은 production+operational. 검증용이 운영 집계에 섞이지 않는다.
 *  - 정정은 새 revision 으로 들어오고, 조회는 기간별 **최신 revision** 만 읽는다.
 *
 * ⚠️ 모델 API 를 호출하지 않는다(D-007). 수집용 외부 API 호출도 일반 코드다.
 */
import { supabase } from './supabase';
import { Measure } from '../contracts/projection';

export type Freshness = 'provisional' | 'rechecked';

export interface SourceRow { sourceMedium: string; sessions: number; campaign?: string; content?: string }
export interface EventRow { eventName: string; count: number }

/** 화면이 쓰는 모양 — GA 블록과 주문 블록이 분리되어 있다 */
export interface WebAnalyticsRecord {
  id: string;
  environment: string;
  usage: string;
  periodStart: string;
  periodEnd: string;
  revision: number;
  freshness: Freshness;
  observedAt: string;
  sourceDataThrough: string | null;
  collectionStartedAt: string | null;

  // ── GA 관측 블록 ──
  totalUsers: Measure;
  sessions: Measure;
  pageViews: Measure;
  sources: SourceRow[];
  events: EventRow[];

  // ── 내부 주문 블록 (금액·주문 수는 시목 원장 기준) ──
  webPaidOrders: Measure;
  attributedOrders: Measure;
  /** 주문 유입 연결률(%) — 구매 전환율이 아니다. 분모 0/미상이면 null */
  attributionRate: Measure | null;
  attributionModel: string | null;

  limitations: string[];
}

interface Row {
  id: string;
  workspace_id: string;
  environment: string;
  usage: string;
  period_start: string;
  period_end: string;
  query_version: string;
  revision: number;
  freshness: Freshness;
  observed_at: string;
  source_data_through: string | null;
  collection_started_at: string | null;
  ga_metrics: Record<string, unknown> | null;
  ga_breakdown: Record<string, unknown> | null;
  order_metrics: Record<string, unknown> | null;
  attribution: Record<string, unknown> | null;
  quality: Record<string, unknown> | null;
  limitations: string[] | null;
}

export const QUERY_VERSION = 'web-analytics.v1';
/** 10 문서 §5: from/to 는 KST 양끝 포함, 최대 31일 */
export const MAX_RANGE_DAYS = 31;

/**
 * 숫자를 Measure 로. 블록 quality 가 complete 가 아니면 값이 있어도 믿지 않는다.
 * (원천이 잘못 보내도 화면이 숫자를 그리지 않게 하는 방어)
 */
function measureOf(
  block: Record<string, unknown> | null,
  key: string,
  quality: Record<string, unknown> | null,
  qualityPath: string,
): Measure {
  const q = (quality?.[qualityPath] as Record<string, { status?: string; reason?: string }> | undefined)?.[key];
  const status = q?.status;
  const raw = block?.[key];
  const value = typeof raw === 'number' && Number.isSafeInteger(raw) ? raw : null;
  if (value !== null && (status === undefined || status === 'complete')) return { known: true, value };
  return {
    known: false,
    status: status === 'missing' ? 'missing' : 'partial',
    reason: q?.reason ?? '수집되지 않았어요',
  };
}

function toRecord(r: Row): WebAnalyticsRecord {
  const ga = r.ga_metrics ?? null;
  const om = r.order_metrics ?? null;
  const web = measureOf(om, 'webPaidOrders', r.quality, 'order');
  const attributed = measureOf(om, 'attributedOrders', r.quality, 'order');

  // 연결률: 분자·분모 **둘 다** 알려졌고 분모가 0보다 클 때만 계산한다 (10 문서 §5)
  let rate: Measure | null = null;
  if (web.known && attributed.known) {
    rate = web.value > 0
      ? { known: true, value: Math.round((attributed.value / web.value) * 1000) / 10 }
      : { known: false, status: 'partial', reason: '웹 결제 주문이 0이라 연결률을 만들지 않아요' };
  } else {
    rate = { known: false, status: 'partial', reason: '주문 수가 확인되지 않아 연결률을 계산하지 않아요' };
  }

  const bd = r.ga_breakdown ?? {};
  return {
    id: r.id,
    environment: r.environment,
    usage: r.usage,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    revision: r.revision,
    freshness: r.freshness,
    observedAt: r.observed_at,
    sourceDataThrough: r.source_data_through,
    collectionStartedAt: r.collection_started_at,

    totalUsers: measureOf(ga, 'totalUsers', r.quality, 'ga'),
    sessions: measureOf(ga, 'sessions', r.quality, 'ga'),
    pageViews: measureOf(ga, 'screenPageViews', r.quality, 'ga'),
    sources: Array.isArray(bd.sources) ? (bd.sources as SourceRow[]) : [],
    events: Array.isArray(bd.events) ? (bd.events as EventRow[]) : [],

    webPaidOrders: web,
    attributedOrders: attributed,
    attributionRate: rate,
    attributionModel: typeof r.attribution?.model === 'string' ? (r.attribution.model as string) : null,

    limitations: r.limitations ?? [],
  };
}

export interface WebReadOptions { environment?: string; usage?: string }

/**
 * 기간에 걸친 집계 레코드. 기본은 운영 조합(production+operational).
 * 같은 기간이 여러 revision 으로 있으면 **최신만** 돌려준다.
 */
export async function fetchWebAnalytics(
  workspaceId: string, fromDate: string, toDate: string, opts: WebReadOptions = {},
): Promise<WebAnalyticsRecord[]> {
  const o = { environment: 'production', usage: 'operational', ...opts };
  const { data, error } = await supabase
    .from('web_analytics')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('environment', o.environment)
    .eq('usage', o.usage)
    .eq('query_version', QUERY_VERSION)
    .gte('period_start', fromDate)
    .lte('period_end', toDate)
    .order('period_end', { ascending: false }) as unknown as { data: Row[] | null; error: unknown };
  if (error) throw error;

  // (기간, query_version) 당 최신 revision
  const best = new Map<string, Row>();
  for (const r of data ?? []) {
    const k = `${r.period_start}__${r.period_end}`;
    const cur = best.get(k);
    if (!cur || r.revision > cur.revision) best.set(k, r);
  }
  return [...best.values()]
    .sort((a, b) => (a.period_end < b.period_end ? 1 : -1))
    .map(toRecord);
}

/** 기간 길이 검증 (10 문서 §5: 최대 31일) */
export function assertRange(fromDate: string, toDate: string): void {
  const a = Date.parse(`${fromDate}T00:00:00Z`);
  const b = Date.parse(`${toDate}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('기간 형식이 잘못되었어요 (YYYY-MM-DD)');
  if (b < a) throw new Error('종료일이 시작일보다 앞설 수 없어요');
  const days = Math.round((b - a) / 86400000) + 1;
  if (days > MAX_RANGE_DAYS) throw new Error(`한 번에 ${MAX_RANGE_DAYS}일까지만 조회할 수 있어요 (요청 ${days}일)`);
}

/**
 * 집계 레코드 저장(import). 정정은 **새 revision** 으로 넣는다 — 기존 행을 고치지 않는다.
 * 같은 (scope, 기간, query_version, revision) 이 이미 있으면 UNIQUE 로 거절된다.
 */
export async function saveWebAnalytics(workspaceId: string, payload: {
  environment: string; usage: string;
  periodStart: string; periodEnd: string;
  revision?: number;
  freshness?: Freshness;
  observedAt: string;
  sourceDataThrough?: string | null;
  collectionStartedAt?: string | null;
  sourceRef?: string | null;
  rawSha256?: string | null;
  gaMetrics?: unknown; gaBreakdown?: unknown; orderMetrics?: unknown;
  attribution?: unknown; quality?: unknown; limitations?: string[];
}): Promise<string> {
  assertRange(payload.periodStart, payload.periodEnd);
  if (payload.environment !== 'production' && payload.usage !== 'validation') {
    throw new Error('production 이 아니면 usage 는 validation 이어야 해요');
  }
  const { data, error } = await supabase.from('web_analytics').insert({
    workspace_id: workspaceId,
    environment: payload.environment,
    usage: payload.usage,
    period_start: payload.periodStart,
    period_end: payload.periodEnd,
    query_version: QUERY_VERSION,
    revision: payload.revision ?? 1,
    freshness: payload.freshness ?? 'provisional',
    observed_at: payload.observedAt,
    source_data_through: payload.sourceDataThrough ?? null,
    collection_started_at: payload.collectionStartedAt ?? null,
    source_ref: payload.sourceRef ?? null,
    raw_sha256: payload.rawSha256 ?? null,
    ga_metrics: payload.gaMetrics ?? null,
    ga_breakdown: payload.gaBreakdown ?? null,
    order_metrics: payload.orderMetrics ?? null,
    attribution: payload.attribution ?? null,
    quality: payload.quality ?? null,
    limitations: payload.limitations ?? null,
  }).select('id').single() as unknown as { data: { id: string } | null; error: unknown };
  if (error) throw error;
  return data!.id;
}
