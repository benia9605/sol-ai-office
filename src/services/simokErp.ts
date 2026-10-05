/**
 * @file src/services/simokErp.ts
 * @description 시목앱 ERP 읽기 API 클라이언트 (erp-proxy Edge Function 경유)
 * - 키는 서버(Supabase Secret SIMOK_API_KEY)에만. 프론트는 erp-proxy만 호출.
 * - 계약: 공유 폴더 02_DATA_CONTRACT.md 0.2.0 §1·§2·§8
 *
 * ★ 0.2.0 가드 (GPT-R1-O1 / INT-009)
 *   모든 호출에 workspaceId 를 넣는다. erp-proxy 가 **호출자 JWT로** 멤버십(RLS)과
 *   erp_source='simok_api' 를 확인한 뒤에만 원천을 호출한다. 프론트가 보낸 workspaceId 는
 *   "어느 workspace 로 요청하는가"일 뿐이고, 권한은 서버가 DB로 증명한다.
 *   타임아웃·AbortController 는 서버(erp-proxy)가 담당한다 — 여기서는 전체 job deadline만 건다.
 */
import { supabase } from './supabase';

/** 시목 ERP 공통 응답 봉투 */
export interface ErpEnvelope<T> {
  data: T[];
  next_cursor: string | null;
  generated_at: string;
}

type ErpPath = 'products' | 'summary' | 'sales-daily' | 'daily-snapshot';

/** 계약 0.2.0 §8 오류 형태 */
interface ContractError {
  error?: { code?: string; message?: string; retryable?: boolean; trace_id?: string };
}

/** page cap — 계약 0.2.0 §8: cap 에 닿았는데 next_cursor 가 남으면 "불완전"이며 전체 성공이 아니다. */
const MAX_PAGES = 10;
/** 전체 job deadline. 개별 요청 타임아웃은 erp-proxy(15s)가 담당. */
const JOB_DEADLINE_MS = 45_000;

export class ErpIncompleteError extends Error {
  constructor(readonly path: string, readonly pages: number) {
    super(`시목 ERP 목록이 ${pages}페이지에서 끊겼습니다(아직 next_cursor 남음) — 불완전한 결과를 저장하지 않습니다.`);
    this.name = 'ErpIncompleteError';
  }
}

/** erp-proxy 응답에서 계약 오류 메시지를 꺼낸다 */
function contractMessage(data: unknown, fallback: string): string {
  const e = (data as ContractError | null)?.error;
  if (e?.message) return e.code ? `${e.message} (${e.code})` : e.message;
  return fallback;
}

/**
 * erp-proxy Edge Function을 통해 시목 ERP API를 조회.
 * 커서 페이지네이션을 끝까지 따라가 전체 data를 합쳐 반환한다.
 * cap 에 닿고도 next_cursor 가 남으면 **ErpIncompleteError** — 부분 결과를 성공으로 돌려주지 않는다.
 */
export async function erpProxyGet<T>(
  workspaceId: string,
  path: ErpPath,
  query: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  // 시목 연동은 실제 Supabase(+배포된 erp-proxy)에서만 동작. Mock 모드 방어.
  const fns = (supabase as { functions?: { invoke?: unknown } }).functions;
  if (!fns || typeof fns.invoke !== 'function') {
    throw new Error('시목 연동은 실제 Supabase 환경에서만 동작해요 (erp-proxy Edge Function 필요).');
  }
  if (!workspaceId) throw new Error('시목 ERP 조회에는 workspaceId가 필요해요.');

  const all: T[] = [];
  let cursor: string | undefined;
  const deadline = Date.now() + JOB_DEADLINE_MS;

  for (let page = 0; page < MAX_PAGES; page++) {
    if (Date.now() > deadline) throw new Error(`시목 ERP 조회가 전체 제한시간(${JOB_DEADLINE_MS}ms)을 넘겼어요.`);

    const { data, error } = await supabase.functions.invoke('erp-proxy', {
      body: { workspaceId, path, query: { ...query, ...(cursor ? { cursor } : {}) } },
    });
    // functions.invoke 는 비-2xx 를 error 로 준다. 본문의 계약 오류를 우선 노출한다.
    if (error) {
      const ctx = (error as { context?: unknown }).context;
      throw new Error(contractMessage(ctx, `시목 ERP 조회 실패(${path}): ${error.message}`));
    }
    if ((data as ContractError)?.error) {
      throw new Error(contractMessage(data, `시목 ERP 오류(${path})`));
    }

    const env = data as ErpEnvelope<T>;
    all.push(...(env?.data ?? []));
    if (!env?.next_cursor) return all;
    cursor = env.next_cursor;
  }
  // cap 소진 + next_cursor 남음 → 불완전. 계약 §8에 따라 전체 성공으로 저장하지 않는다.
  throw new ErpIncompleteError(path, MAX_PAGES);
}

// ── 시목 응답 타입 ──

export interface SimokProduct {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  categorySlug?: string;
  categories?: { name: string; slug: string }[];
  status: 'active' | 'draft';
  wholesaleVisible?: boolean;
  price?: number;
  cost?: number;
  stock?: number;
  incoming?: number;
  outgoing?: number;
  adjustment?: number;
  saleTaxType?: string;
  purchaseTaxType?: string;
  imageUrl?: string;
  businessEntity?: string;
  woodType?: string;
  updatedAt?: string;
}

/**
 * 기존 /sales-daily 응답.
 * ⚠️ `revenue` 는 계약 0.2.0 의 captured_krw 가 **아니다**.
 *    시목 회신 §4-2: 「별도」 과세 줄에 ×1.1 을 적용하고 배송비를 제외한 기존 집계액이다.
 *    의미가 검증되지 않았으므로 순수납으로 이름만 바꾸지 않는다(계약 0.2.0 §1).
 */
export interface SimokSalesRow {
  date: string;
  source: string;
  sourceLabel?: string;
  revenue?: number;
  orders?: number;
  ordersBasis?: 'order' | 'voucher';
  commissionRate?: number | null;
}
