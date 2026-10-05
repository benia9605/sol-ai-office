/**
 * @file src/contracts/webAnalyticsV1.ts
 * @description `web-analytics.v1` 원천 wire 포맷 검증·매핑
 *
 * 기준: 시목 round5 evidence 의 실제 fixture
 *   `coordination/evidence/simok-app/round5/fixture-web-analytics-v1.{ga-not-connected,empty-day}.json`
 *   + 10_WEB_ANALYTICS_PLAN.md §5
 *
 * ★ 왜 어댑터가 필요한가
 *   내가 round3 에서 먼저 만든 저장 컬럼은 GA4 Data API 이름(totalUsers/screenPageViews)을 가정했는데,
 *   원천이 실제로 보내는 이름은 `visitors_observed` / `page_views` / `total_paid_orders` 였다.
 *   **원천 포맷을 기준으로 삼고** 여기서 한 번만 매핑한다. 화면·서비스는 이 결과만 본다.
 *
 * ★ 검증에서 지키는 것 (10 문서 §5)
 *   - ga.status != 'complete' 면 모든 GA 지표는 null 이어야 한다. 0 으로 오면 거절.
 *   - 연결률은 원천 값을 그대로 믿지 않고 **다시 계산해 대조**한다. 어긋나면 거절.
 *   - 분모 0 이면 연결률은 null 이어야 한다(0% 가 아니다).
 *   - 원천의 비율은 **0~1 ratio** 다. 화면의 % 와 구별한다.
 *   - 전환율(conversion rate) 칸은 받지 않는다. 있으면 거절.
 *
 * 모델 API 를 호출하지 않는다.
 */
import { ContractError } from './dailySnapshot';

export const WEB_ANALYTICS_VERSION = 'web-analytics.v1';

export type BlockStatus = 'complete' | 'partial' | 'missing';

/** 원천 명명 그대로 — Office 가 임의로 source/medium 으로 쪼개지 않는다 (GPT-R3-O1) */
export interface GaSourceRow {
  source_medium: string;          // 예: "instagram / organic_social"
  campaign: string | null;
  content: string | null;
  sessions: number;
}
export interface GaEventRow {
  event_name: string;
  count: number;
}
export interface GaBlock {
  status: BlockStatus;
  reason: string | null;
  property_ref: string | null;
  data_through: string | null;
  visitors_observed: number | null;
  sessions: number | null;
  page_views: number | null;
  by_source: GaSourceRow[] | null;
  by_event: GaEventRow[] | null;
}

export interface AttributionRow {
  source: string; medium: string;
  campaign: string | null; content: string | null;
  orders: number;
  merchandise_captured_krw: number | null;
  shipping_captured_krw: number | null;
}

export interface OrdersBlock {
  attribution_model: string;
  lookback_days: number;
  total_paid_orders: number | null;
  attributed_orders: number | null;
  unattributed_orders: number | null;
  /** 0~1 ratio. 분모 0 이면 null */
  attribution_link_rate: number | null;
  by_attribution: AttributionRow[];
  unattributed_by_reason: { reason: string; orders: number; merchandise_captured_krw: number | null; shipping_captured_krw: number | null }[];
}

export interface WebAnalyticsV1 {
  schema_version: string;
  /** ★ wire 의 query_version 을 **그대로 보존**한다 (예: 'web-analytics.v1/2026-10-05').
   *  schema_version 으로 덮어쓰면 어떤 질의본인지 추적이 끊긴다 (GPT-R3-O1) */
  query_version: string;
  source_system: string;
  environment: 'demo' | 'staging' | 'production';
  usage: 'validation' | 'operational';
  timezone: string;
  currency: string;
  period: { from: string; to: string };
  observed_at: string;
  collection_started_at: string | null;
  /** 루트 레벨 — 원천이 "여기까지 처리됨" 이라고 밝힌 시점 */
  source_data_through: string | null;
  freshness: 'provisional' | 'rechecked';
  ga: GaBlock;
  orders: OrdersBlock;
  limitations: string[];
  /** 원천이 계산한 의미 digest. Office 는 이것을 **보관**하고 revision 판단에 쓴다 */
  content_digest: string;
}

function need(ok: unknown, msg: string, code = 'validation_failed'): void {
  if (!ok) throw new ContractError(msg, code);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

/** 10 문서 §5: from/to KST 양끝 포함, 최대 31일 */
export const MAX_RANGE_DAYS = 31;

export function validateWebAnalyticsV1(input: unknown): WebAnalyticsV1 {
  need(input && typeof input === 'object' && !Array.isArray(input), 'web-analytics 레코드는 object 여야 합니다');
  const r = input as WebAnalyticsV1 & Record<string, unknown>;

  need(r.schema_version === WEB_ANALYTICS_VERSION,
    `schema_version 은 ${WEB_ANALYTICS_VERSION} 이어야 합니다 (받은 값 ${String(r.schema_version)})`);
  // query_version 은 schema_version 과 다른 값일 수 있다(질의본 식별). 반드시 보존한다.
  need(typeof r.query_version === 'string' && r.query_version.length > 0, 'query_version 이 필요합니다');
  need(typeof r.source_system === 'string' && r.source_system.length > 0, 'source_system 이 필요합니다');
  need(typeof r.currency === 'string' && r.currency.length > 0, 'currency 가 필요합니다');
  need(typeof r.content_digest === 'string' && /^[0-9a-f]{64}$/.test(r.content_digest),
    'content_digest 는 64자리 소문자 hex(SHA-256)여야 합니다');
  need(r.source_data_through === null || typeof r.source_data_through === 'string',
    'source_data_through 는 문자열 또는 null 이어야 합니다');
  need(['demo', 'staging', 'production'].includes(r.environment), 'environment 가 잘못되었습니다');
  need(['validation', 'operational'].includes(r.usage), 'usage 가 잘못되었습니다');
  // 계약 §2 와 같은 규칙 — 비 production 은 validation 만
  need(r.environment === 'production' || r.usage === 'validation',
    'production 이 아니면 usage 는 validation 이어야 합니다');
  need(r.timezone === 'Asia/Seoul', 'timezone 은 Asia/Seoul 이어야 합니다');
  need(['provisional', 'rechecked'].includes(r.freshness), 'freshness 가 잘못되었습니다');

  // workspace 주입 차단 — 계약 §2 와 동일 원칙 (workspace 는 서버가 정한다)
  for (const banned of ['workspace_id', 'workspaceId', 'tenant_id']) {
    need(!(banned in r), `본문에 ${banned} 를 넣을 수 없습니다 — workspace 는 서버가 결정합니다`, 'workspace_injection');
  }

  need(r.period && DATE_RE.test(r.period.from) && DATE_RE.test(r.period.to), 'period.from/to 는 YYYY-MM-DD 여야 합니다');
  const a = Date.parse(`${r.period.from}T00:00:00Z`), b = Date.parse(`${r.period.to}T00:00:00Z`);
  need(Number.isFinite(a) && Number.isFinite(b), 'period 날짜가 잘못되었습니다');
  need(b >= a, 'period.to 가 from 보다 앞설 수 없습니다');
  need(Math.round((b - a) / 86400000) + 1 <= MAX_RANGE_DAYS, `기간은 최대 ${MAX_RANGE_DAYS}일입니다`);

  // ── GA 블록 ──
  const ga = r.ga;
  need(ga && typeof ga === 'object', 'ga 블록이 필요합니다');
  need(['complete', 'partial', 'missing'].includes(ga.status), 'ga.status 가 잘못되었습니다');
  need((ga.reason === null) === (ga.status === 'complete'), 'ga: complete 가 아니면 reason 이 필요합니다');
  const gaNums: (keyof GaBlock)[] = ['visitors_observed', 'sessions', 'page_views'];
  for (const k of gaNums) {
    const v = ga[k] as number | null;
    need(v === null || isInt(v), `ga.${k} 는 정수 또는 null 이어야 합니다`);
    // ★ 관측 지표는 음수가 될 수 없다 (GPT-R3-O2)
    need(v === null || (v as number) >= 0, `ga.${k} 는 음수일 수 없습니다 (받은 값 ${v})`);
    // ★ 미수집을 0 으로 쓰지 않는다
    if (ga.status !== 'complete') {
      need(v === null, `ga.${k}: GA 가 ${ga.status} 인데 값이 있습니다 — 미수집을 0/숫자로 쓰지 않습니다`);
    }
  }
  if (ga.status !== 'complete') {
    need(ga.by_source === null || (Array.isArray(ga.by_source) && ga.by_source.length === 0),
      'ga.by_source: GA 미수집이면 경로 분해가 있을 수 없습니다');
    need(ga.by_event === null || (Array.isArray(ga.by_event) && ga.by_event.length === 0),
      'ga.by_event: GA 미수집이면 event 분해가 있을 수 없습니다');
  }
  // 분해 행의 **타입까지** 검사한다. 문자열이 오면 합 검사가 조용히 건너뛰어진다(GPT-R3-O2).
  if (Array.isArray(ga.by_source)) {
    ga.by_source.forEach((row, i) => {
      need(row && typeof row.source_medium === 'string' && row.source_medium.length > 0,
        `ga.by_source[${i}].source_medium 이 필요합니다 (원천 명명)`);
      need(isInt(row.sessions) && row.sessions >= 0, `ga.by_source[${i}].sessions 는 0 이상 정수여야 합니다`);
      need(row.campaign === null || typeof row.campaign === 'string', `ga.by_source[${i}].campaign`);
      need(row.content === null || typeof row.content === 'string', `ga.by_source[${i}].content`);
    });
    if (ga.sessions !== null && ga.status === 'complete') {
      const sum = ga.by_source.reduce((a, x) => a + x.sessions, 0);
      need(sum <= (ga.sessions as number),
        `ga.by_source 세션 합(${sum})이 전체 세션(${ga.sessions})보다 많습니다`);
    }
  }
  if (Array.isArray(ga.by_event)) {
    ga.by_event.forEach((row, i) => {
      need(row && typeof row.event_name === 'string' && row.event_name.length > 0,
        `ga.by_event[${i}].event_name 이 필요합니다 (원천 명명)`);
      need(isInt(row.count) && row.count >= 0, `ga.by_event[${i}].count 는 0 이상 정수여야 합니다`);
    });
    const names = ga.by_event.map(x => x.event_name);
    need(new Set(names).size === names.length, 'ga.by_event 에 같은 event_name 이 두 번 있습니다');
  }
  // 전환율 칸은 애초에 받지 않는다 (10 문서 §5)
  for (const banned of ['conversion_rate', 'purchase_conversion_rate', 'cvr']) {
    need(!(banned in (ga as unknown as Record<string, unknown>)), `ga.${banned} 는 받지 않습니다 — 전환율을 만들지 않습니다`);
  }

  // ── 주문 블록 ──
  const o = r.orders;
  need(o && typeof o === 'object', 'orders 블록이 필요합니다');
  need(typeof o.attribution_model === 'string' && o.attribution_model.length > 0, 'orders.attribution_model 이 필요합니다');
  need(isInt(o.lookback_days) && o.lookback_days > 0, 'orders.lookback_days 가 잘못되었습니다');
  for (const k of ['total_paid_orders', 'attributed_orders', 'unattributed_orders'] as const) {
    const v = o[k];
    need(v === null || (isInt(v) && v >= 0), `orders.${k} 는 0 이상 정수 또는 null 이어야 합니다`);
  }
  need(Array.isArray(o.by_attribution), 'orders.by_attribution 은 배열이어야 합니다');
  need(Array.isArray(o.unattributed_by_reason), 'orders.unattributed_by_reason 은 배열이어야 합니다');
  // ★ 행의 타입을 먼저 강제한다. 예전 구현은 orders 가 문자열이면 합 검사를 **건너뛰었다**(GPT-R3-O2).
  o.by_attribution.forEach((row, i) => {
    need(row && typeof row.source === 'string' && typeof row.medium === 'string',
      `orders.by_attribution[${i}]: source/medium 이 필요합니다`);
    need(isInt(row.orders) && row.orders >= 0, `orders.by_attribution[${i}].orders 는 0 이상 정수여야 합니다`);
    for (const mk of ['merchandise_captured_krw', 'shipping_captured_krw'] as const) {
      const mv = row[mk];
      need(mv === null || (isInt(mv) && mv >= 0), `orders.by_attribution[${i}].${mk}`);
    }
  });
  o.unattributed_by_reason.forEach((row, i) => {
    need(row && typeof row.reason === 'string' && row.reason.length > 0,
      `orders.unattributed_by_reason[${i}].reason 이 필요합니다`);
    need(isInt(row.orders) && row.orders >= 0, `orders.unattributed_by_reason[${i}].orders`);
  });

  const total = o.total_paid_orders, att = o.attributed_orders, un = o.unattributed_orders;

  // 분해 합이 전체와 맞는가
  // 타입은 위에서 이미 강제했으므로 합 검사를 **건너뛰지 않는다**
  if (att !== null) {
    const sum = o.by_attribution.reduce((s2, x) => s2 + x.orders, 0);
    need(sum === att, `orders.by_attribution 합(${sum})이 attributed_orders(${att})와 다릅니다`);
  }
  if (un !== null) {
    const sum = o.unattributed_by_reason.reduce((s2, x) => s2 + x.orders, 0);
    need(sum === un, `unattributed_by_reason 합(${sum})이 unattributed_orders(${un})와 다릅니다`);
  }
  if (total !== null && att !== null && un !== null) {
    need(att + un === total, `attributed(${att}) + unattributed(${un}) 가 total(${total})과 다릅니다`);
  }

  // ★ 연결률을 **다시 계산해 대조**한다. 원천 값을 그대로 믿지 않는다.
  const rate = o.attribution_link_rate;
  if (total === null || att === null || total === 0) {
    need(rate === null,
      '분모(total_paid_orders)가 0이거나 미상이면 attribution_link_rate 는 null 이어야 합니다 (0 이 아닙니다)');
  } else {
    need(typeof rate === 'number' && Number.isFinite(rate), 'attribution_link_rate 가 숫자가 아닙니다');
    const rateNum = rate as number;
    need(rateNum >= 0 && rateNum <= 1, `attribution_link_rate 는 0~1 ratio 여야 합니다 (받은 값 ${rateNum})`);
    const recomputed = att / total;
    need(Math.abs(recomputed - rateNum) < 1e-9,
      `attribution_link_rate 불일치: 받은 값 ${rateNum}, 재계산 ${recomputed}`);
  }

  need(Array.isArray(r.limitations), 'limitations 는 배열이어야 합니다');
  return r;
}

/** 저장 컬럼으로 매핑 (원천 포맷 → Office web_analytics) */
export function toStorageRow(r: WebAnalyticsV1) {
  return {
    source_system: r.source_system,
    environment: r.environment,
    usage: r.usage,
    currency: r.currency ?? 'KRW',
    period_start: r.period.from,
    period_end: r.period.to,
    timezone: r.timezone,
    // ★ wire 의 query_version 을 그대로 (schema_version 으로 덮어쓰지 않는다)
    query_version: r.query_version,
    schema_version: r.schema_version,
    source_ref: r.ga.property_ref,
    observed_at: r.observed_at,
    // 루트 source_data_through 가 기준. 없으면 GA 블록 값으로 폴백
    source_data_through: r.source_data_through ?? r.ga.data_through,
    content_digest: r.content_digest,
    collection_started_at: r.collection_started_at,
    freshness: r.freshness,
    ga_metrics: {
      status: r.ga.status,
      reason: r.ga.reason,
      visitors_observed: r.ga.visitors_observed,
      sessions: r.ga.sessions,
      page_views: r.ga.page_views,
    },
    ga_breakdown: { by_source: r.ga.by_source, by_event: r.ga.by_event },
    order_metrics: {
      total_paid_orders: r.orders.total_paid_orders,
      attributed_orders: r.orders.attributed_orders,
      unattributed_orders: r.orders.unattributed_orders,
      attribution_link_rate: r.orders.attribution_link_rate,
      by_attribution: r.orders.by_attribution,
      unattributed_by_reason: r.orders.unattributed_by_reason,
    },
    attribution: { model: r.orders.attribution_model, lookback_days: r.orders.lookback_days },
    quality: { ga: { status: r.ga.status, reason: r.ga.reason } },
    limitations: r.limitations,
  };
}
