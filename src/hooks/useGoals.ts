/**
 * @file src/hooks/useGoals.ts
 * @description 목표 & KPI 데이터 관리 훅
 * - Supabase 연동 (goals, kpis 테이블)
 * - 프로젝트별 목표 로드
 * - KPI 기반 목표 progress 자동 재계산
 */
import { useState, useEffect, useCallback } from 'react';
import { GoalItem, GoalType, KpiItem, KpiLog } from '../types';
import {
  fetchGoalsByProject, addGoal, updateGoal, deleteGoal, GoalRow,
} from '../services/goals.service';
import {
  fetchKpisByGoals, addKpi, updateKpi, deleteKpi, KpiRow,
  fetchKpiLogs, addKpiLog, deleteKpiLog, KpiLogRow,
} from '../services/kpis.service';

/** DB 행 → 프론트 KpiItem */
function toKpiItem(row: KpiRow): KpiItem {
  return {
    id: row.id,
    goalId: row.goal_id,
    name: row.name,
    currentValue: Number(row.current_value),
    targetValue: Number(row.target_value),
    startValue: Number(row.start_value),
    unit: row.unit,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** DB 행 → 프론트 KpiLog */
function toKpiLog(row: KpiLogRow): KpiLog {
  return {
    id: row.id,
    kpiId: row.kpi_id,
    value: Number(row.value),
    date: row.date,
    note: row.note,
    createdAt: row.created_at,
  };
}

/** DB 행 → 프론트 GoalItem */
function toGoalItem(row: GoalRow): GoalItem {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    type: (row.type as GoalType) || 'mixed',
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status as GoalItem['status'],
    progress: row.progress,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export function useGoals(projectId: string) {
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [kpis, setKpis] = useState<KpiItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const goalRows = await fetchGoalsByProject(projectId);
      const goalItems = goalRows.map(toGoalItem);
      setGoals(goalItems);

      const goalIds = goalItems.map((g) => g.id);
      if (goalIds.length > 0) {
        const kpiRows = await fetchKpisByGoals(goalIds);
        setKpis(kpiRows.map(toKpiItem));
      } else {
        setKpis([]);
      }
    } catch (e) {
      console.error('[useGoals] 로드 실패:', e);
      setGoals([]);
      setKpis([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  /** 목표 progress 재계산 (KPI 평균 달성률) */
  const recalcProgress = useCallback((goalId: string, currentKpis?: KpiItem[]) => {
    const goalKpis = (currentKpis || kpis).filter((k) => k.goalId === goalId);

    if (goalKpis.length > 0) {
      const total = goalKpis.reduce((sum, k) => {
        const range = k.targetValue - k.startValue;
        if (range <= 0) return sum + 100;
        return sum + Math.min(100, Math.round(((k.currentValue - k.startValue) / range) * 100));
      }, 0);
      return Math.round(total / goalKpis.length);
    }

    return 0;
  }, [kpis]);

  // ── Goals CRUD ──

  const addGoalItem = useCallback(async (data: { title: string; type?: GoalType; startDate?: string; endDate?: string; notes?: string }) => {
    try {
      const row = await addGoal({
        project_id: projectId,
        title: data.title,
        type: data.type || 'mixed',
        start_date: data.startDate,
        end_date: data.endDate,
        status: 'pending',
        progress: 0,
        notes: data.notes,
      });
      const item = toGoalItem(row);
      setGoals((prev) => [...prev, item]);
      return item;
    } catch (e) {
      console.error('[useGoals] 목표 추가 실패:', e);
      return null;
    }
  }, [projectId]);

  const updateGoalItem = useCallback(async (id: string, patch: Partial<GoalItem>) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    try {
      const dbPatch: Record<string, unknown> = {};
      if (patch.title !== undefined) dbPatch.title = patch.title;
      if (patch.type !== undefined) dbPatch.type = patch.type;
      if (patch.startDate !== undefined) dbPatch.start_date = patch.startDate || null;
      if (patch.endDate !== undefined) dbPatch.end_date = patch.endDate || null;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.progress !== undefined) dbPatch.progress = patch.progress;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes || null;
      console.log('[useGoals] updateGoalItem →', { id, patch, dbPatch });
      if (Object.keys(dbPatch).length > 0) {
        await updateGoal(id, dbPatch);
        console.log('[useGoals] DB 업데이트 성공');
      }
    } catch (e) {
      console.error('[useGoals] 목표 업데이트 실패:', e);
    }
  }, []);

  const removeGoalItem = useCallback(async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    try {
      await deleteGoal(id);
    } catch (e) {
      console.error('[useGoals] 목표 삭제 실패:', e);
    }
  }, []);

  // ── KPI CRUD ──

  const addKpiItem = useCallback(async (data: { goalId: string; name: string; targetValue: number; currentValue?: number; startValue?: number; unit?: string }) => {
    try {
      const row = await addKpi({
        goal_id: data.goalId,
        name: data.name,
        current_value: data.currentValue ?? 0,
        target_value: data.targetValue,
        start_value: data.startValue ?? 0,
        unit: data.unit ?? '',
      });
      const item = toKpiItem(row);
      setKpis((prev) => [...prev, item]);
      return item;
    } catch (e) {
      console.error('[useGoals] KPI 추가 실패:', e);
      return null;
    }
  }, []);

  const updateKpiItem = useCallback(async (id: string, patch: Partial<KpiItem>) => {
    setKpis((prev) => prev.map((k) => (k.id === id ? { ...k, ...patch } : k)));
    try {
      const dbPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.currentValue !== undefined) dbPatch.current_value = patch.currentValue;
      if (patch.targetValue !== undefined) dbPatch.target_value = patch.targetValue;
      if (patch.startValue !== undefined) dbPatch.start_value = patch.startValue;
      if (patch.unit !== undefined) dbPatch.unit = patch.unit;
      if (Object.keys(dbPatch).length > 0) {
        await updateKpi(id, dbPatch as Partial<KpiRow>);
      }
    } catch (e) {
      console.error('[useGoals] KPI 업데이트 실패:', e);
    }
  }, []);

  const removeKpiItem = useCallback(async (id: string) => {
    setKpis((prev) => prev.filter((k) => k.id !== id));
    try {
      await deleteKpi(id);
    } catch (e) {
      console.error('[useGoals] KPI 삭제 실패:', e);
    }
  }, []);

  /** KPI 값 기록 + current_value 업데이트 + progress 재계산 */
  const addKpiRecord = useCallback(async (kpiId: string, value: number, note?: string) => {
    try {
      const logRow = await addKpiLog({
        kpi_id: kpiId,
        value,
        date: new Date().toISOString().slice(0, 10),
        note,
      });
      // KPI current_value 업데이트
      await updateKpi(kpiId, { current_value: value } as Partial<KpiRow>);
      const updatedKpis = kpis.map((k) => (k.id === kpiId ? { ...k, currentValue: value } : k));
      setKpis(updatedKpis);

      // 해당 KPI의 goal progress 재계산
      const kpiItem = kpis.find((k) => k.id === kpiId);
      if (kpiItem) {
        const newProgress = recalcProgress(kpiItem.goalId, updatedKpis);
        setGoals((prev) => prev.map((g) => (g.id === kpiItem.goalId ? { ...g, progress: newProgress } : g)));
        updateGoal(kpiItem.goalId, { progress: newProgress }).catch(() => {});
      }

      return toKpiLog(logRow);
    } catch (e) {
      console.error('[useGoals] KPI 기록 실패:', e);
      return null;
    }
  }, [kpis, recalcProgress]);

  /** KPI 로그 조회 */
  const getKpiLogs = useCallback(async (kpiId: string): Promise<KpiLog[]> => {
    try {
      const rows = await fetchKpiLogs(kpiId);
      return rows.map(toKpiLog);
    } catch (e) {
      console.error('[useGoals] KPI 로그 조회 실패:', e);
      return [];
    }
  }, []);

  /** KPI 로그 삭제 */
  const removeKpiLog = useCallback(async (logId: string) => {
    try {
      await deleteKpiLog(logId);
    } catch (e) {
      console.error('[useGoals] KPI 로그 삭제 실패:', e);
    }
  }, []);

  return {
    goals,
    kpis,
    loading,
    addGoal: addGoalItem,
    updateGoal: updateGoalItem,
    removeGoal: removeGoalItem,
    addKpi: addKpiItem,
    updateKpi: updateKpiItem,
    removeKpi: removeKpiItem,
    addKpiRecord,
    getKpiLogs,
    removeKpiLog,
    reload: load,
  };
}
