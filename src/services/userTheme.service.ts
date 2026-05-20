/**
 * @file src/services/userTheme.service.ts
 * @description 유저 테마 저장/조회 (user_profiles.active_theme 컬럼)
 * - 비로그인 / 프로필 없는 경우는 무시 (localStorage가 fallback 역할)
 * - 변경 가이드: docs/THEME_SYSTEM_PLAN.md
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import type { Theme } from '../hooks/useUserProfile';

/** DB에서 active_theme 조회. 실패하거나 없으면 null */
export async function fetchActiveTheme(): Promise<Theme | null> {
  try {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('active_theme')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.warn('[userTheme] fetch 실패:', error);
      return null;
    }
    const theme = data?.active_theme as Theme | undefined;
    return theme === 'modi' || theme === 'modern' ? theme : null;
  } catch (e) {
    console.warn('[userTheme] fetch 예외:', e);
    return null;
  }
}

/** active_theme 업데이트. 비로그인이거나 프로필 없으면 조용히 실패 */
export async function setActiveTheme(theme: Theme): Promise<boolean> {
  try {
    const userId = await getCurrentUserId();
    const { error } = await supabase
      .from('user_profiles')
      .update({ active_theme: theme, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.warn('[userTheme] update 실패:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[userTheme] update 예외:', e);
    return false;
  }
}
