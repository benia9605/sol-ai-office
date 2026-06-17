/**
 * @file src/services/auth.ts
 * @description 인증 서비스
 * - Google OAuth 로그인/로그아웃
 * - 현재 유저 ID 조회 헬퍼
 */
import { supabase } from './supabase';

// uid 메모리 캐시 — 서비스 호출마다 getUser()를 치지 않도록 (요청 수·egress 절감)
let cachedUserId: string | null = null;

/** 현재 로그인된 유저 ID 반환 (미인증 시 throw) */
export async function getCurrentUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  cachedUserId = user.id;
  return user.id;
}

/** 로그인/로그아웃·계정 전환 시 캐시 무효화 (auth 상태 변경에 자동 반응) */
supabase.auth?.onAuthStateChange?.((_event: unknown, session: { user?: { id?: string } } | null) => {
  cachedUserId = session?.user?.id ?? null;
});

/** Google OAuth 로그인 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
  if (error) throw error;
}

/** 로그아웃 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
