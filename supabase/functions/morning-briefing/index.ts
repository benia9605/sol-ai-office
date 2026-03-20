/**
 * @file supabase/functions/morning-briefing/index.ts
 * @description 오늘 일정 아침 브리핑 (매일 8시 KST)
 * - 오늘 일정 수 + 긴급 할일 수 요약 알림
 * - Cron: 0 23 * * * (UTC) = 8:00 KST
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
    // 설정 확인
    if (!(await checkPreference(supabase, userId, 'morning_briefing'))) continue;
    // 중복 확인
    if (await isAlreadySent(supabase, userId, 'morning_briefing', today)) continue;

    // 오늘 일정 카운트
    const { count: scheduleCount } = await supabase
      .from('schedules')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('date', today);

    // 미완료 할일 카운트 (status != 'done')
    const { count: taskCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .neq('status', 'done');

    // 둘 다 0이면 알림 스킵
    if (!scheduleCount && !taskCount) continue;

    const parts: string[] = [];
    if (scheduleCount) parts.push(`일정 ${scheduleCount}개`);
    if (taskCount) parts.push(`할일 ${taskCount}개`);

    await logNotification(supabase, userId, 'morning_briefing', today);
    await sendPushToUser(supabase, userId, {
      title: '오늘 브리핑 ☀️',
      body: `${parts.join(', ')} 있어요`,
      tag: `briefing-${today}`,
      url: '/',
    });
    sentCount++;
  }

  return new Response(JSON.stringify({ ok: true, sent: sentCount }));
});
