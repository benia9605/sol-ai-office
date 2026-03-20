/**
 * @file supabase/functions/schedule-reminder/index.ts
 * @description 일정 시작 N분전 알림 (5분 간격)
 * - 기존 reminder 필드 ('10min', '30min', '1hour', '1day') 활용
 * - Cron: every 5 minutes (UTC)
 */
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  getSubscribedUserIds, checkPreference,
  isAlreadySent, logNotification, sendPushToUser,
} from '../_shared/push.ts';
import { getKSTDateString, getKSTNow, reminderToMinutes } from '../_shared/kst.ts';

Deno.serve(async () => {
  const supabase = getSupabaseAdmin();
  const today = getKSTDateString();
  const kstNow = getKSTNow();
  const nowMinutes = kstNow.getUTCHours() * 60 + kstNow.getUTCMinutes();
  const userIds = await getSubscribedUserIds(supabase);
  let sentCount = 0;

  for (const userId of userIds) {
    if (!(await checkPreference(supabase, userId, 'schedule_reminder'))) continue;

    // 오늘 일정 중 reminder가 설정된 것 조회
    const { data: schedules } = await supabase
      .from('schedules')
      .select('id, title, date, time, reminder')
      .eq('user_id', userId)
      .eq('date', today)
      .neq('reminder', 'none');

    if (!schedules?.length) continue;

    for (const sch of schedules) {
      if (!sch.time || !sch.reminder) continue;

      const reminderMin = reminderToMinutes(sch.reminder);
      if (reminderMin === 0) continue;

      // 일정 시각을 분으로 변환
      const [h, m] = sch.time.split(':').map(Number);
      const scheduleMinutes = h * 60 + m;

      // 알림 시각 = 일정 시각 - 리마인더 오프셋
      const alertMinutes = scheduleMinutes - reminderMin;

      // 현재 시각이 알림 시각 범위 내인지 (±2.5분, 즉 5분 cron 간격 커버)
      if (Math.abs(nowMinutes - alertMinutes) > 3) continue;

      // 중복 확인
      const refKey = `${today}-${sch.id}`;
      if (await isAlreadySent(supabase, userId, 'schedule_reminder', refKey)) continue;

      // 알림 메시지
      let timeLabel = '';
      if (sch.reminder === '10min') timeLabel = '10분 후';
      else if (sch.reminder === '30min') timeLabel = '30분 후';
      else if (sch.reminder === '1hour') timeLabel = '1시간 후';
      else if (sch.reminder === '1day') timeLabel = '내일';

      await logNotification(supabase, userId, 'schedule_reminder', refKey);
      await sendPushToUser(supabase, userId, {
        title: sch.title,
        body: `${timeLabel} 시작`,
        tag: `schedule-${sch.id}`,
        url: '/schedules',
      });
      sentCount++;
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: sentCount }));
});
