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
    time: row.time,
    project: row.project,
    color: row.color,
    category: row.category,
    repeat: row.repeat,
    reminder: row.reminder,
    notes: row.notes,
    tags: row.tags,
  };
}

/** 프론트 → DB 필드 변환 */
function toDbFields(patch: Partial<ScheduleItem>): Partial<ScheduleRow> {
  const db: Partial<ScheduleRow> = {};
  if (patch.title !== undefined) db.title = patch.title;
  if (patch.date !== undefined) db.date = patch.date;
  if (patch.time !== undefined) db.time = patch.time;
  if (patch.project !== undefined) db.project = patch.project;
  if (patch.color !== undefined) db.color = patch.color;
  if (patch.category !== undefined) db.category = patch.category || undefined;
  if (patch.repeat !== undefined) db.repeat = patch.repeat;
  if (patch.reminder !== undefined) db.reminder = patch.reminder;
  if (patch.notes !== undefined) db.notes = patch.notes;
  if (patch.tags !== undefined) db.tags = patch.tags;
  return db;
}

const sortSchedules = (list: ScheduleItem[]) =>
  [...list].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

export function useSchedules() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingDummy, setUsingDummy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await fetchSchedules();
      setSchedules(sortSchedules(rows.map(toScheduleItem)));
      setUsingDummy(false);
    } catch (e) {
      console.warn('[useSchedules] Supabase 연결 실패, 더미 데이터 사용:', e);
      setSchedules(dummySchedules);
      setUsingDummy(true);
    } finally {
      setLoading(false);
    }
  }, []);

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
        time: data.time,
        project: data.project,
        color: data.color,
        category: data.category,
        repeat: data.repeat,
        reminder: data.reminder,
        notes: data.notes,
        tags: data.tags,
      });
      setSchedules((prev) => sortSchedules([...prev, toScheduleItem(row)]));
    } catch (e) {
      console.error('[useSchedules] 추가 실패:', e);
    }
  }, [usingDummy]);

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

  return { schedules, loading, add, update, remove, reload: load };
}
