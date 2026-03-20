/**
 * @file supabase/functions/test-push/index.ts
 * @description 테스트용 푸시 알림 발송
 * - 수동 호출: curl -X POST ... -d '{"user_id":"...","title":"테스트","body":"알림 테스트"}'
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { sendPushToUser } from '../_shared/push.ts';

Deno.serve(async (req) => {
  try {
    const { user_id, title, body, tag, url } = await req.json();
    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const sent = await sendPushToUser(supabase, user_id, {
      title: title || '테스트 알림',
      body: body || 'Teamie 푸시 알림 테스트입니다!',
      tag: tag || 'test',
      url: url || '/',
    });

    return new Response(JSON.stringify({ ok: true, sent }));
  } catch (e) {
    console.error('test-push error:', e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
