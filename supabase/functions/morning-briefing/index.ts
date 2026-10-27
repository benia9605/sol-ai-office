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

    // 브랜드 오피스 (hq_tasks) - 오늘까지인 내 담당 · 공동 할 일
    const { data: ms } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', userId);
    const wsIds = ((ms ?? []) as { workspace_id: string }[]).map((m) => m.workspace_id);
    let brandCount = 0;
    if (wsIds.length) {
      const { data: rows } = await supabase
        .from('hq_tasks')
        .select('due_date')
        .in('workspace_id', wsIds)
        .eq('status', 'open')
        .or(`assignee_user_id.eq.${userId},assignee_shared.eq.true`);
      brandCount = ((rows ?? []) as { due_date: string | null }[]).filter((t) => !t.due_date || t.due_date <= today).length;
    }

    // 셋 다 0이면 알림 스킵
    if (!scheduleCount && !taskCount && !brandCount) continue;

    const parts: string[] = [];
    if (scheduleCount) parts.push(`일정 ${scheduleCount}개`);
    if (taskCount) parts.push(`할일 ${taskCount}개`);
    if (brandCount) parts.push(`오피스 할 일 ${brandCount}개`);

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
