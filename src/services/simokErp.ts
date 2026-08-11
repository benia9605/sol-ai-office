/**
 * @file src/services/simokErp.ts
 * @description 시목앱 ERP 읽기 API 클라이언트 (erp-proxy Edge Function 경유)
 * - 키는 서버(Supabase Secret SIMOK_API_KEY)에만. 프론트는 erp-proxy만 호출.
 * - 계약: docs/guides/ai오피스구축/_시목API연동_클코대화.md ⑪·⑫
 */
import { supabase } from './supabase';

/** 시목 ERP 공통 응답 봉투 */
export interface ErpEnvelope<T> {
  data: T[];
  next_cursor: string | null;
  generated_at: string;
}

type ErpPath = 'products' | 'summary' | 'sales-daily';

/**
 * erp-proxy Edge Function을 통해 시목 ERP API를 조회.
 * 커서 페이지네이션을 끝까지 따라가 전체 data를 합쳐 반환.
 */
export async function erpProxyGet<T>(
  path: ErpPath,
  query: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  // 시목 연동은 실제 Supabase(+배포된 erp-proxy)에서만 동작. Mock 모드 방어.
  const fns = (supabase as { functions?: { invoke?: unknown } }).functions;
  if (!fns || typeof fns.invoke !== 'function') {
    throw new Error('시목 연동은 실제 Supabase 환경에서만 동작해요 (erp-proxy Edge Function 필요).');
  }

  const all: T[] = [];
  let cursor: string | undefined;
  // 안전장치: 최대 50페이지(무한루프 방지). 제품 ~300개라 실무상 1페이지.
  for (let i = 0; i < 50; i++) {
    const { data, error } = await supabase.functions.invoke('erp-proxy', {
      body: { path, query: { ...query, ...(cursor ? { cursor } : {}) } },
    });
    if (error) throw new Error(`시목 ERP 조회 실패(${path}): ${error.message}`);
    if (data?.error) throw new Error(`시목 ERP 오류(${path}): ${data.error}`);
    const env = data as ErpEnvelope<T>;
    all.push(...(env.data ?? []));
    if (!env.next_cursor) break;
    cursor = env.next_cursor;
  }
  return all;
}

// ── 시목 응답 타입(계약 ⑪·⑫) ──

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

export interface SimokSalesRow {
  date: string;
  source: string;
  sourceLabel?: string;
  revenue?: number;
  orders?: number;
  ordersBasis?: 'order' | 'voucher';
  commissionRate?: number | null;
}
