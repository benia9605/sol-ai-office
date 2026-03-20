/**
 * @file src/services/pushNotification.service.ts
 * @description 푸시 알림 서비스
 * - 브라우저 푸시 구독/해지
 * - 알림 설정(preferences) CRUD
 * - 마지막 접속 시간 업데이트
 */
import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// ── DB Row 타입 (snake_case) ──

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface NotificationPreferencesRow {
  id: string;
  user_id: string;
  task_deadline: boolean;
  task_overdue: boolean;
  morning_routine: boolean;
  schedule_reminder: boolean;
  morning_briefing: boolean;
  pomodoro_done: boolean;
  morning_journal: boolean;
  evening_journal: boolean;
  created_at: string;
  updated_at: string;
}

// ── 유틸 ──

/** base64url → Uint8Array (applicationServerKey 변환용) */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

// ── 브라우저 지원 확인 ──

export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPermissionState(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission as 'granted' | 'denied' | 'default';
}

/** PWA standalone 모드 여부 (iOS에서 홈 화면 추가 필수) */
export function isStandalonePWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  );
}

// ── 구독 (Subscribe) ──

export async function subscribePush(userId: string): Promise<boolean> {
  try {
    if (!VAPID_PUBLIC_KEY) {
      console.error('[Push] VAPID_PUBLIC_KEY not configured — Replit Secrets에 VITE_VAPID_PUBLIC_KEY를 추가하세요');
      return false;
    }

    const perm = await Notification.requestPermission();
    console.log('[Push] Permission result:', perm);
    if (perm !== 'granted') return false;

    const reg = await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
    }

    const json = sub.toJSON();
    const endpoint = sub.endpoint;
    const p256dh = json.keys?.p256dh || '';
    const auth = json.keys?.auth || '';

    if (!endpoint || !p256dh || !auth) return false;

    const { error } = await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint, p256dh, auth },
      { onConflict: 'user_id,endpoint' }
    );

    return !error;
  } catch (e) {
    console.error('[Push] subscribePush error:', e);
    return false;
  }
}

// ── 해지 (Unsubscribe) ──

export async function unsubscribePush(userId: string): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', sub.endpoint);

      await sub.unsubscribe();
    }
  } catch (e) {
    console.error('[Push] unsubscribePush error:', e);
  }
}

// ── 구독 상태 확인 ──

export async function hasActiveSubscription(): Promise<boolean> {
  try {
    if (!isPushSupported()) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

// ── 알림 설정 (Notification Preferences) ──

const DEFAULT_PREFS: Omit<NotificationPreferencesRow, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  task_deadline: true,
  task_overdue: true,
  morning_routine: true,
  schedule_reminder: true,
  morning_briefing: true,
  pomodoro_done: true,
  morning_journal: true,
  evening_journal: true,
};

export async function fetchNotificationPreferences(
  userId: string
): Promise<NotificationPreferencesRow | null> {
  const { data } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return data || null;
}

export async function upsertNotificationPreferences(
  userId: string,
  prefs: Partial<Omit<NotificationPreferencesRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
): Promise<void> {
  await supabase.from('notification_preferences').upsert(
    { user_id: userId, ...DEFAULT_PREFS, ...prefs },
    { onConflict: 'user_id' }
  );
}

// ── 마지막 접속 시간 업데이트 ──

export async function updateLastAccess(userId: string): Promise<void> {
  await supabase
    .from('user_profiles')
    .update({ last_access_at: new Date().toISOString() })
    .eq('user_id', userId);
}
