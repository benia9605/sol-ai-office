/**
 * @file src/hooks/useInsights.ts
 * @description 인사이트 데이터 관리 훅
 * - Supabase 연동 (insights 테이블)
 * - Supabase 미설정 시 더미 데이터 폴백
 * - 낙관적 업데이트 + 에러 롤백
 */
import { useState, useEffect, useCallback } from 'react';
import { InsightItem } from '../types';
import { dummyInsights } from '../data';
import {
  fetchInsights, addInsight, updateInsight, deleteInsight, InsightRow,
} from '../services/insights.service';

/** DB 행 → 프론트 타입 변환 */
function toInsightItem(row: InsightRow): InsightItem {
  // created_at은 ISO 타임스탬프 → 날짜/시간 분리
  const dateStr = row.created_at?.slice(0, 10) ?? '';
  let timeStr: string | undefined;
  if (row.created_at) {
    const d = new Date(row.created_at);
    timeStr = d.toTimeString().slice(0, 5); // HH:MM (로컬 시간)
  }
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    source: row.source,
    link: row.link,
    tags: row.tags ?? [],
    createdAt: dateStr,
    time: timeStr,
    project: row.project,
  };
}

/** 날짜 + 시간을 ISO 타임스탬프로 합치기 */
function combineDateTime(date?: string, time?: string): string | undefined {
  if (!date) return undefined;
  if (time) return `${date}T${time}:00`;
  return `${date}T00:00:00`;
}

/** 프론트 → DB 필드 변환 */
function toDbFields(patch: Partial<InsightItem>): Partial<InsightRow> {
  const db: Partial<InsightRow> = {};
  if (patch.title !== undefined) db.title = patch.title;
  if (patch.content !== undefined) db.content = patch.content;
  if (patch.source !== undefined) db.source = patch.source;
  if (patch.link !== undefined) db.link = patch.link || undefined;
  if (patch.tags !== undefined) db.tags = patch.tags;
  if (patch.project !== undefined) db.project = patch.project || undefined;
  if (patch.createdAt !== undefined || patch.time !== undefined) {
    db.created_at = combineDateTime(patch.createdAt, patch.time);
  }
  return db;
}

export function useInsights() {
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingDummy, setUsingDummy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await fetchInsights();
      setInsights(rows.map(toInsightItem));
      setUsingDummy(false);
    } catch (e) {
      console.warn('[useInsights] Supabase 연결 실패, 더미 데이터 사용:', e);
      setInsights(dummyInsights);
      setUsingDummy(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = useCallback(async (data: Omit<InsightItem, 'id'> & { conversation_id?: string }) => {
    if (usingDummy) {
      const newItem: InsightItem = { ...data, id: Date.now().toString() };
      setInsights((prev) => [newItem, ...prev]);
      return;
    }
    try {
      const row = await addInsight({
        title: data.title,
        content: data.content,
        source: data.source,
        link: data.link,
        tags: data.tags,
        project: data.project,
        created_at: combineDateTime(data.createdAt, data.time),
        conversation_id: data.conversation_id,
      });
      setInsights((prev) => [toInsightItem(row), ...prev]);
    } catch (e) {
      console.error('[useInsights] 추가 실패:', e);
    }
  }, [usingDummy]);

  const update = useCallback(async (id: string, patch: Partial<InsightItem>) => {
    const prev = insights;
    setInsights((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));

    if (!usingDummy) {
      try {
        const dbPatch = toDbFields(patch);
        if (Object.keys(dbPatch).length > 0) {
          await updateInsight(id, dbPatch);
        }
      } catch (e) {
        console.error('[useInsights] 업데이트 실패:', e);
        setInsights(prev);
      }
    }
  }, [insights, usingDummy]);

  const remove = useCallback(async (id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
    if (!usingDummy) {
      try {
        await deleteInsight(id);
      } catch (e) {
        console.error('[useInsights] 삭제 실패:', e);
        load();
      }
    }
  }, [usingDummy, load]);

  return { insights, setInsights, loading, add, update, remove, reload: load };
}
