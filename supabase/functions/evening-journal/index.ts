/**
 * @file supabase/functions/evening-journal/index.ts
 * @description 저녁 일기 리마인더 (매일 21시 KST)
 * - 오늘 저녁 일기(type='evening')를 안 쓴 유저에게 알림
 * - Cron: 0 12 * * * (UTC) = 21:00 KST
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
    if (!(await checkPreference(supabase, userId, 'evening_journal'))) continue;

    const refKey = `evening-journal-${today}`;
    if (await isAlreadySent(supabase, userId, 'evening_journal', refKey)) continue;

    // 오늘 저녁 일기가 있는지 확인
    const { count } = await supabase
      .from('journals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('date', today)
      .eq('type', 'evening');

    if (count && count > 0) continue;

    await logNotification(supabase, userId, 'evening_journal', refKey);
    await sendPushToUser(supabase, userId, {
      title: '저녁 일기 🌇',
      body: '오늘 하루를 정리해보세요',
      tag: `evening-journal-${today}`,
      url: '/records',
    });
    sentCount++;
  }

  return new Response(JSON.stringify({ ok: true, sent: sentCount }));
});
