/**
 * @file src/contexts/ThemeContext.tsx
 * @description 테마 컨텍스트 — 모디(기본) / 모던(MUJI톤) 전환
 * - 초기값 우선순위: localStorage > DB(user_profiles.active_theme) > 'modi'
 * - 변경 시 부수효과:
 *   1. document.documentElement.dataset.theme = next
 *   2. localStorage 저장 (즉시 반영)
 *   3. DB 비동기 업데이트 (비로그인은 조용히 무시)
 *   4. 'modern' 테마일 때 Pretendard 웹폰트 동적 로드
 * - 가이드: docs/THEME_SYSTEM_PLAN.md
 */
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Theme } from '../hooks/useUserProfile';
import { fetchActiveTheme, setActiveTheme as persistTheme } from '../services/userTheme.service';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (next: Theme) => void;
  ready: boolean;   // DB 로드 완료 여부 (FOUC 방지용 — 필요 시)
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'sol-theme';
const PRETENDARD_LINK_ID = 'pretendard-font';
const PRETENDARD_URL = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css';

function readLocalStorage(): Theme | null {
  if (typeof window === 'undefined') return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'modi' || v === 'modern' ? v : null;
}

function applyDOMTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
}

function loadPretendardOnce() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PRETENDARD_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = PRETENDARD_LINK_ID;
  link.rel = 'stylesheet';
  link.href = PRETENDARD_URL;
  document.head.appendChild(link);
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // 초기 상태는 localStorage 또는 'modern'(기본). 깜빡임 최소화를 위해 동기 결정.
  const [theme, setThemeState] = useState<Theme>(() => readLocalStorage() ?? 'modern');
  const [ready, setReady] = useState(false);

  // 마운트 시 DOM 즉시 반영 (FOUC 최소화)
  useEffect(() => {
    applyDOMTheme(theme);
    if (theme === 'modern') loadPretendardOnce();
    // localStorage에 값 없으면 기본값 저장
    if (typeof window !== 'undefined' && !window.localStorage.getItem(STORAGE_KEY)) {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DB와 동기화 — localStorage 값과 다르면 DB값을 신뢰
  useEffect(() => {
    let cancelled = false;
    fetchActiveTheme().then((dbTheme) => {
      if (cancelled) return;
      if (dbTheme && dbTheme !== theme) {
        setThemeState(dbTheme);
        applyDOMTheme(dbTheme);
        if (dbTheme === 'modern') loadPretendardOnce();
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, dbTheme);
        }
      }
      setReady(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyDOMTheme(next);
    if (next === 'modern') loadPretendardOnce();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
    // 비동기 DB 업데이트 (실패해도 UI는 그대로)
    persistTheme(next).catch(() => {});
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
