/**
 * @file src/hooks/useInsightSources.ts
 * @description 인사이트 출처 관리 훅
 * - 기본 AI 출처(플래니, 마키 등) + 사용자 정의 출처
 * - Supabase options 테이블 (category='insight_source')에 사용자 정의 출처 영속화
 * - 기기간 동기화 지원
 */
import { useState, useEffect, useCallback } from 'react';
import { InsightSource } from '../types';
import { defaultInsightSources } from '../data';
import { fetchOptionsByCategory, addOption, deleteOption } from '../services/options.service';

const CATEGORY = 'insight_source';

/** DB 기본 출처 ID (options 테이블에 저장하지 않음) */
const DEFAULT_IDS = new Set(defaultInsightSources.map((s) => s.id));

export function useInsightSources() {
  const [sources, setSources] = useState<InsightSource[]>(defaultInsightSources);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await fetchOptionsByCategory(CATEGORY);
      const custom: InsightSource[] = rows.map((r) => ({
        id: r.id,
        label: r.name,
        image: r.emoji || '',
      }));
      setSources([...defaultInsightSources, ...custom]);
    } catch {
      // Supabase 미연결 시 기본값 유지
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addSource = useCallback(async (source: InsightSource) => {
    // 로컬 즉시 반영
    setSources((prev) => [...prev, source]);
    try {
      const row = await addOption({
        category: CATEGORY,
        name: source.label,
        emoji: source.image,
        sort_order: 0,
      });
      // DB에서 받은 실제 ID로 교체
      setSources((prev) =>
        prev.map((s) => (s.id === source.id ? { ...s, id: row.id } : s))
      );
    } catch (e) {
      console.error('[useInsightSources] 추가 실패:', e);
    }
  }, []);

  const removeSource = useCallback(async (id: string) => {
    if (DEFAULT_IDS.has(id)) return; // 기본 출처는 삭제 불가
    setSources((prev) => prev.filter((s) => s.id !== id));
    try {
      await deleteOption(id);
    } catch (e) {
      console.error('[useInsightSources] 삭제 실패:', e);
      load();
    }
  }, [load]);

  return { sources, loaded, addSource, removeSource, setSources };
}
