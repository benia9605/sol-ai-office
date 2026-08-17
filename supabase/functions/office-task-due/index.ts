/**
 * @file supabase/functions/office-task-due/index.ts
 * @description 오피스 할일 마감 임박 알림 — 담당자(assignee)에게 (매일 아침 KST)
 * - 오늘/내일 마감 + 미완료 + 담당자 지정 + 오피스(workspace_id) 할일을 담당자에게.
 * - 기존 task-deadline(개인 user_id)과 별개. 종류 토글 = notify_task_due.
 * - 중복방지: notification_log(user_id, 'task_due', refKey) 유니크.
 * - Cron 권장: 1 1 * * * (UTC) = 10:01 KST. (task-deadline과 같은 시간대)
 * - 배포: supabase functions deploy office-task-due --project-ref <ref>
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { checkPreference, isAlreadySent, logNotification, sendPushToUser } from '../_shared/push.ts';
import { getKSTDateString, getKSTTomorrowString } from '../_shared/kst.ts';

Deno.serve(async () => {
  const supabase = getSupabaseAdmin();
  const today = getKSTDateString();
  const tomorrow = getKSTTomorrowString();
  let sent = 0;

  // 오늘/내일 마감 + 미완료 + 담당자 있음 + 오피스 할일
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, assignee_id')
    .in('due_date', [today, tomorrow])
    .neq('status', 'done')
    .not('assignee_id', 'is', null)
    .not('workspace_id', 'is', null);

  for (const t of (tasks ?? []) as { id: string; title: string; due_date: string; assignee_id: string }[]) {
    const uid = t.assignee_id;
    if (!(await checkPreference(supabase, uid, 'notify_task_due').catch(() => true))) continue;

    const isDDay = t.due_date === today;
    const refKey = `${isDDay ? 'd0' : 'd1'}-${today}-${t.id}`;
    if (await isAlreadySent(supabase, uid, 'task_due', refKey)) continue;

    await logNotification(supabase, uid, 'task_due', refKey);
    await sendPushToUser(supabase, uid, {
      title: isDDay ? '오늘 마감 🔴' : '마감 D-1 🟡',
      body: isDDay ? `담당 「${t.title}」 오늘까지예요` : `담당 「${t.title}」 내일 마감이에요`,
      tag: `task-due-${t.id}`,
      url: '/office/todos',
    });
    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
