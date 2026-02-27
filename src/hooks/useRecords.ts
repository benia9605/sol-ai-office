/**
 * @file src/hooks/useRecords.ts
 * @description 기록 데이터 관리 훅
 * - Supabase 연동 (journals 테이블)
 * - Supabase 미설정 시 더미 데이터 폴백
 * - 낙관적 업데이트 + 에러 롤백
 */
import { useState, useEffect, useCallback } from 'react';
import { RecordItem, RecordType, MorningTemplate, EveningTemplate, WeeklyTemplate } from '../types';
import { dummyRecords } from '../data';
import {
  fetchRecords, addRecord, updateRecord, deleteRecord, RecordRow,
} from '../services/records.service';

/** DB 행 → 프론트 타입 변환 */
function toRecordItem(row: RecordRow): RecordItem {
  return {
    id: row.id,
    recordType: row.record_type as RecordType,
    date: row.date,
    time: row.time,
    title: row.title,
    mood: row.mood,
    energy: row.energy,
    tags: row.tags,
    conversationId: row.conversation_id,
    morningData: row.morning_data as MorningTemplate | undefined,
    eveningData: row.evening_data as EveningTemplate | undefined,
    weeklyData: row.weekly_data as WeeklyTemplate | undefined,
    memoBody: row.memo_body,
    createdAt: row.created_at,
  };
}

/** 프론트 → DB 필드 변환 */
function toDbFields(patch: Partial<RecordItem>): Partial<RecordRow> {
  const db: Partial<RecordRow> = {};
  if (patch.recordType !== undefined) db.record_type = patch.recordType;
  if (patch.title !== undefined) db.title = patch.title;
  if (patch.date !== undefined) db.date = patch.date;
  if (patch.time !== undefined) db.time = patch.time;
  if (patch.mood !== undefined) db.mood = patch.mood;
  if (patch.energy !== undefined) db.energy = patch.energy;
  if (patch.tags !== undefined) db.tags = patch.tags;
  if (patch.conversationId !== undefined) db.conversation_id = patch.conversationId;
  if (patch.morningData !== undefined) db.morning_data = patch.morningData as unknown as Record<string, unknown>;
  if (patch.eveningData !== undefined) db.evening_data = patch.eveningData as unknown as Record<string, unknown>;
  if (patch.weeklyData !== undefined) db.weekly_data = patch.weeklyData as unknown as Record<string, unknown>;
  if (patch.memoBody !== undefined) db.memo_body = patch.memoBody;
  return db;
}

export function useRecords() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingDummy, setUsingDummy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await fetchRecords();
      setRecords(rows.map(toRecordItem));
      setUsingDummy(false);
    } catch (e) {
      console.warn('[useRecords] Supabase 연결 실패, 더미 데이터 사용:', e);
      setRecords(dummyRecords);
      setUsingDummy(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (data: Omit<RecordItem, 'id' | 'createdAt'> & { id?: string }) => {
    if (usingDummy) {
      const newItem: RecordItem = {
        ...data,
        id: data.id || Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
      setRecords((prev) => [newItem, ...prev]);
      return;
    }
    try {
      const dbData: Omit<RecordRow, 'id' | 'created_at'> = {
        record_type: data.recordType,
        title: data.title,
        date: data.date,
        time: data.time,
        mood: data.mood,
        energy: data.energy,
        tags: data.tags,
        conversation_id: data.conversationId,
        morning_data: data.morningData as unknown as Record<string, unknown>,
        evening_data: data.eveningData as unknown as Record<string, unknown>,
        weekly_data: data.weeklyData as unknown as Record<string, unknown>,
        memo_body: data.memoBody,
      };
      const row = await addRecord(dbData);
      setRecords((prev) => [toRecordItem(row), ...prev]);
    } catch (e) {
      console.error('[useRecords] 추가 실패:', e);
    }
  }, [usingDummy]);

  const update = useCallback(async (id: string, patch: Partial<RecordItem>) => {
    const prev = records;
    setRecords((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    if (!usingDummy) {
      try {
        const dbPatch = toDbFields(patch);
        if (Object.keys(dbPatch).length > 0) {
          await updateRecord(id, dbPatch);
        }
      } catch (e) {
        console.error('[useRecords] 업데이트 실패:', e);
        setRecords(prev);
      }
    }
  }, [records, usingDummy]);

  const remove = useCallback(async (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (!usingDummy) {
      try {
        await deleteRecord(id);
      } catch (e) {
        console.error('[useRecords] 삭제 실패:', e);
        load();
      }
    }
  }, [usingDummy, load]);

  return { records, setRecords, loading, add, update, remove, reload: load };
}
