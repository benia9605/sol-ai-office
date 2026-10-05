/**
 * @file src/contracts/projection.ts
 * @description snapshot 0.2.0 → UI 표시용 projection (원문은 보존, 화면은 이것만 읽는다)
 *
 * 계약 0.2.0 §5·§7 의 정직성 규칙을 **타입으로** 강제하는 레이어다.
 *  - partial/missing 값은 숫자가 아니라 `{ known: false, reason }` 이다 → 화면이 0으로 그릴 수 없다.
 *  - 합계는 "숫자 덧셈"이 아니라 그 날짜의 **최신 revision** 에서 읽는다.
 *  - 한 채널 환불이 unknown 이면 전체 환불·전체 순수납도 unknown. 알려진 채널 값은 그 채널에 남는다.
 *  - 객단가(주문당 수납액)는 분자·분모가 **같은 order 채널 집합**일 때만 계산한다.
 *
 * 모델 API 를 호출하지 않는다(D-007). 순수 함수만.
 */
import {
  DailySnapshot, CommerceChannel, FINANCIAL, FinancialKey, QualityStatus,
} from './dailySnapshot';

/** 알 수 없는 값을 0과 구별하는 표현. UI 는 known=false 면 `—` 를 그린다. */
export type Measure =
  | { known: true; value: number }
  | { known: false; status: Exclude<QualityStatus, 'complete'>; reason: string | null };

export function measure(value: number | null, status: QualityStatus, reason: string | null): Measure {
  if (value !== null && status === 'complete') return { known: true, value };
  return { known: false, status: status === 'complete' ? 'partial' : status, reason };
}

/** 화면에 찍을 문자열. 숫자가 아니면 절대 0을 만들지 않는다. */
export function formatMeasure(m: Measure, unit = '원'): string {
  return m.known ? `${m.value.toLocaleString()}${unit}` : '—';
}

export interface ChannelProjection {
  channelId: string;
  channelName: string;
  ordersBasis: 'order' | 'voucher';
  dateBasis: 'payment_time' | 'business_date';
  captured: Measure;
  refunded: Measure;
  netCollected: Measure;
  unitsPaid: Measure;
  paidOrders: Measure;
  /** 이 채널 수치를 관측한 시각 */
  asOf: string | null;
  status: QualityStatus;
}

/**
 * 주문당 수납액 — 계약 §3.
 * 분자·분모가 같은 범위여야 한다: `orders_basis='order'` 이고 captured·paid_orders 가 모두 complete 인
 * 채널만 모아 계산한다. 하나라도 조건을 못 채우면 **계산하지 않고** 이유를 돌려준다.
 */
export type PerOrder =
  | { known: true; value: number; channelIds: string[]; basis: 'order' }
  | { known: false; reason: string };

export interface SnapshotProjection {
  businessDate: string;
  sourceSystem: string;
  environment: DailySnapshot['environment'];
  usage: DailySnapshot['usage'];
  revision: number;
  snapshotId: string;
  generatedAt: string;
  sourceUpdatedAt: string | null;
  /** 운영 집계에 넣어도 되는가 — production+operational 만 true (계약 §2) */
  isOperational: boolean;
  /** 검증용 자료라는 배지를 UI 에 띄워야 하는가 */
  showValidationBadge: boolean;

  channelCoverage: QualityStatus;
  channelCoverageReason: string | null;

  totals: {
    captured: Measure;
    merchandiseCaptured: Measure;
    shippingCaptured: Measure;
    refunded: Measure;
    netCollected: Measure;
    unitsPaid: Measure;
    pointsRedeemed: Measure;
    pointsRestored: Measure;
  };
  channels: ChannelProjection[];
  perOrderCaptured: PerOrder;

  products: {
    coverage: QualityStatus;
    coverageReason: string | null;
    items: {
      itemKey: string;
      channelId: string;
      refType: 'catalog' | 'custom';
      productId: string | null;
      sku: string | null;
      name: string;
      unitsPaid: Measure;
      merchandiseCaptured: Measure;
      merchandiseRefunded: Measure;
    }[];
  };
  inventory: {
    coverage: QualityStatus;
    coverageReason: string | null;
    items: { productId: string; availableUnits: Measure; asOf: string | null }[];
  };
  /** traffic 은 현재 미연결이 정상. 방문자 0·전환율을 만들지 않는다(계약 §6). */
  traffic: { source: string | null; sessions: Measure; visitors: Measure; pageviews: Measure };
}

function m(block: { quality: { fields: Record<string, { status: QualityStatus; reason: string | null }> } } & Record<string, unknown>, key: string): Measure {
  const f = block.quality.fields[key];
  return measure(block[key] as number | null, f.status, f.reason);
}

export function projectSnapshot(s: DailySnapshot): SnapshotProjection {
  const t = s.commerce.totals;
  const channels: ChannelProjection[] = s.commerce.by_channel.map(ch => ({
    channelId: ch.channel_id,
    channelName: ch.channel_name,
    ordersBasis: ch.orders_basis,
    dateBasis: ch.date_basis,
    captured: m(ch as never, 'captured_krw'),
    refunded: m(ch as never, 'refunded_krw'),
    netCollected: m(ch as never, 'net_collected_krw'),
    unitsPaid: m(ch as never, 'units_paid'),
    paidOrders: m(ch as never, 'paid_orders'),
    asOf: ch.quality.as_of,
    status: ch.quality.status,
  }));

  return {
    businessDate: s.business_date,
    sourceSystem: s.source_system,
    environment: s.environment,
    usage: s.usage,
    revision: s.revision,
    snapshotId: s.snapshot_id,
    generatedAt: s.generated_at,
    sourceUpdatedAt: s.source_updated_at,
    isOperational: s.environment === 'production' && s.usage === 'operational',
    showValidationBadge: s.usage === 'validation',

    channelCoverage: s.commerce.channel_coverage.status,
    channelCoverageReason: s.commerce.channel_coverage.reason,

    totals: {
      captured: m(t as never, 'captured_krw'),
      merchandiseCaptured: m(t as never, 'merchandise_captured_krw'),
      shippingCaptured: m(t as never, 'shipping_captured_krw'),
      refunded: m(t as never, 'refunded_krw'),
      netCollected: m(t as never, 'net_collected_krw'),
      unitsPaid: m(t as never, 'units_paid'),
      pointsRedeemed: m(t as never, 'points_redeemed_krw'),
      pointsRestored: m(t as never, 'points_restored_krw'),
    },
    channels,
    perOrderCaptured: perOrderCaptured(s.commerce.by_channel),

    products: {
      coverage: s.products.coverage.status,
      coverageReason: s.products.coverage.reason,
      items: s.products.items.map(p => ({
        itemKey: p.item_key,
        channelId: p.channel_id,
        refType: p.product_ref_type,
        productId: p.product_id,
        sku: p.sku,
        name: p.name,
        unitsPaid: m(p as never, 'units_paid'),
        merchandiseCaptured: m(p as never, 'merchandise_captured_krw'),
        merchandiseRefunded: m(p as never, 'merchandise_refunded_krw'),
      })),
    },
    inventory: {
      coverage: s.inventory.coverage.status,
      coverageReason: s.inventory.coverage.reason,
      items: s.inventory.items.map(i => ({
        productId: i.product_id,
        availableUnits: m(i as never, 'available_units'),
        asOf: i.quality.as_of,
      })),
    },
    traffic: {
      source: s.traffic.source,
      sessions: m(s.traffic as never, 'sessions'),
      visitors: m(s.traffic as never, 'visitors'),
      pageviews: m(s.traffic as never, 'pageviews'),
    },
  };
}

/**
 * 계약 §3: "분자와 분모 모두 같은 범위여야 한다."
 * - voucher 채널은 제외한다(전표 1건이 하루치일 수 있어 분모가 될 수 없다).
 * - order 채널 중 captured·paid_orders 가 **둘 다 complete** 인 것만 쓴다.
 * - 쓸 수 있는 채널이 없으면 계산하지 않는다. 전표 수납을 웹 주문 수로 나누지 않는다.
 */
export function perOrderCaptured(rows: CommerceChannel[]): PerOrder {
  const orderChannels = rows.filter(r => r.orders_basis === 'order');
  if (orderChannels.length === 0) {
    return { known: false, reason: 'order 기준 채널이 없습니다 (전표 수를 주문 수로 쓰지 않습니다)' };
  }
  const usable = orderChannels.filter(
    r => r.quality.fields.captured_krw.status === 'complete'
      && r.quality.fields.paid_orders.status === 'complete'
      && r.captured_krw !== null && r.paid_orders !== null,
  );
  if (usable.length !== orderChannels.length) {
    const missing = orderChannels.filter(r => !usable.includes(r)).map(r => r.channel_id);
    return { known: false, reason: `order 채널 ${missing.join(', ')} 의 수납 또는 주문 수가 확인되지 않았습니다` };
  }
  const orders = usable.reduce((a, r) => a + (r.paid_orders as number), 0);
  if (orders <= 0) return { known: false, reason: '주문 수가 0이라 주문당 수납액을 계산하지 않습니다' };
  const captured = usable.reduce((a, r) => a + (r.captured_krw as number), 0);
  return { known: true, value: Math.round(captured / orders), channelIds: usable.map(r => r.channel_id), basis: 'order' };
}

/**
 * 여러 날짜의 projection 을 기간 합계로 묶는다.
 * 계약 §5: 한 날짜라도 unknown 이면 그 기간 합계도 unknown. 아는 날만 더해 전체라고 하지 않는다.
 */
export function sumOverDays(
  days: SnapshotProjection[],
  pick: (p: SnapshotProjection) => Measure,
): Measure {
  if (days.length === 0) return { known: false, status: 'missing', reason: '해당 기간에 수신된 snapshot 이 없습니다' };
  let total = 0;
  for (const d of days) {
    const v = pick(d);
    if (!v.known) {
      return { known: false, status: 'partial', reason: `${d.businessDate} 값이 확인되지 않아 기간 합계를 만들지 않습니다` };
    }
    total += v.value;
  }
  return { known: true, value: total };
}

/** 기간 안에서 같은 business_date 가 여러 revision 으로 있으면 최신만 남긴다(계약 §7.5). */
export function latestPerDate(rows: { businessDate: string; revision: number }[]): typeof rows {
  const best = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const cur = best.get(r.businessDate);
    if (!cur || r.revision > cur.revision) best.set(r.businessDate, r);
  }
  return [...best.values()].sort((a, b) => (a.businessDate < b.businessDate ? 1 : -1));
}

/** 전체 합계가 unknown 인 이유를 사람 말로. 연결 상태 화면용. */
export function unknownTotalsExplanation(p: SnapshotProjection): string[] {
  const out: string[] = [];
  if (p.channelCoverage !== 'complete') {
    out.push(`채널 수집이 ${p.channelCoverage === 'missing' ? '전부 실패' : '일부만 완료'}: ${p.channelCoverageReason ?? '이유 없음'}`);
  }
  for (const k of FINANCIAL as readonly FinancialKey[]) {
    const bad = p.channels.filter(c => {
      const mm = c[({ captured_krw: 'captured', refunded_krw: 'refunded', net_collected_krw: 'netCollected', units_paid: 'unitsPaid' } as Record<string, keyof ChannelProjection>)[k] ?? 'captured'];
      return mm && typeof mm === 'object' && 'known' in mm && !mm.known;
    });
    if (bad.length > 0 && ['captured_krw', 'refunded_krw'].includes(k)) {
      out.push(`${k}: 채널 ${bad.map(c => c.channelName).join(', ')} 미확인 → 전체 합계 없음`);
    }
  }
  return out;
}
