import { useCallback, useState } from "react";

/**
 * 수동 임시저장(localStorage) 훅. **자동 저장 안 함** — 폼에서 `save(snapshot)`
 * 를 명시적으로 호출(임시저장 버튼)할 때만 저장한다.
 *
 * - `draft`: 마운트 시점에 발견된 임시저장본 (없으면 null). "불러오기" 배너로 복원.
 * - `save(value)`: 현재 폼 스냅샷을 저장 + `savedAt` 갱신.
 * - `clear()`: 임시저장 삭제 (실제 저장 성공 시 호출).
 *
 * key 가 사용자/문서별로 분리되도록 호출부에서 구성한다 (예: `task-draft:{id}:{uid}`).
 */
export function useDraft<T>(key: string | null) {
  const [draft] = useState<T | null>(() => {
    if (!key || typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  });
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const save = useCallback(
    (value: T) => {
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify(value));
        setSavedAt(Date.now());
      } catch {
        /* quota / private mode — 무시 */
      }
    },
    [key],
  );

  const clear = useCallback(() => {
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {
      /* 무시 */
    }
  }, [key]);

  return { draft, save, clear, savedAt };
}
