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
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        // 요청별 하드 타임아웃 — 느린/멈춘 요청이 스피너를 무한정 붙잡거나
        // 브라우저 커넥션 슬롯을 점유해 다른 요청을 뒤에서 대기시키는 것을 막는다.
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 20000); // 20초 상한
          return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
        },
      },
    })
  : createMockClient();
