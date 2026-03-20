/**
 * @file src/hooks/useAuth.ts
 * @description 인증 상태 관리 훅
 * - Supabase 세션 확인 + 상태 변화 리스너
 * - localStorage 기반 세션 유지 (자동 로그인)
 * - isConfigured false면 즉시 loading 해제 (mock 모드)
 */
import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, isConfigured } from '../services/supabase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) {
      // Mock 모드: 가짜 유저로 즉시 로딩 완료
      setUser({ id: 'dev', email: 'dev@test.com' } as any);
      setLoading(false);
      return;
    }

    // 저장된 세션 확인 (자동 로그인)
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Auth 상태 변화 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: any, session: any) => {
        setUser(session?.user ?? null);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
