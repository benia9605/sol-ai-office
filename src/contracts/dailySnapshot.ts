/**
 * @file src/contracts/dailySnapshot.ts
 * @description 시목 ↔ Office 하루 snapshot 계약 0.2.0 — 타입 + 검증 + canonical digest
 *
 * 공유 폴더 기준: `02_DATA_CONTRACT.md` 0.2.0(proposed),
 *   `contracts/daily-snapshot.schema.json`, `contracts/validate_fixture.py`, `contracts/test_contract.py`.
 *
 * 왜 포팅하는가: 공유 validator 는 Python 이고 "payload 구조·일부 의미"만 본다(계약 §10).
 *   Office 는 수신 시점에 같은 규칙을 **런타임에** 적용해야 하므로 TS 로 옮긴다.
 *   ⚠️ Python 쪽 fromisoformat 함정(소수부 3·6자리만 허용)을 그대로 옮기지 않도록
 *      시각 검증은 정규식 + 달력 검사로 직접 구현했다.
 *
 * 이 파일은 **모델 API 를 호출하지 않는다**(D-007). 순수 함수만 둔다.
 */

// ── 타입 ──

export type QualityStatus = 'complete' | 'partial' | 'missing';
export type Environment = 'demo' | 'staging' | 'production';
export type Usage = 'validation' | 'operational';
export type OrdersBasis = 'order' | 'voucher';
export type DateBasis = 'payment_time' | 'business_date';
export type ProductRefType = 'catalog' | 'custom';

export interface FieldQuality { status: QualityStatus; reason: string | null }
export interface BlockQuality {
  status: QualityStatus;
  as_of: string | null;
  fields: Record<string, FieldQuality>;
}
export interface Coverage { status: QualityStatus; reason: string | null }

/** totals 의 금액·수량 키 (paid_orders 는 totals 에 없다 — 계약 §3) */
export const FINANCIAL = [
  'captured_krw', 'merchandise_captured_krw', 'shipping_captured_krw',
  'refunded_krw', 'merchandise_refunded_krw', 'shipping_refunded_krw',
  'net_collected_krw', 'units_paid', 'points_redeemed_krw', 'points_restored_krw',
] as const;
/** 채널은 totals 키 + paid_orders */
export const CHANNEL = [...FINANCIAL, 'paid_orders'] as const;
export const PRODUCT = ['units_paid', 'merchandise_captured_krw', 'merchandise_refunded_krw'] as const;
export const TRAFFIC = ['sessions', 'visitors', 'pageviews'] as const;

export type FinancialKey = typeof FINANCIAL[number];
export type ChannelKey = typeof CHANNEL[number];

type Nums<K extends string> = { [P in K]: number | null };

export interface CommerceTotals extends Nums<FinancialKey> { quality: BlockQuality }
export interface CommerceChannel extends Nums<ChannelKey> {
  channel_id: string;
  channel_name: string;
  orders_basis: OrdersBasis;
  date_basis: DateBasis;
  quality: BlockQuality;
}
export interface ProductItem extends Nums<typeof PRODUCT[number]> {
  item_key: string;
  channel_id: string;
  product_ref_type: ProductRefType;
  product_id: string | null;
  sku: string | null;
  name: string;
  quality: BlockQuality;
}
export interface InventoryItem {
  product_id: string;
  available_units: number | null;
  quality: BlockQuality;
}
export interface DailySnapshot {
  schema_version: '0.2.0';
  snapshot_id: string;
  source_system: string;
  environment: Environment;
  usage: Usage;
  business_date: string;
  timezone: 'Asia/Seoul';
  currency: 'KRW';
  revision: number;
  generated_at: string;
  source_updated_at: string | null;
  commerce: {
    channel_coverage: Coverage;
    totals: CommerceTotals;
    by_channel: CommerceChannel[];
  };
  products: { coverage: Coverage; items: ProductItem[] };
  inventory: { coverage: Coverage; items: InventoryItem[] };
  traffic: {
    source: string | null;
    sessions: number | null;
    visitors: number | null;
    pageviews: number | null;
    quality: BlockQuality;
  };
}

/** 계약 §7: Office 논리 scope. schema_version 은 **정확한 값**을 쓴다(major 만으로 섞지 않는다). */
export interface SnapshotScope {
  workspaceId: string;
  sourceSystem: string;
  environment: Environment;
  usage: Usage;
  businessDate: string;
  schemaVersion: string;
}

export const SCHEMA_VERSION = '0.2.0';
export const MAX_SNAPSHOT_BYTES = 1024 * 1024; // 계약 §8: 1 MiB. 예시가 작은 것과 상한 제거는 별개다.

// ── 오류 ──

export class ContractError extends Error {
  readonly code: string;
  constructor(message: string, code = 'validation_failed') {
    super(message);
    this.name = 'ContractError';
    this.code = code;
  }
}

function require_(ok: unknown, message: string, code?: string): void {
  if (!ok) throw new ContractError(message, code);
}

// ── 시각 검증 (계약 §3) ──
// 프로파일: 대문자 T/Z, 초 00~59, 소수부 1~9자리, 명시적 offset, `-00:00` 불허.
const TS_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;

/** 윤년 포함 달력 검사 — Date 파서의 관용적 롤오버(2026-02-30 → 3/2)를 막는다 */
function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const last = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28,
    31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
  return d <= last;
}

export function assertTimestamp(value: string, path: string): void {
  const m = TS_RE.exec(value);
  require_(m, `${path}: T와 명시적 offset이 필요하고 소수부는 1~9자리입니다`);
  const [, ys, ms, ds, hs, mins, secs, , offset] = m!;
  require_(offset !== '-00:00', `${path}: -00:00은 관측 시각이 아닙니다`);
  if (offset !== 'Z') {
    require_(Number(offset.slice(1, 3)) <= 23 && Number(offset.slice(4, 6)) <= 59, `${path}: offset이 잘못되었습니다`);
  }
  require_(isRealDate(Number(ys), Number(ms), Number(ds)), `${path}: 달력에 없는 날짜입니다`);
  require_(Number(hs) <= 23 && Number(mins) <= 59 && Number(secs) <= 59, `${path}: 시/분/초가 범위를 벗어났습니다`);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export function assertBusinessDate(value: string, path: string): void {
  const m = DATE_RE.exec(value);
  require_(m, `${path}: YYYY-MM-DD 형식이어야 합니다`);
  require_(isRealDate(Number(m![1]), Number(m![2]), Number(m![3])), `${path}: 달력에 없는 날짜입니다`);
}

// ── 품질 규칙 ──

/** 블록 status 는 필드 status 들의 rollup (계약 §5) */
export function rollup(statuses: QualityStatus[]): QualityStatus {
  if (statuses.length === 0) return 'missing';
  if (statuses.every(s => s === 'complete')) return 'complete';
  if (statuses.every(s => s === 'missing')) return 'missing';
  return 'partial';
}

function isSafeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && Number.isSafeInteger(v);
}

/**
 * 계약 §5 핵심 불변식:
 *  - 값이 non-null ⟺ 해당 필드 status === 'complete'  (partial/missing 의 값은 반드시 null)
 *  - reason 이 null ⟺ status === 'complete'
 *  - status 가 complete 면 as_of 필수
 */
function checkMetricBlock(
  block: Record<string, unknown> & { quality: BlockQuality },
  keys: readonly string[],
  path: string,
): void {
  const q = block.quality;
  require_(q && typeof q === 'object', `${path}: quality 가 없습니다`);
  for (const k of keys) {
    const f = q.fields?.[k];
    require_(f && typeof f === 'object', `${path}.${k}: quality.fields 항목이 없습니다`);
    const v = block[k];
    require_(v === null || isSafeInt(v), `${path}.${k}: 정수 또는 null 이어야 합니다`);
    require_((v !== null) === (f.status === 'complete'),
      `${path}.${k}: complete 가 아닌 값은 null 이어야 합니다 (status=${f.status})`);
    require_((f.reason === null) === (f.status === 'complete'),
      `${path}.${k}: complete 가 아니면 reason 이 필수이고, complete 면 reason 은 null 입니다`);
  }
  require_(q.status === rollup(keys.map(k => q.fields[k].status)),
    `${path}: quality.status rollup 불일치 (받은 값 ${q.status})`);
  if (q.status === 'complete') require_(q.as_of !== null, `${path}: complete 는 관측 시각(as_of)이 필요합니다`);
  if (q.as_of !== null) assertTimestamp(q.as_of, `${path}.quality.as_of`);
}

function checkCoverage(c: Coverage, path: string): void {
  require_(['complete', 'partial', 'missing'].includes(c?.status), `${path}: status 가 잘못되었습니다`);
  require_((c.reason === null) === (c.status === 'complete'), `${path}: complete 가 아니면 reason 이 필요합니다`);
}

/** 금액 산술 (계약 §3) — 세 값이 모두 알려졌을 때만 검사한다 */
function checkMoney(b: Record<string, number | null>, path: string): void {
  const triples: [FinancialKey, FinancialKey, FinancialKey, 1 | -1][] = [
    ['captured_krw', 'merchandise_captured_krw', 'shipping_captured_krw', 1],
    ['refunded_krw', 'merchandise_refunded_krw', 'shipping_refunded_krw', 1],
    ['net_collected_krw', 'captured_krw', 'refunded_krw', -1],
  ];
  for (const [total, l, r, sign] of triples) {
    if (b[total] !== null && b[l] !== null && b[r] !== null) {
      require_(b[total] === b[l]! + sign * b[r]!, `${path}: 산술 불일치 ${total}`);
    }
  }
  // 순수납은 captured·refunded 양쪽이 complete 일 때만 숫자 (계약 §3)
  const bothKnown = b.captured_krw !== null && b.refunded_krw !== null;
  require_((b.net_collected_krw !== null) === bothKnown,
    `${path}: 순수납은 수납·환불이 모두 확인될 때만 숫자입니다`);
}

function assertUnique(values: string[], path: string): void {
  require_(new Set(values).size === values.length, `${path}: 중복 ID`);
}

/**
 * 하루 snapshot 전체 검증. 공유 `validate_fixture.py: check()` 와 같은 규칙을 적용한다.
 * 통과해도 **원장 정확성·인증·영속 revision·live API 를 증명하지 않는다**(계약 §10).
 */
export function validateSnapshot(input: unknown): DailySnapshot {
  require_(input && typeof input === 'object' && !Array.isArray(input), 'snapshot 은 object 여야 합니다');
  const s = input as DailySnapshot & Record<string, unknown>;

  require_(s.schema_version === SCHEMA_VERSION, `schema_version 은 ${SCHEMA_VERSION} 이어야 합니다 (받은 값 ${String(s.schema_version)})`);
  require_(typeof s.snapshot_id === 'string' && s.snapshot_id.length > 0, 'snapshot_id 가 필요합니다');
  require_(typeof s.source_system === 'string' && s.source_system.length > 0, 'source_system 이 필요합니다');
  require_(['demo', 'staging', 'production'].includes(s.environment), 'environment 가 잘못되었습니다');
  require_(['validation', 'operational'].includes(s.usage), 'usage 가 잘못되었습니다');
  require_(s.timezone === 'Asia/Seoul', 'timezone 은 Asia/Seoul 이어야 합니다');
  require_(s.currency === 'KRW', 'currency 는 KRW 여야 합니다');
  require_(isSafeInt(s.revision) && s.revision >= 1, 'revision 은 1 이상의 정수여야 합니다');
  assertBusinessDate(s.business_date, 'business_date');
  assertTimestamp(s.generated_at, 'generated_at');
  if (s.source_updated_at !== null) assertTimestamp(s.source_updated_at, 'source_updated_at');

  // 계약 §2: 본문에 workspace/tenant 를 넣을 수 없다 (주입 차단)
  for (const banned of ['tenant_id', 'workspace_id', 'workspaceId']) {
    require_(!(banned in s), `본문에 ${banned} 를 넣을 수 없습니다 — workspace 는 서버가 결정합니다`, 'workspace_injection');
  }
  // 계약 §2: 비-production 은 validation 만
  require_(s.environment === 'production' || s.usage === 'validation',
    'production 이 아니면 usage 는 validation 이어야 합니다');

  // ── commerce ──
  const c = s.commerce;
  require_(c && typeof c === 'object', 'commerce 가 없습니다');
  checkCoverage(c.channel_coverage, 'commerce.channel_coverage');
  const channels = c.by_channel;
  require_(Array.isArray(channels), 'commerce.by_channel 은 배열이어야 합니다');
  assertUnique(channels.map(v => v.channel_id), 'commerce.by_channel');

  const coverage = c.channel_coverage.status;
  if (coverage === 'complete') {
    require_(channels.length > 0, 'channel_coverage=complete 는 설정된 채널이 1개 이상 필요합니다(판매 0인 날도 확인된 0을 보냅니다)');
  }
  if (coverage === 'missing') require_(channels.length === 0, 'channel_coverage=missing 이면 채널 목록은 비어야 합니다');

  for (const row of channels) {
    require_(['order', 'voucher'].includes(row.orders_basis), `channel ${row.channel_id}: orders_basis 가 잘못되었습니다`);
    require_(['payment_time', 'business_date'].includes(row.date_basis), `channel ${row.channel_id}: date_basis 가 잘못되었습니다`);
    checkMetricBlock(row as never, CHANNEL, `channel ${row.channel_id}`);
    checkMoney(row as never, `channel ${row.channel_id}`);
  }

  const t = c.totals;
  checkMetricBlock(t as never, FINANCIAL, 'commerce.totals');
  checkMoney(t as never, 'commerce.totals');
  // 계약 §5: 모든 채널을 수집했고 그 필드가 각 채널에서 complete 일 때만 합계가 숫자다
  for (const k of FINANCIAL) {
    const known = coverage === 'complete' && channels.every(row => row[k] !== null);
    require_((t[k] !== null) === known,
      `totals.${k}: 채널 값이 unknown 이면 합계도 complete 가 될 수 없습니다`);
    if (known) {
      const sum = channels.reduce((a, row) => a + (row[k] as number), 0);
      require_(t[k] === sum, `totals.${k}: 채널 합계 불일치 (합계 ${t[k]} ≠ 채널합 ${sum})`);
    }
  }

  const channelIds = new Set(channels.map(r => r.channel_id));

  // ── products / inventory ──
  for (const name of ['products', 'inventory'] as const) {
    const section = s[name];
    require_(section && Array.isArray(section.items), `${name}.items 가 필요합니다`);
    checkCoverage(section.coverage, name);
    if (section.coverage.status === 'missing') require_(section.items.length === 0, `${name}: missing 목록은 비어야 합니다`);
    assertUnique(
      name === 'products'
        ? (section.items as ProductItem[]).map(p => p.item_key)
        : (section.items as InventoryItem[]).map(p => p.product_id),
      name,
    );
    for (const item of section.items) {
      checkMetricBlock(item as never, name === 'products' ? PRODUCT : ['available_units'], name);
      if (name === 'products') {
        const p = item as ProductItem;
        require_(channelIds.has(p.channel_id), `products ${p.item_key}: channel_id 가 commerce 에 없습니다`);
        require_((p.product_ref_type === 'custom') === (p.product_id === null),
          `products ${p.item_key}: catalog 는 product_id 필수, custom 은 catalog ID 없음`);
        if (p.product_ref_type === 'custom') {
          require_(p.sku === null, `products ${p.item_key}: custom 의 SKU 는 null 이어야 합니다`);
        }
      }
    }
    // 계약 §5: 목록이 complete 이고 비교 필드가 줄·채널 모두 complete 면 반드시 대조한다
    if (name === 'products' && section.coverage.status === 'complete') {
      for (const row of channels) {
        const subset = (section.items as ProductItem[]).filter(p => p.channel_id === row.channel_id);
        for (const k of PRODUCT) {
          if (row[k] !== null && subset.every(p => p[k] !== null)) {
            const sum = subset.reduce((a, p) => a + (p[k] as number), 0);
            require_(row[k] === sum, `상품 합계 불일치 ${row.channel_id}.${k} (채널 ${row[k]} ≠ 상품합 ${sum})`);
          }
        }
      }
    }
  }

  // ── traffic ──
  checkMetricBlock(s.traffic as never, TRAFFIC, 'traffic');
  if (TRAFFIC.some(k => s.traffic[k] !== null)) {
    require_(s.traffic.source !== null, 'traffic: 측정값이 있으면 source 가 필요합니다');
  }

  return s;
}

// ── canonical digest (계약 §7.3) ──
// 변경 감지 대상에서 snapshot_id / revision / generated_at / source_updated_at / 모든 quality.as_of 를 제외한다.
// 관찰 시각만 달라졌다고 새 revision 을 만들지 않기 위한 규칙.

const DIGEST_EXCLUDED_ROOT = new Set(['snapshot_id', 'revision', 'generated_at', 'source_updated_at']);

function canonicalize(value: unknown, keyPath: string[] = []): unknown {
  if (Array.isArray(value)) {
    const arr = value.map(v => canonicalize(v, keyPath));
    // 계약 §7.3: by_channel=channel_id, products=item_key, inventory=product_id 로 정렬
    const parent = keyPath[keyPath.length - 1];
    const sortKey = parent === 'by_channel' ? 'channel_id'
      : keyPath.includes('products') ? 'item_key'
      : keyPath.includes('inventory') ? 'product_id' : null;
    if (sortKey) {
      arr.sort((a, b) => {
        const av = String((a as Record<string, unknown>)?.[sortKey] ?? '');
        const bv = String((b as Record<string, unknown>)?.[sortKey] ?? '');
        return av < bv ? -1 : av > bv ? 1 : 0;
      });
    }
    return arr;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    // JSON object key 정렬 고정
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      if (keyPath.length === 0 && DIGEST_EXCLUDED_ROOT.has(k)) continue;
      if (k === 'as_of') continue; // 모든 quality.as_of 제외 (관찰 시각)
      out[k] = canonicalize((value as Record<string, unknown>)[k], [...keyPath, k]);
    }
    return out;
  }
  return value;
}

/** digest 대상 문자열. 정렬·키순서를 고정한 UTF-8 JSON. */
export function canonicalDigestInput(snapshot: DailySnapshot): string {
  return JSON.stringify(canonicalize(snapshot));
}

/** SHA-256 hex. 브라우저·Deno·Node 18+ 공통 WebCrypto 사용. */
export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 내용 변경 감지용 digest (관찰 시각 제외). 수신 bytes 해시와 **다른 것**이다(계약 §7.3). */
export function contentDigest(snapshot: DailySnapshot): Promise<string> {
  return sha256Hex(canonicalDigestInput(snapshot));
}

/**
 * JSON 텍스트를 계약 규칙으로 파싱한다.
 * - 1 MiB 상한(바이트 기준). 초과는 전체 거절(계약 §8) — 잘라서 성공 처리하지 않는다.
 * - 중복 JSON 멤버 거절(공유 validator 의 no_duplicates 와 동일).
 * - NaN/Infinity 거절.
 */
export function parseSnapshotText(text: string): { snapshot: DailySnapshot; rawSha256: Promise<string> } {
  const bytes = new TextEncoder().encode(text);
  require_(bytes.length <= MAX_SNAPSHOT_BYTES,
    `snapshot 이 1 MiB(${MAX_SNAPSHOT_BYTES} bytes)를 넘었습니다 — 전체를 거절합니다`, 'payload_too_large');

  // JSON.parse 는 중복 멤버를 마지막 값으로 조용히 병합한다 → 파싱 전에 원문을 스캔해 거절한다.
  const duplicateKey = findDuplicateMember(text);
  require_(!duplicateKey, `JSON 에 중복 멤버가 있습니다: ${duplicateKey}`, 'duplicate_member');

  const parsed = JSON.parse(text, (key, value) => {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new ContractError(`유한하지 않은 숫자: ${key}`);
    }
    return value;
  });

  const snapshot = validateSnapshot(parsed);
  return { snapshot, rawSha256: sha256Hex(text) };
}

/**
 * 같은 object 안에 같은 키가 두 번 나오는지 찾는다. 문자열 리터럴·이스케이프를 건너뛰는 최소 스캐너.
 * (JSON.parse 는 중복을 조용히 병합하므로 별도 검사가 필요하다.)
 */
function findDuplicateMember(text: string): string | null {
  const stack: Set<string>[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '"') {
      // 문자열 읽기
      let j = i + 1, out = '';
      while (j < n) {
        if (text[j] === '\\') { out += text[j] + text[j + 1]; j += 2; continue; }
        if (text[j] === '"') break;
        out += text[j]; j++;
      }
      // 뒤에 ':' 가 오면 object 멤버 키
      let k = j + 1;
      while (k < n && /\s/.test(text[k])) k++;
      if (text[k] === ':' && stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top.has(out)) return out;
        top.add(out);
      }
      i = j + 1;
      continue;
    }
    if (ch === '{') stack.push(new Set());
    else if (ch === '}') stack.pop();
    i++;
  }
  return null;
}
