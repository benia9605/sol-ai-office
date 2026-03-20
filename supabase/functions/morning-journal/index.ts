/**
 * @file supabase/functions/morning-journal/index.ts
 * @description 아침 일기 리마인더 (매일 9시 KST)
 * - 오늘 아침 일기(type='morning')를 안 쓴 유저에게 알림
 * - Cron: 5 0 * * * (UTC) = 09:05 KST (morning-routine과 5분 간격)
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
    if (!(await checkPreference(supabase, userId, 'morning_journal'))) continue;

    const refKey = `morning-journal-${today}`;
    if (await isAlreadySent(supabase, userId, 'morning_journal', refKey)) continue;

    // 오늘 아침 일기가 있는지 확인
    const { count } = await supabase
      .from('journals')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('date', today)
      .eq('type', 'morning');

    if (count && count > 0) continue;

    await logNotification(supabase, userId, 'morning_journal', refKey);
    await sendPushToUser(supabase, userId, {
      title: '아침 일기 🌿',
      body: '오늘 아침 일기를 써보세요',
      tag: `morning-journal-${today}`,
      url: '/records',
    });
    sentCount++;
  }

  return new Response(JSON.stringify({ ok: true, sent: sentCount }));
});
