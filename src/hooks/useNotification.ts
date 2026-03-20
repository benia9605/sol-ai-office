/**
 * @file src/hooks/useNotification.ts
 * @description 푸시 알림 상태 관리 훅
 * - 구독 여부, 권한 상태, 알림 설정 토글
 * - enablePush/disablePush/togglePref 제공
 */
import { useState, useEffect, useCallback } from 'react';
import type { NotificationPreferences } from '../types';
import {
  isPushSupported,
  getPermissionState,
  isStandalonePWA,
  hasActiveSubscription,
  subscribePush,
  unsubscribePush,
  fetchNotificationPreferences,
  upsertNotificationPreferences,
  NotificationPreferencesRow,
} from '../services/pushNotification.service';

const DEFAULT_PREFS: NotificationPreferences = {
  taskDeadline: true,
  taskOverdue: true,
  morningRoutine: true,
  scheduleReminder: true,
  morningBriefing: true,
  pomodoroDone: true,
  morningJournal: true,
  eveningJournal: true,
};

/** DB Row → 프론트 타입 변환 */
function toPrefs(row: NotificationPreferencesRow): NotificationPreferences {
  return {
    taskDeadline: row.task_deadline,
    taskOverdue: row.task_overdue,
    morningRoutine: row.morning_routine,
    scheduleReminder: row.schedule_reminder,
    morningBriefing: row.morning_briefing,
    pomodoroDone: row.pomodoro_done,
    morningJournal: row.morning_journal,
    eveningJournal: row.evening_journal,
  };
}

/** 프론트 타입 → DB Row 변환 */
function toRow(prefs: NotificationPreferences) {
  return {
    task_deadline: prefs.taskDeadline,
    task_overdue: prefs.taskOverdue,
    morning_routine: prefs.morningRoutine,
    schedule_reminder: prefs.scheduleReminder,
    morning_briefing: prefs.morningBriefing,
    pomodoro_done: prefs.pomodoroDone,
    morning_journal: prefs.morningJournal,
    evening_journal: prefs.eveningJournal,
  };
}

export function useNotification(userId: string | null) {
  const [supported] = useState(isPushSupported());
  const [standalone] = useState(isStandalonePWA());
  const [permission, setPermission] = useState(getPermissionState());
  const [subscribed, setSubscribed] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 초기 로드
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function load() {
      try {
        setPermission(getPermissionState());
        const active = await hasActiveSubscription();
        if (!cancelled) setSubscribed(active);

        const row = await fetchNotificationPreferences(userId!);
        if (!cancelled && row) setPrefs(toPrefs(row));
      } catch (e) {
        console.warn('[useNotification] Load failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [userId]);

  // 푸시 활성화 (유저 제스처 내에서 호출 필수)
  const enablePush = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    setSaving(true);
    try {
      const ok = await subscribePush(userId);
      if (ok) {
        setSubscribed(true);
        setPermission('granted');
        await upsertNotificationPreferences(userId, toRow(DEFAULT_PREFS));
      } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const perm = getPermissionState();
        if (perm === 'denied') {
          alert(isIOS
            ? '알림 권한이 차단되어 있습니다.\n설정 > Teamie > 알림에서 허용해주세요.'
            : '알림 권한이 차단되어 있습니다.\n브라우저 설정에서 알림을 허용해주세요.');
        } else {
          alert('알림 설정에 실패했습니다. 홈 화면에 추가한 후 다시 시도해주세요.');
        }
        setPermission(perm);
      }
      return ok;
    } catch (e) {
      console.error('[useNotification] enablePush error:', e);
      alert('알림 설정 중 오류가 발생했습니다.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [userId]);

  // 푸시 비활성화
  const disablePush = useCallback(async () => {
    if (!userId) return;
    await unsubscribePush(userId);
    setSubscribed(false);
  }, [userId]);

  // 개별 설정 토글
  const togglePref = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    if (!userId) return;

    // 알림을 켤 때 아직 구독 안 됐으면 먼저 구독
    if (value && !subscribed) {
      setSaving(true);
      const ok = await subscribePush(userId);
      setSaving(false);
      if (!ok) return;
      setSubscribed(true);
      setPermission('granted');
    }

    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    await upsertNotificationPreferences(userId, toRow(newPrefs));
  }, [userId, subscribed, prefs]);

  return {
    supported,
    isStandalone: standalone,
    permission,
    subscribed,
    prefs,
    loading,
    saving,
    enablePush,
    disablePush,
    togglePref,
  };
}
