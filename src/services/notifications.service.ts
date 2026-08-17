/**
 * @file src/services/notifications.service.ts
 * @description 인앱 알림센터 — 내 인박스 조회·읽음·삭제 (마이그 039)
 * - notify Edge Function 이 발송 대상마다 notifications 행을 기록 → 벨 아이콘이 렌더.
 * - RLS: 본인 것만. (푸시를 못 받아도 여기서 놓친 알림 확인)
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { AppNotification } from '../types';

const toNotif = (r: any): AppNotification => ({
  id: r.id, workspaceId: r.workspace_id, type: r.type, title: r.title,
  body: r.body ?? undefined, url: r.url ?? undefined, actorId: r.actor_id ?? undefined,
  readAt: r.read_at ?? null, createdAt: r.created_at,
});

/** 내 알림 목록 (워크스페이스 스코프, 최신순) */
export async function fetchNotifications(workspaceId: string, limit = 30): Promise<AppNotification[]> {
  const uid = await getCurrentUserId().catch(() => null);
  if (!uid) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', uid)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map(toNotif);
}

export async function markRead(id: string): Promise<void> {
  try { await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id); } catch { /* 무시 */ }
}

export async function markAllRead(workspaceId: string): Promise<void> {
  const uid = await getCurrentUserId().catch(() => null);
  if (!uid) return;
  try {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() })
      .eq('user_id', uid).eq('workspace_id', workspaceId).is('read_at', null);
  } catch { /* 무시 */ }
}

export async function clearNotification(id: string): Promise<void> {
  try { await supabase.from('notifications').delete().eq('id', id); } catch { /* 무시 */ }
}
