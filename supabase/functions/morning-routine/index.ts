/**
 * @file supabase/functions/morning-routine/index.ts
 * @description 아침 루틴 체크 알림 (매일 9시 KST)
 * - "오늘 루틴을 확인해보세요"
 * - Cron: 0 0 * * * (UTC) = 9:00 KST
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  getSubscribedUserIds, checkPreference,
  isAlreadySent, logNotification, sendPushToUser,
} from '../_shared/push.ts';
import { getKSTDateString } from '../_shared/kst.ts';

Deno.serve(async () => {
  const supabase = getSupabaseAdmin();
  const today = getKSTDateString();
  const userIds = await getSubscribedUserIds(supabase);
  let sentCount = 0;

  for (const userId of userIds) {
    if (!(await checkPreference(supabase, userId, 'morning_routine'))) continue;
    if (await isAlreadySent(supabase, userId, 'morning_routine', today)) continue;

    await logNotification(supabase, userId, 'morning_routine', today);
    await sendPushToUser(supabase, userId, {
      title: '루틴 체크 ✅',
      body: '오늘 루틴을 확인해보세요',
      tag: `routine-${today}`,
      url: '/tasks',
    });
    sentCount++;
  }

  return new Response(JSON.stringify({ ok: true, sent: sentCount }));
});
