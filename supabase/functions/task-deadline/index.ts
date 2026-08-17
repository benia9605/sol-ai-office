/**
 * @file supabase/functions/task-deadline/index.ts
 * @description 할일 마감 D-1, D-Day 알림 (매일 10시 KST)
 * - D-Day: 오늘 마감인 미완료 할일
 * - D-1: 내일 마감인 미완료 할일
 * - Cron: 1 1 * * * (UTC) = 10:01 KST
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  getSubscribedUserIds, checkPreference,
  isAlreadySent, logNotification, sendPushToUser,
} from '../_shared/push.ts';
import { getKSTDateString, getKSTTomorrowString } from '../_shared/kst.ts';

Deno.serve(async () => {
  const supabase = getSupabaseAdmin();
  const today = getKSTDateString();
  const tomorrow = getKSTTomorrowString();
  const userIds = await getSubscribedUserIds(supabase);
  let sentCount = 0;

  for (const userId of userIds) {
    if (!(await checkPreference(supabase, userId, 'task_deadline'))) continue;

    // D-Day: 오늘 마감
    const { data: todayTasks } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('user_id', userId)
      .eq('due_date', today)
      .neq('status', 'done');

    // D-1: 내일 마감
    const { data: tomorrowTasks } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('user_id', userId)
      .eq('due_date', tomorrow)
      .neq('status', 'done');

    // D-Day 알림
    if (todayTasks?.length) {
      for (const task of todayTasks) {
        const refKey = `d0-${today}-${task.id}`;
        if (await isAlreadySent(supabase, userId, 'task_deadline', refKey)) continue;

        await logNotification(supabase, userId, 'task_deadline', refKey);
        await sendPushToUser(supabase, userId, {
          title: '오늘 마감 🔴',
          body: `${task.title} 오늘까지!`,
          tag: `deadline-${task.id}`,
          url: '/tasks',
        });
        sentCount++;
      }
    }

    // D-1 알림
    if (tomorrowTasks?.length) {
      for (const task of tomorrowTasks) {
        const refKey = `d1-${today}-${task.id}`;
        if (await isAlreadySent(supabase, userId, 'task_deadline', refKey)) continue;

        await logNotification(supabase, userId, 'task_deadline', refKey);
        await sendPushToUser(supabase, userId, {
          title: '마감 D-1 🟡',
          body: `${task.title} 내일 마감이에요`,
          tag: `deadline-${task.id}`,
          url: '/tasks',
        });
        sentCount++;
      }
    }
  }

  // ── 오피스 할일 마감(담당자 기준) — notify_task_due. 인앱센터에도 기록 ──
  const { data: officeTasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, assignee_id, workspace_id')
    .in('due_date', [today, tomorrow])
    .neq('status', 'done')
    .not('assignee_id', 'is', null)
    .not('workspace_id', 'is', null);

  for (const t of (officeTasks ?? []) as { id: string; title: string; due_date: string; assignee_id: string; workspace_id: string }[]) {
    const uid = t.assignee_id;
    if (!(await checkPreference(supabase, uid, 'notify_task_due').catch(() => true))) continue;
    const isDDay = t.due_date === today;
    const refKey = `office-${isDDay ? 'd0' : 'd1'}-${today}-${t.id}`;
    if (await isAlreadySent(supabase, uid, 'task_due', refKey)) continue;

    await logNotification(supabase, uid, 'task_due', refKey);
    const title = isDDay ? '오늘 마감 🔴' : '마감 D-1 🟡';
    const body = isDDay ? `담당 「${t.title}」 오늘까지예요` : `담당 「${t.title}」 내일 마감이에요`;
    try {
      await supabase.from('notifications').insert({ workspace_id: t.workspace_id, user_id: uid, type: 'notify_task_due', title, body, url: '/office/todos' });
    } catch (_) { /* 인박스 실패 무시 */ }
    await sendPushToUser(supabase, uid, { title, body, tag: `task-due-${t.id}`, url: '/office/todos' });
    sentCount++;
  }

  return new Response(JSON.stringify({ ok: true, sent: sentCount }));
});
