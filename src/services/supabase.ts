/**
 * @file src/services/supabase.ts
 * @description Supabase 클라이언트 초기화
 * - 환경변수에서 URL, ANON_KEY 읽어 클라이언트 생성
 * - 모든 서비스/훅에서 이 클라이언트를 import하여 사용
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 설정되지 않았습니다.');
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');
