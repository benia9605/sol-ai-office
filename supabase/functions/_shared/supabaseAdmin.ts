/**
 * @file supabase/functions/_shared/supabaseAdmin.ts
 * @description Supabase Admin 클라이언트 (service_role 키 사용)
 * - Edge Function 전용, RLS 우회
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}
