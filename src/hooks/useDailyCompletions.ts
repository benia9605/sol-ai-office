/**
 * @file src/hooks/useDailyCompletions.ts
 * @description 매일 루틴 완료 상태 관리 (Supabase 연동)
 * - Supabase daily_completions 테이블 사용
 * - Supabase 실패 시 localStorage 폴백
 * - visibilitychange로 자정 넘김 감지
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchTodayCompletions,
  addDailyCompletion,
  removeDailyCompletion,
} from '../services/dailyCompletions.service';

const STORAGE_KEY_PREFIX = 'daily-completions-';

function getTodayKey(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${STORAGE_KEY_PREFIX}${yyyy}-${mm}-${dd}`;
}

function loadLocalToday(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(getTodayKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function useDailyCompletions() {
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [usingLocal, setUsingLocal] = useState(false);
  const dateRef = useRef(getTodayKey());

  // 마운트 시 Supabase에서 오늘 완료 목록 로드
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const taskIds = await fetchTodayCompletions();
        if (cancelled) return;
        const map: Record<string, boolean> = {};
        taskIds.forEach((id) => { map[id] = true; });
        setCompletions(map);
        setUsingLocal(false);
      } catch (e) {
        console.warn('[useDailyCompletions] Supabase 실패, localStorage 폴백:', e);
        if (cancelled) return;
        setCompletions(loadLocalToday());
        setUsingLocal(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 자정 넘김 감지: 탭 포커스 복귀 시 날짜 변경 체크
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return;
      const newKey = getTodayKey();
      if (newKey !== dateRef.current) {
        dateRef.current = newKey;
        if (usingLocal) {
          setCompletions(loadLocalToday());
        } else {
          try {
            const taskIds = await fetchTodayCompletions();
            const map: Record<string, boolean> = {};
            taskIds.forEach((id) => { map[id] = true; });
            setCompletions(map);
          } catch {
            setCompletions({});
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [usingLocal]);

  // localStorage 폴백 모드일 때만 동기화
  useEffect(() => {
    if (usingLocal) {
      localStorage.setItem(dateRef.current, JSON.stringify(completions));
    }
  }, [completions, usingLocal]);

  const toggleCompletion = useCallback(async (taskId: string) => {
    const wasCompleted = !!completions[taskId];

    // 낙관적 UI 업데이트
    setCompletions((prev) => {
      const next = { ...prev };
      if (next[taskId]) {
        delete next[taskId];
      } else {
        next[taskId] = true;
      }
      return next;
    });

    if (!usingLocal) {
      try {
        if (wasCompleted) {
          await removeDailyCompletion(taskId);
        } else {
          await addDailyCompletion(taskId);
        }
      } catch (e) {
        console.error('[useDailyCompletions] 토글 실패:', e);
        // 롤백
        setCompletions((prev) => {
          const next = { ...prev };
          if (wasCompleted) {
            next[taskId] = true;
          } else {
            delete next[taskId];
          }
          return next;
        });
      }
    }
  }, [completions, usingLocal]);

  const isCompletedToday = useCallback((taskId: string): boolean => {
    return !!completions[taskId];
  }, [completions]);

  const completedCount = useCallback((taskIds: string[]): number => {
    return taskIds.filter((id) => completions[id]).length;
  }, [completions]);

  return { completions, toggleCompletion, isCompletedToday, completedCount };
}
