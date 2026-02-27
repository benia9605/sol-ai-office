/**
 * @file src/services/auth.ts
 * @description 인증 서비스
 * - Google OAuth 로그인/로그아웃
 * - 현재 유저 ID 조회 헬퍼
 */
import { supabase } from './supabase';

/** 현재 로그인된 유저 ID 반환 (미인증 시 throw) */
export async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

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
