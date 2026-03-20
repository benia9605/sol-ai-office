/**
 * @file src/services/supabase.ts
 * @description Supabase 클라이언트 초기화
 * - 환경변수에서 URL, ANON_KEY 읽어 클라이언트 생성
 * - 환경변수 비어있으면 mock 클라이언트로 대체 (로컬 개발용)
 * - 모든 서비스/훅에서 이 클라이언트를 import하여 사용
 */
import { createClient } from '@supabase/supabase-js';
import { createMockClient } from './mockSupabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/** Supabase 환경변수가 설정되어 있는지 (false면 mock 모드) */
export const isConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
  console.warn('[Supabase] Mock 모드로 실행됩니다. (VITE_SUPABASE_URL 미설정)');
}

export const supabase: any = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockClient();
