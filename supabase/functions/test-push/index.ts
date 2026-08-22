/**
 * @file supabase/functions/test-push/index.ts
 * @description 테스트용 푸시 알림 발송
 * - 브라우저에서 supabase.functions.invoke()로 호출
 * - 수동 호출: curl -X POST ... -d '{"user_id":"...","title":"테스트","body":"알림 테스트"}'
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { sendPushToUser } from '../_shared/push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, tag, url } = await req.json();

    const supabase = getSupabaseAdmin();
    // 로그인 유저가 호출하면 '본인에게만' 테스트 푸시 (남에게 위장 푸시 방지).
    // 서버(service-role) 호출은 user가 없으므로 body.user_id 그대로.
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    let callerId: string | null = null;
    try { const { data } = await supabase.auth.getUser(token); callerId = data?.user?.id ?? null; } catch { callerId = null; }
    const targetUser = callerId || user_id;
    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sent = await sendPushToUser(supabase, targetUser, {
      title: title || '테스트 알림',
      body: body || 'Teamie 푸시 알림 테스트입니다!',
      tag: tag || 'test',
      url: url || '/',
    });

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('test-push error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
