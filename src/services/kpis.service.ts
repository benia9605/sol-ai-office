/**
 * @file src/services/kpis.service.ts
 * @description KPI CRUD + KPI Logs 서비스
 * - kpis 테이블: 목표별 수치 추적
 * - kpi_logs 테이블: KPI 값 변경 기록
 */
import { supabase } from './supabase';

export interface KpiRow {
  id: string;
  goal_id: string;
  name: string;
  current_value: number;
  target_value: number;
  start_value: number;
  unit: string;
  created_at: string;
  updated_at: string;
}

export interface KpiLogRow {
  id: string;
  kpi_id: string;
  value: number;
  date: string;
  note?: string;
  created_at: string;
}

// ── KPI CRUD ──

export async function fetchKpisByGoal(goalId: string): Promise<KpiRow[]> {
  const { data, error } = await supabase
    .from('kpis')
    .select('*')
    .eq('goal_id', goalId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchKpisByGoals(goalIds: string[]): Promise<KpiRow[]> {
  if (goalIds.length === 0) return [];
  const { data, error } = await supabase
    .from('kpis')
    .select('*')
    .in('goal_id', goalIds)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addKpi(kpi: Omit<KpiRow, 'id' | 'created_at' | 'updated_at'>): Promise<KpiRow> {
  const { data, error } = await supabase
    .from('kpis')
    .insert(kpi)
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error('KPI 생성 실패');
  return data;
}

export async function updateKpi(id: string, fields: Partial<KpiRow>): Promise<void> {
  const { error } = await supabase
    .from('kpis')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteKpi(id: string): Promise<void> {
  const { error } = await supabase
    .from('kpis')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ── KPI Logs ──

export async function fetchKpiLogs(kpiId: string): Promise<KpiLogRow[]> {
  const { data, error } = await supabase
    .from('kpi_logs')
    .select('*')
    .eq('kpi_id', kpiId)
    .order('date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addKpiLog(log: Omit<KpiLogRow, 'id' | 'created_at'>): Promise<KpiLogRow> {
  const { data, error } = await supabase
    .from('kpi_logs')
    .insert(log)
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error('KPI 기록 생성 실패');
  return data;
}

export async function deleteKpiLog(id: string): Promise<void> {
  const { error } = await supabase
    .from('kpi_logs')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
