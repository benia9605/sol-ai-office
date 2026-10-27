/**
 * @file supabase/functions/overdue-tasks/index.ts
 * @description 미완료 할일 알림 (매일 22:00 KST)
 * - "아직 못 한 일이 있어요"
 * - Cron: 0 13 * * * (UTC) = 22:00 KST (마이그 071 에서 맞춤 - 그 전엔 00:05 였다)
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

  // ── 브랜드 오피스 (hq_tasks) - 오늘까지인데 못 끝낸 내 담당 · 공동 할 일. 워크스페이스마다 한 번 ──
  for (const userId of userIds) {
    if (!(await checkPreference(supabase, userId, 'task_overdue'))) continue;
    const { data: ms } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', userId);
    for (const { workspace_id: ws } of (ms ?? []) as { workspace_id: string }[]) {
      const { data: rows } = await supabase
        .from('hq_tasks')
        .select('due_date')
        .eq('workspace_id', ws)
        .eq('status', 'open')
        .or(`assignee_user_id.eq.${userId},assignee_shared.eq.true`);
      const count = ((rows ?? []) as { due_date: string | null }[]).filter((t) => !t.due_date || t.due_date <= today).length;
      if (!count) continue;

      const refKey = `hq-overdue-${today}-${ws}`;
      if (await isAlreadySent(supabase, userId, 'task_overdue', refKey)) continue;
      const { data: w } = await supabase.from('workspaces').select('name').eq('id', ws).maybeSingle();
      const title = `미완료 알림 · ${(w as { name?: string } | null)?.name ?? '오피스'}`;
      const body = `오늘 못 끝낸 할 일 ${count}개가 있어요`;
      const url = `/w/${ws}/tasks`;
      await logNotification(supabase, userId, 'task_overdue', refKey);
      try {
        await supabase.from('notifications').insert({ workspace_id: ws, user_id: userId, type: 'task_overdue', title, body, url });
      } catch (_) { /* 인박스 실패 무시 */ }
      await sendPushToUser(supabase, userId, { title, body, tag: `hq-overdue-${today}-${ws}`, url });
      sentCount++;
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: sentCount }));
});
