/**
 * @file supabase/functions/overdue-tasks/index.ts
 * @description 미완료 할일 알림 (매일 22:00 KST)
 * - "아직 못 한 일이 있어요"
 * - Cron: 0 13 * * * (UTC) = 22:00 KST
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
    if (!(await checkPreference(supabase, userId, 'task_overdue'))) continue;

    const refKey = `overdue-${today}`;
    if (await isAlreadySent(supabase, userId, 'task_overdue', refKey)) continue;

    // 마감일이 오늘 이전이고 미완료인 할일
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .lt('due_date', today)
      .neq('status', 'done');

    if (!count) continue;

    await logNotification(supabase, userId, 'task_overdue', refKey);
    await sendPushToUser(supabase, userId, {
      title: '미완료 알림',
      body: `아직 못 한 일 ${count}개가 있어요`,
      tag: `overdue-${today}`,
      url: '/tasks',
    });
    sentCount++;
  }

  return new Response(JSON.stringify({ ok: true, sent: sentCount }));
});
