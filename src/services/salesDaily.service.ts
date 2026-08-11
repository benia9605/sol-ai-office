/**
 * @file src/services/salesDaily.service.ts
 * @description 일 매출(sales_daily) — 채널×날짜 집계 CRUD
 * - 중심 테이블(Orders/Products/Content/Dashboard 연결 허브).
 * - aov(객단가)·전환율은 저장하지 않고 revenue/orders/visitors로 앱에서 계산.
 * - UNIQUE(workspace_id, source, date) → 저장은 조회 후 update/insert(upsert) 분기(mock/real 안전).
 * - 마이그레이션 030_sales_daily.sql. Mock 동기화: mockSupabase.ts sales_daily.
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { SalesDaily } from '../types';
import { ErpSource } from '../config/dataSource';
import { erpProxyGet, SimokSalesRow } from './simokErp';

interface SalesDailyRow {
  id: string;
  workspace_id: string;
  created_by?: string;
  date: string;
  source: string;
  revenue?: number;
  orders?: number;
  visitors?: number;
  memo?: string;
  extra?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

function toSales(r: SalesDailyRow): SalesDaily {
  return {
    id: r.id, workspaceId: r.workspace_id, date: r.date, source: r.source,
    revenue: r.revenue ?? undefined, orders: r.orders ?? undefined, visitors: r.visitors ?? undefined,
    memo: r.memo, extra: r.extra ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function toRow(f: Partial<SalesDaily>): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (f.date !== undefined) p.date = f.date;
  if (f.source !== undefined) p.source = f.source;
  if (f.revenue !== undefined) p.revenue = f.revenue ?? null;
  if (f.orders !== undefined) p.orders = f.orders ?? null;
  if (f.visitors !== undefined) p.visitors = f.visitors ?? null;
  if (f.memo !== undefined) p.memo = f.memo || null;
  if (f.extra !== undefined) p.extra = f.extra ?? null;
  return p;
}

/**
 * 시목 앱 API에서 매출 조회 (System of Record).
 * 계약 ⑫: 채널별 행(합계행 없음), VAT-in 통일, 환불=음수행, ordersBasis(voucher는 AOV 제외).
 */
async function fetchSalesFromSimok(workspaceId: string, limit: number): Promise<SalesDaily[]> {
  const days = Math.max(1, limit || 90);
  const to = new Date();
  const from = new Date(to.getTime() - days * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const rows = await erpProxyGet<SimokSalesRow>('sales-daily', { from: fmt(from), to: fmt(to) });
  // 최신 날짜순으로 뒤집어 반환(뷰가 최신순 기대)
  return rows.map(r => ({
    id: `${r.date}__${r.source}`,   // 집계라 실 id 없음 → 결정적 키 합성
    workspaceId,
    date: r.date,
    source: r.source,
    sourceLabel: r.sourceLabel,
    revenue: r.revenue ?? undefined,
    orders: r.orders ?? undefined,
    ordersBasis: r.ordersBasis,
    commissionRate: r.commissionRate ?? undefined,
  })).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** 워크스페이스 최근 N일 매출 (최신 날짜순) — 소스 분기: 시목 API(조회) / Compatibility(수기) */
export async function fetchSalesDaily(workspaceId: string, limit = 90, source: ErpSource = 'manual'): Promise<SalesDaily[]> {
  if (source === 'simok_api') return fetchSalesFromSimok(workspaceId, limit);
  // Compatibility Mode: AI Office 임시 수기 입력분(Supabase)
  const { data, error } = await supabase
    .from('sales_daily')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toSales);
}

/** 쓰기는 Compatibility Mode에서만 — 외부 연동 시 System of Record는 시목앱. */
function assertWritable(source: ErpSource) {
  if (source === 'simok_api') throw new Error('외부 연동 모드에서는 매출을 AI Office에서 수정할 수 없어요. (System of Record = 시목앱)');
}

/**
 * (workspace, source, date) 단위 upsert — 있으면 update, 없으면 insert.
 * UNIQUE 제약 충돌을 앱단에서 회피(mock/real 공통).
 */
export async function saveSalesDaily(workspaceId: string, fields: Partial<SalesDaily> & { date: string; source: string }, erp: ErpSource = 'manual'): Promise<void> {
  assertWritable(erp);
  const { data: existing } = await supabase
    .from('sales_daily')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('source', fields.source)
    .eq('date', fields.date)
    .limit(1);

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from('sales_daily')
      .update({ ...toRow(fields), updated_at: new Date().toISOString() })
      .eq('id', existing[0].id);
    if (error) throw error;
  } else {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('sales_daily')
      .insert({ workspace_id: workspaceId, created_by: userId, ...toRow(fields) });
    if (error) throw error;
  }
}

/** 매출 행 삭제 (Compatibility Mode 전용) */
export async function deleteSalesDaily(id: string, source: ErpSource = 'manual'): Promise<void> {
  assertWritable(source);
  const { error } = await supabase.from('sales_daily').delete().eq('id', id);
  if (error) throw error;
}
