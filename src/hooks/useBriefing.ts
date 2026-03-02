/**
 * @file src/hooks/useBriefing.ts
 * @description 모디 아침 브리핑 데이터 훅
 * - 홈 진입 시 자동 로드 (일정/할일/프로젝트/AI 한마디)
 * - refresh로 AI 한마디 재생성
 */
import { useState, useEffect, useCallback } from 'react';
import { BriefingData, loadBriefing } from '../services/briefing.service';

export function useBriefing() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await loadBriefing();
        if (!cancelled) setBriefing(data);
      } catch (e) {
        console.warn('[useBriefing] 브리핑 로드 실패:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadBriefing(true);
      setBriefing(data);
    } catch (e) {
      console.warn('[useBriefing] 브리핑 새로고침 실패:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { briefing, loading, refresh };
}
