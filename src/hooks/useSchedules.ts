/**
 * @file src/hooks/useSchedules.ts
 * @description 일정 데이터 관리 훅
 * - Supabase 연동 (schedules 테이블)
 * - Supabase 미설정 시 더미 데이터 폴백
 * - 낙관적 업데이트 + 에러 롤백
 */
import { useState, useEffect, useCallback } from 'react';
import { ScheduleItem } from '../types';
import { dummySchedules } from '../data';
import {
  fetchSchedules, addSchedule, updateSchedule, deleteSchedule, ScheduleRow,
} from '../services/schedules.service';

/** DB 행 → 프론트 타입 변환 */
function toScheduleItem(row: ScheduleRow): ScheduleItem {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    endDate: row.end_date,
    time: row.time,
    project: row.project,
    color: row.color,
    category: row.category,
    repeat: row.repeat,
    reminder: row.reminder,
    notes: row.notes,
    tags: row.tags,
    completed: row.completed ?? false,
    completedAt: row.completed_at,
    isMilestone: row.is_milestone ?? false,
    planId: row.plan_id,
    phase: row.phase,
    sortOrder: row.sort_order,
    generatedBy: row.generated_by,
  };
}

/** 프론트 → DB 필드 변환 */
function toDbFields(patch: Partial<ScheduleItem>): Partial<ScheduleRow> {
  const db: Partial<ScheduleRow> = {};
  if (patch.title !== undefined) db.title = patch.title;
  if (patch.date !== undefined) db.date = patch.date;
  if (patch.endDate !== undefined) db.end_date = patch.endDate || undefined;
  if (patch.time !== undefined) db.time = patch.time;
  if (patch.project !== undefined) db.project = patch.project;
  if (patch.color !== undefined) db.color = patch.color;
  if (patch.category !== undefined) db.category = patch.category || undefined;
  if (patch.repeat !== undefined) db.repeat = patch.repeat;
  if (patch.reminder !== undefined) db.reminder = patch.reminder;
  if (patch.notes !== undefined) db.notes = patch.notes;
  if (patch.tags !== undefined) db.tags = patch.tags;
  if (patch.completed !== undefined) db.completed = patch.completed;
  if (patch.completedAt !== undefined) db.completed_at = patch.completedAt || undefined;
  if (patch.isMilestone !== undefined) db.is_milestone = patch.isMilestone;
  if (patch.planId !== undefined) db.plan_id = patch.planId || undefined;
  if (patch.phase !== undefined) db.phase = patch.phase || undefined;
  if (patch.sortOrder !== undefined) db.sort_order = patch.sortOrder;
  if (patch.generatedBy !== undefined) db.generated_by = patch.generatedBy;
  return db;
}

const sortSchedules = (list: ScheduleItem[]) =>
  [...list].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

/** workspaceId 주면 그 워크스페이스(오피스 공유) 일정, 없으면 개인(workspace_id NULL) */
export function useSchedules(workspaceId?: string) {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingDummy, setUsingDummy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await fetchSchedules(workspaceId);
      setSchedules(sortSchedules(rows.map(toScheduleItem)));
      setUsingDummy(false);
    } catch (e) {
      console.warn('[useSchedules] Supabase 연결 실패, 더미 데이터 사용:', e);
      setSchedules(dummySchedules);
      setUsingDummy(true);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (data: Omit<ScheduleItem, 'id'>) => {
    if (usingDummy) {
      const newItem: ScheduleItem = { ...data, id: Date.now().toString() };
      setSchedules((prev) => sortSchedules([...prev, newItem]));
      return;
    }
    try {
      const row = await addSchedule({
        title: data.title,
        date: data.date,
        end_date: data.endDate,
        time: data.time,
        project: data.project,
        color: data.color,
        category: data.category,
        repeat: data.repeat,
        reminder: data.reminder,
        notes: data.notes,
        tags: data.tags,
        completed: data.completed,
        is_milestone: data.isMilestone,
        plan_id: data.planId,
        phase: data.phase,
        sort_order: data.sortOrder,
        generated_by: data.generatedBy,
        workspace_id: workspaceId,
        is_shared: workspaceId ? true : undefined,
      });
      setSchedules((prev) => sortSchedules([...prev, toScheduleItem(row)]));
    } catch (e) {
      console.error('[useSchedules] 추가 실패:', e);
    }
  }, [usingDummy, workspaceId]);

  const update = useCallback(async (id: string, patch: Partial<ScheduleItem>) => {
    const prev = schedules;
    setSchedules((list) => sortSchedules(list.map((s) => (s.id === id ? { ...s, ...patch } : s))));

    if (!usingDummy) {
      try {
        const dbPatch = toDbFields(patch);
        if (Object.keys(dbPatch).length > 0) {
          await updateSchedule(id, dbPatch);
        }
      } catch (e) {
        console.error('[useSchedules] 업데이트 실패:', e);
        setSchedules(prev);
      }
    }
  }, [schedules, usingDummy]);

  const toggleComplete = useCallback((id: string) => {
    const cur = schedules.find((s) => s.id === id);
    const next = !cur?.completed;
    return update(id, { completed: next, completedAt: next ? new Date().toISOString() : '' });
  }, [schedules, update]);

  const remove = useCallback(async (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
    if (!usingDummy) {
      try {
        await deleteSchedule(id);
      } catch (e) {
        console.error('[useSchedules] 삭제 실패:', e);
        load();
      }
    }
  }, [usingDummy, load]);

  return { schedules, loading, add, update, remove, toggleComplete, reload: load };
}
