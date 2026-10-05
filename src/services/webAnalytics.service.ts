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
import {
  WebAnalyticsV1, WEB_ANALYTICS_VERSION, validateWebAnalyticsV1, toStorageRow,
} from '../contracts/webAnalyticsV1';
import { sha256Hex, ContractError } from '../contracts/dailySnapshot';

export type Freshness = 'provisional' | 'rechecked';

export interface SourceRow { sourceMedium: string; sessions: number }
export interface EventRow { eventName: string; count: number }
export interface AttributionBreakdown {
  source: string; medium: string; campaign: string | null; content: string | null;
  orders: number; merchandise_captured_krw: number | null; shipping_captured_krw: number | null;
}

/** 화면이 쓰는 모양 — GA 블록과 주문 블록이 분리되어 있다 */
export interface WebAnalyticsRecord {
  id: string;
  sourceSystem: string;
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
  /** GA 블록 자체의 상태 — 왜 비어 있는지 화면이 설명할 수 있게 */
  gaStatus: 'complete' | 'partial' | 'missing';
  gaReason: string | null;
  sources: SourceRow[];
  events: EventRow[];

  // ── 내부 주문 블록 (금액·주문 수는 시목 원장 기준) ──
  webPaidOrders: Measure;
  attributedOrders: Measure;
  /** 주문 유입 연결률(%) — 구매 전환율이 아니다. 분모 0/미상이면 unknown */
  attributionRate: Measure;
  attributionModel: string | null;
  byAttribution: AttributionBreakdown[];
  unattributedByReason: { reason: string; orders: number }[];

  limitations: string[];
}

interface Row {
  id: string;
  workspace_id: string;
  source_system: string;
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

export const QUERY_VERSION = WEB_ANALYTICS_VERSION;
/** 10 문서 §5: from/to 는 KST 양끝 포함, 최대 31일 */
export const MAX_RANGE_DAYS = 31;

/**
 * 숫자를 Measure 로.
 * ★ GA 블록은 `status` 가 complete 가 아니면 값이 있어도 믿지 않는다.
 *   (어댑터가 이미 거절하지만, 저장 당시 규칙이 달랐던 과거 행을 읽을 때의 방어)
 */
function gaMeasure(ga: Record<string, unknown> | null, key: string): Measure {
  const status = typeof ga?.status === 'string' ? ga.status : 'missing';
  const reason = typeof ga?.reason === 'string' ? ga.reason : null;
  const raw = ga?.[key];
  const value = typeof raw === 'number' && Number.isSafeInteger(raw) ? raw : null;
  if (value !== null && status === 'complete') return { known: true, value };
  return {
    known: false,
    status: status === 'partial' ? 'partial' : 'missing',
    reason: reason ?? '아직 수집되지 않았어요',
  };
}

/** 주문 블록은 우리 원장에서 온 값이라 null 만 구별하면 된다 */
function orderMeasure(om: Record<string, unknown> | null, key: string, reason: string): Measure {
  const raw = om?.[key];
  const value = typeof raw === 'number' && Number.isSafeInteger(raw) ? raw : null;
  return value !== null ? { known: true, value } : { known: false, status: 'missing', reason };
}

function toRecord(r: Row): WebAnalyticsRecord {
  const ga = r.ga_metrics ?? null;
  const om = r.order_metrics ?? null;
  const web = orderMeasure(om, 'total_paid_orders', '웹 결제 주문 수가 확인되지 않았어요');
  const attributed = orderMeasure(om, 'attributed_orders', '유입이 확인된 주문 수를 알 수 없어요');

  // 연결률: 원천이 보낸 ratio(0~1)를 % 로 바꾼다. 분모 0/미상이면 null (10 문서 §5)
  // ★ 원천 값을 그대로 쓰되, 어댑터(webAnalyticsV1)가 수신 시점에 재계산해 대조했다.
  const rawRate = om?.attribution_link_rate;
  let rate: Measure;
  if (typeof rawRate === 'number' && Number.isFinite(rawRate)) {
    rate = { known: true, value: Math.round(rawRate * 1000) / 10 };   // ratio → %
  } else if (web.known && web.value === 0) {
    rate = { known: false, status: 'partial', reason: '웹 결제 주문이 0이라 연결률을 만들지 않아요' };
  } else {
    rate = { known: false, status: 'partial', reason: '주문 수가 확인되지 않아 연결률을 계산하지 않아요' };
  }

  const bd = r.ga_breakdown ?? {};
  const bySource = Array.isArray(bd.by_source) ? (bd.by_source as { source: string; medium: string; sessions: number }[]) : [];
  const byEvent = Array.isArray(bd.by_event) ? (bd.by_event as { event: string; count: number }[]) : [];

  return {
    id: r.id,
    sourceSystem: r.source_system,
    environment: r.environment,
    usage: r.usage,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    revision: r.revision,
    freshness: r.freshness,
    observedAt: r.observed_at,
    sourceDataThrough: r.source_data_through,
    collectionStartedAt: r.collection_started_at,

    totalUsers: gaMeasure(ga, 'visitors_observed'),
    sessions: gaMeasure(ga, 'sessions'),
    pageViews: gaMeasure(ga, 'page_views'),
    gaStatus: (typeof ga?.status === 'string' ? ga.status : 'missing') as 'complete' | 'partial' | 'missing',
    gaReason: typeof ga?.reason === 'string' ? ga.reason : null,
    sources: bySource.map(s2 => ({ sourceMedium: `${s2.source} / ${s2.medium}`, sessions: s2.sessions })),
    events: byEvent.map(e => ({ eventName: e.event, count: e.count })),

    webPaidOrders: web,
    attributedOrders: attributed,
    attributionRate: rate,
    attributionModel: typeof r.attribution?.model === 'string' ? (r.attribution.model as string) : null,
    byAttribution: Array.isArray(om?.by_attribution) ? (om!.by_attribution as AttributionBreakdown[]) : [],
    unattributedByReason: Array.isArray(om?.unattributed_by_reason)
      ? (om!.unattributed_by_reason as { reason: string; orders: number }[]) : [],

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
 * 원천이 보낸 `web-analytics.v1` 본문(JSON 텍스트)을 검증하고 저장한다.
 *
 * - 파싱 **전에** 원문 텍스트를 받아 SHA-256 을 계산하고 `raw_body_text` 로 함께 보관한다.
 *   (JSONB 만으로는 키 순서·공백을 잃어 원문 해시를 재계산할 수 없다 — GPT-R2-O3 의 지적)
 * - 정정은 **새 revision**. 기존 행을 고치지 않는다(UPDATE 정책 없음).
 * - workspace 는 호출자가 아니라 서버/연결이 정한 값이어야 한다. 본문의 workspace 는 거절된다.
 */
export async function importWebAnalyticsText(
  workspaceId: string, text: string, opts: { revision?: number } = {},
): Promise<{ id: string; rawSha256: string; record: WebAnalyticsV1 }> {
  const rawSha256 = await sha256Hex(text);
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new ContractError('JSON 을 읽을 수 없습니다', 'invalid_json'); }

  const record = validateWebAnalyticsV1(parsed);
  const row = toStorageRow(record);

  const { data, error } = await supabase.from('web_analytics').insert({
    workspace_id: workspaceId,
    revision: opts.revision ?? 1,
    raw_sha256: rawSha256,
    raw_body_text: text,
    ...row,
  }).select('id').single() as unknown as { data: { id: string } | null; error: unknown };
  if (error) throw error;
  return { id: data!.id, rawSha256, record };
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
