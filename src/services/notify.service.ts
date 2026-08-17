/**
 * @file src/services/notify.service.ts
 * @description 이벤트 알림 클라이언트 래퍼 (Phase 1)
 * - 도메인(할일·일정·콘텐츠)에서 변경 후 notify() 한 줄만 부른다.
 * - best-effort: 절대 throw 하지 않음(알림 실패로 저장이 롤백되면 안 됨 — 가이드 원칙 1).
 * - 정책(누구에게·보낼지)은 전부 서버(notify Edge Function + notification_preferences)에 있다.
 */
import { supabase } from './supabase';

export type NotifyType =
  | 'notify_task_assigned'
  | 'notify_task_completed'
  | 'notify_schedule'
  | 'notify_content'
  | 'notify_comment'
  | 'notify_like';

export interface NotifyParams {
  type: NotifyType;
  workspaceId: string;
  actorId?: string | null;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  /** 특정 수신자(배정→담당자 등). 없으면 워크스페이스 전체 멤버 */
  targetUserIds?: string[];
}

/** notify Edge Function 호출 — 실패해도 조용히 무시 */
export async function notify(p: NotifyParams): Promise<void> {
  // 개인 워크스페이스거나 수신자가 나뿐이면 서버가 알아서 0명 처리하지만, 호출 자체를 아낀다.
  try {
    await supabase.functions.invoke('notify', {
      body: {
        type: p.type,
        workspace_id: p.workspaceId,
        actor_id: p.actorId ?? null,
        title: p.title,
        body: p.body,
        url: p.url,
        tag: p.tag,
        target_user_ids: p.targetUserIds,
      },
    });
  } catch (e) {
    console.warn('[notify] invoke failed(무시):', e);
  }
}

/** 푸시 문구에 쓸 표시 이름 — workspace_members.nickname → '누군가' */
export async function getActorName(workspaceId: string, userId?: string | null): Promise<string> {
  if (!userId) return '누군가';
  try {
    const { data } = await supabase
      .from('workspace_members')
      .select('nickname')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle();
    const nick = (data as { nickname?: string } | null)?.nickname?.trim();
    return nick || '누군가';
  } catch {
    return '누군가';
  }
}
