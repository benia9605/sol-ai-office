import { isDemoMode } from "@/lib/demo/mode";
import { supabase } from "@/lib/supabase";

/**
 * Web Push 클라이언트 모듈. Service Worker 는 `public/sw.js`.
 *
 * 흐름:
 *  1) `registerServiceWorker()` 를 앱 부팅 시 호출 (main.tsx)
 *  2) 사용자가 프로필에서 "알림 켜기" → `subscribePush()` 호출
 *  3) `notification_prefs` 의 토글로 종류별 ON/OFF 관리
 *
 * 데모 모드에서는 모든 함수가 no-op (Supabase 연결이 없으므로).
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function permissionState(): NotificationPermission | "unsupported" {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

let swReady = false;
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (swReady) return;
  swReady = true;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      console.warn("[meetup] SW register failed", e);
    });
  });
}

export async function hasActiveSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

export async function subscribePush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (isDemoMode()) return false;
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[meetup] VITE_VAPID_PUBLIC_KEY 가 비어있어 구독을 건너뜁니다.");
    return false;
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          .buffer as ArrayBuffer,
      });
    }
    const json = sub.toJSON();
    const endpoint = sub.endpoint;
    const p256dh = json.keys?.p256dh ?? "";
    const auth = json.keys?.auth ?? "";
    if (!endpoint || !p256dh || !auth) return false;

    const { error } = await supabase!
      .from("push_subscriptions")
      .upsert(
        { user_id: userId, endpoint, p256dh, auth },
        { onConflict: "user_id,endpoint" },
      );
    return !error;
  } catch (e) {
    console.error("[meetup] subscribePush error", e);
    return false;
  }
}

export async function unsubscribePush(userId: string): Promise<void> {
  if (!isPushSupported()) return;
  if (isDemoMode()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase!
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (e) {
    console.error("[meetup] unsubscribePush error", e);
  }
}

// ============================================================
// Preferences
// ============================================================

export const NOTIFICATION_TYPES = [
  { key: "join_request",         label: "가입 신청",       desc: "운영자에게 도착하는 신청 알림 (운영자만)" },
  { key: "join_approved",        label: "가입 수락",       desc: "내 가입이 승인되었을 때" },
  { key: "member_joined",        label: "새 멤버 입장",    desc: "새 멤버가 합류했을 때" },
  { key: "new_meeting",          label: "새 일정",         desc: "새 일정이 등록되었을 때" },
  { key: "new_note",             label: "새 회의록",       desc: "새 회의록이 작성되었을 때" },
  { key: "new_task",             label: "새 할일",         desc: "내가 담당으로 지정된 할일" },
  { key: "task_completed",       label: "할일 완료",       desc: "멤버가 할일을 완료했을 때" },
  { key: "new_insight",          label: "새 인사이트",     desc: "새 인사이트가 공유되었을 때" },
  { key: "new_writing",          label: "새 글쓰기",       desc: "공개된 새 글이 올라왔을 때" },
  { key: "new_reading",          label: "새 챌린지",       desc: "공개된 새 챌린지 / 완독" },
  { key: "new_agenda",           label: "새 안건·투표",    desc: "새 안건이 올라왔을 때" },
  { key: "new_notice",           label: "새 공지",         desc: "새 공지사항이 올라왔을 때" },
  { key: "attendance_reported",  label: "지각·불참",       desc: "멤버가 지각 / 불참을 알렸을 때 (운영자만)" },
  { key: "guest_application",    label: "게스트 신청",     desc: "딴길청년 인터뷰 신청이 도착했을 때" },
  { key: "comment",              label: "댓글",            desc: "내 글 · 노트 · 안건에 새 댓글" },
  { key: "like",                 label: "좋아요",          desc: "내 글 · 노트에 좋아요" },
  { key: "dev_message",          label: "개발자에게 한마디", desc: "오류 제보 · 건의가 도착했을 때 (운영자만)" },
] as const;

export type NotificationTypeKey = (typeof NOTIFICATION_TYPES)[number]["key"];

export type NotificationPrefsRow = {
  user_id: string;
  enabled: boolean;
  preferences: Partial<Record<NotificationTypeKey, boolean>>;
  updated_at: string;
};

export async function getMyPrefs(
  userId: string,
): Promise<NotificationPrefsRow | null> {
  if (isDemoMode()) {
    return {
      user_id: userId,
      enabled: true,
      preferences: {},
      updated_at: new Date().toISOString(),
    };
  }
  const { data } = await supabase!
    .from("notification_prefs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as NotificationPrefsRow | null) ?? null;
}

export async function saveMyPrefs(
  userId: string,
  patch: { enabled?: boolean; preferences?: Partial<Record<NotificationTypeKey, boolean>> },
): Promise<NotificationPrefsRow | null> {
  if (isDemoMode()) return null;
  const { data } = await supabase!
    .from("notification_prefs")
    .upsert(
      {
        user_id: userId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();
  return (data as NotificationPrefsRow | null) ?? null;
}

// ============================================================
// Admin (workspace) settings
// ============================================================

export type NotificationAdminRow = {
  workspace_id: string;
  enabled: Record<NotificationTypeKey, boolean>;
  updated_at: string;
};

export async function getAdminSettings(
  workspaceId: string,
): Promise<NotificationAdminRow | null> {
  if (isDemoMode()) {
    return {
      workspace_id: workspaceId,
      enabled: Object.fromEntries(
        NOTIFICATION_TYPES.map((t) => [t.key, t.key !== "like"]),
      ) as Record<NotificationTypeKey, boolean>,
      updated_at: new Date().toISOString(),
    };
  }
  const { data } = await supabase!
    .from("notification_admin")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return (data as NotificationAdminRow | null) ?? null;
}

export async function saveAdminSettings(
  workspaceId: string,
  enabled: Record<NotificationTypeKey, boolean>,
): Promise<NotificationAdminRow | null> {
  if (isDemoMode()) return null;
  const { data } = await supabase!
    .from("notification_admin")
    .upsert(
      {
        workspace_id: workspaceId,
        enabled,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id" },
    )
    .select()
    .single();
  return (data as NotificationAdminRow | null) ?? null;
}

// ============================================================
// Helpers
// ============================================================

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}
