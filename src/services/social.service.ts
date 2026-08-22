/**
 * @file src/services/social.service.ts
 * @description 소셜 — 할일·콘텐츠 좋아요/댓글/답글 + 알림 (Phase 2, 마이그 037)
 * - 좋아요 토글은 '조회 후 insert/delete'(mock 호환). 켤 때만 알림.
 * - 댓글 → 작성자(+할일은 담당자) / 답글 → 부모 댓글 작성자 / 좋아요 → 작성자.
 * - notify()는 best-effort. 개인 워크스페이스(1인)면 서버가 액터 제외로 0명 처리.
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { SocialComment } from '../types';
import { notify, getActorName, NotifyType } from './notify.service';

export type SocialResource = 'task' | 'content' | 'insight' | 'record' | 'meeting' | 'schedule';

// 폴리모픽 통합 테이블 (마이그 044)
const LIKES = 'social_likes';
const COMMENTS = 'social_comments';

interface ResMeta { resTable: string; ownerCol: string; hasAssignee: boolean; activity?: string; }
// 자원별 원본 테이블 — 알림 대상(작성자/담당자)·제목 조회용
const RES_META: Record<SocialResource, ResMeta> = {
  task: { resTable: 'tasks', ownerCol: 'user_id', hasAssignee: true, activity: 'commented_task' },
  content: { resTable: 'content_items', ownerCol: 'created_by', hasAssignee: false },
  insight: { resTable: 'insights', ownerCol: 'user_id', hasAssignee: false, activity: 'commented_insight' },
  record: { resTable: 'journals', ownerCol: 'user_id', hasAssignee: false, activity: 'commented_record' },
  meeting: { resTable: 'meetings', ownerCol: 'created_by', hasAssignee: false, activity: 'commented_meeting' },
  schedule: { resTable: 'schedules', ownerCol: 'user_id', hasAssignee: false },
};

/** 리소스의 소유자/담당자/제목/워크스페이스 조회 (알림 대상 결정용) */
async function fetchResMeta(resource: SocialResource, resId: string) {
  const c = RES_META[resource];
  const cols = ['workspace_id', 'title', c.ownerCol, ...(c.hasAssignee ? ['assignee_id'] : [])].join(', ');
  const { data } = await supabase.from(c.resTable).select(cols).eq('id', resId).maybeSingle();
  const r = (data ?? {}) as Record<string, string | null>;
  return {
    workspaceId: r.workspace_id ?? null,
    title: r.title ?? '항목',
    owner: r[c.ownerCol] ?? null,
    assignee: c.hasAssignee ? (r.assignee_id ?? null) : null,
  };
}

/** 좋아요 수 + 내가 눌렀는지 */
export async function getLikeState(resource: SocialResource, resId: string, userId: string): Promise<{ count: number; liked: boolean }> {
  const { data } = await supabase.from(LIKES).select('user_id').eq('ref_type', resource).eq('ref_id', resId);
  const rows = (data ?? []) as { user_id: string }[];
  return { count: rows.length, liked: rows.some((l) => l.user_id === userId) };
}

/** 좋아요 토글 — 켤 때만 알림. 반환: 최종 liked 여부 */
export async function toggleLike(resource: SocialResource, resId: string, userId: string): Promise<boolean> {
  const { data: existing } = await supabase.from(LIKES).select('user_id').eq('ref_type', resource).eq('ref_id', resId).eq('user_id', userId).maybeSingle();
  if (existing) {
    await supabase.from(LIKES).delete().eq('ref_type', resource).eq('ref_id', resId).eq('user_id', userId);
    return false;
  }
  const meta = await fetchResMeta(resource, resId);
  await supabase.from(LIKES).insert({ ref_type: resource, ref_id: resId, user_id: userId, workspace_id: meta.workspaceId });
  // 켤 때만 알림 → 작성자(+담당자)
  if (meta.workspaceId) {
    const targets = [meta.owner, meta.assignee].filter((id): id is string => !!id && id !== userId);
    if (targets.length) {
      const name = await getActorName(meta.workspaceId, userId);
      notify({
        type: 'notify_like', workspaceId: meta.workspaceId, actorId: userId,
        title: '👏 좋아요', body: `${name} 님이 「${meta.title}」에 좋아요를 눌렀어요.`,
        tag: `${resource}-like-${resId}-${userId}`, targetUserIds: targets,
      });
    }
  }
  return true;
}

/** 댓글 목록 (오름차순 — 답글 트리 구성 쉬움) */
export async function fetchComments(resource: SocialResource, resId: string): Promise<SocialComment[]> {
  const { data } = await supabase.from(COMMENTS).select('id, user_id, content, parent_id, created_at').eq('ref_type', resource).eq('ref_id', resId).order('created_at', { ascending: true });
  return ((data ?? []) as { id: string; user_id: string; content: string; parent_id: string | null; created_at: string }[])
    .map((r) => ({ id: r.id, userId: r.user_id, content: r.content, parentId: r.parent_id, createdAt: r.created_at }));
}

/** 댓글/답글 등록 → 알림 */
export async function addComment(resource: SocialResource, resId: string, content: string, parentId?: string | null): Promise<SocialComment | null> {
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return null;
  const meta = await fetchResMeta(resource, resId);
  const { data } = await supabase.from(COMMENTS)
    .insert({ ref_type: resource, ref_id: resId, workspace_id: meta.workspaceId, user_id: userId, content: content.trim(), parent_id: parentId ?? null })
    .select('id, user_id, content, parent_id, created_at').single();
  const created = data as { id: string; user_id: string; content: string; parent_id: string | null; created_at: string } | null;
  if (!created) return null;

  if (meta.workspaceId) {
    const name = await getActorName(meta.workspaceId, userId);
    const type: NotifyType = 'notify_comment';

    // ── @멘션: 본문에서 @닉네임 파싱 → 멤버 매칭 → 멘션 알림 ──
    const mentioned = await resolveMentions(meta.workspaceId, content, userId);
    if (mentioned.length) {
      notify({
        type: 'notify_mention', workspaceId: meta.workspaceId, actorId: userId,
        title: '📣 멘션', body: `${name} 님이 회원님을 언급했어요: ${content.slice(0, 60)}`,
        tag: `${resource}-mention-${created.id}`, targetUserIds: mentioned,
      });
    }

    if (parentId) {
      // 답글 → 부모 댓글 작성자
      const { data: parent } = await supabase.from(COMMENTS).select('user_id').eq('id', parentId).maybeSingle();
      const parentAuthor = (parent as { user_id?: string } | null)?.user_id ?? null;
      if (parentAuthor && parentAuthor !== userId) {
        notify({ type, workspaceId: meta.workspaceId, actorId: userId, title: '↳ 내 댓글에 답글', body: `${name} 님: ${content.slice(0, 60)}`, tag: `${resource}-reply-${created.id}`, targetUserIds: [parentAuthor] });
      }
    } else {
      // 최상위 댓글 → 작성자(+할일 담당자)
      const targets = [meta.owner, meta.assignee].filter((id): id is string => !!id && id !== userId);
      if (targets.length) {
        notify({ type, workspaceId: meta.workspaceId, actorId: userId, title: '💬 새 댓글', body: `${name} 님: ${content.slice(0, 80)}`, tag: `${resource}-comment-${resId}-${created.id}`, targetUserIds: targets });
      }
    }
  }
  return { id: created.id, userId: created.user_id, content: created.content, parentId: created.parent_id, createdAt: created.created_at };
}

export async function deleteComment(_resource: SocialResource, commentId: string): Promise<void> {
  await supabase.from(COMMENTS).delete().eq('id', commentId);
}

/** 본문의 @닉네임을 워크스페이스 멤버와 매칭 → user_id 목록(액터 제외). 닉네임에 공백 있어도 정확히 매칭. */
async function resolveMentions(workspaceId: string, content: string, actorId: string): Promise<string[]> {
  if (!content.includes('@')) return [];
  try {
    const { data } = await supabase.from('workspace_members').select('user_id, nickname').eq('workspace_id', workspaceId);
    const members = (data ?? []) as { user_id: string; nickname?: string }[];
    const hit = new Set<string>();
    for (const m of members) {
      const nick = m.nickname?.trim();
      if (nick && m.user_id !== actorId && content.includes(`@${nick}`)) hit.add(m.user_id);
    }
    return [...hit];
  } catch {
    return [];
  }
}
