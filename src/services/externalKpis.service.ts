/**
 * @file src/services/externalKpis.service.ts
 * @description 외부 앱이 PUSH한 KPI 읽기 (오피스 대시보드용)
 * - external_kpis 테이블에서 워크스페이스의 최근 N일 조회
 * - 미연동/데이터 없으면 빈 배열 → 대시보드는 0으로 표시
 */
import { supabase } from './supabase';

export interface ExternalKpiRow {
  date: string;
  source: string;
  revenue: number | null;
  orders: number | null;
  visitors: number | null;
  conversion_rate: number | null;
  inquiries: number | null;
  extra: Record<string, unknown> | null;
}

/** 워크스페이스의 최근 N일 KPI (오래된→최신 순) */
export async function fetchExternalKpis(workspaceId: string, days = 7): Promise<ExternalKpiRow[]> {
  const { data, error } = await supabase
    .from('external_kpis')
    .select('date, source, revenue, orders, visitors, conversion_rate, inquiries, extra')
    .eq('workspace_id', workspaceId)
    .order('date', { ascending: false })
    .limit(days);
  if (error) throw error;
  // 최신순으로 받아 오래된→최신으로 뒤집어 추이용으로 반환
  return (data ?? []).reverse();
}
