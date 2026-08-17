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

export type SocialResource = 'task' | 'content';

interface ResCfg {
  likeTable: string; commentTable: string; idCol: string;
  resTable: string; ownerCol: string; hasAssignee: boolean;
  urlBase: string;
}
const CFG: Record<SocialResource, ResCfg> = {
  task: { likeTable: 'task_likes', commentTable: 'task_comments', idCol: 'task_id', resTable: 'tasks', ownerCol: 'user_id', hasAssignee: true, urlBase: '/office/todos' },
  content: { likeTable: 'content_likes', commentTable: 'content_comments', idCol: 'content_item_id', resTable: 'content_items', ownerCol: 'created_by', hasAssignee: false, urlBase: '/office/contents' },
};

/** 리소스의 소유자/담당자/제목/워크스페이스 조회 (알림 대상 결정용) */
async function fetchResMeta(resource: SocialResource, resId: string) {
  const c = CFG[resource];
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
  const c = CFG[resource];
  const { data } = await supabase.from(c.likeTable).select('user_id').eq(c.idCol, resId);
  const rows = (data ?? []) as { user_id: string }[];
  return { count: rows.length, liked: rows.some((l) => l.user_id === userId) };
}

/** 좋아요 토글 — 켤 때만 알림. 반환: 최종 liked 여부 */
export async function toggleLike(resource: SocialResource, resId: string, userId: string): Promise<boolean> {
  const c = CFG[resource];
  const { data: existing } = await supabase.from(c.likeTable).select('user_id').eq(c.idCol, resId).eq('user_id', userId).maybeSingle();
  if (existing) {
    await supabase.from(c.likeTable).delete().eq(c.idCol, resId).eq('user_id', userId);
    return false;
  }
  const meta = await fetchResMeta(resource, resId);
  await supabase.from(c.likeTable).insert({ [c.idCol]: resId, user_id: userId, workspace_id: meta.workspaceId });
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
  const c = CFG[resource];
  const { data } = await supabase.from(c.commentTable).select('id, user_id, content, parent_id, created_at').eq(c.idCol, resId).order('created_at', { ascending: true });
  return ((data ?? []) as { id: string; user_id: string; content: string; parent_id: string | null; created_at: string }[])
    .map((r) => ({ id: r.id, userId: r.user_id, content: r.content, parentId: r.parent_id, createdAt: r.created_at }));
}

/** 댓글/답글 등록 → 알림 */
export async function addComment(resource: SocialResource, resId: string, content: string, parentId?: string | null): Promise<SocialComment | null> {
  const c = CFG[resource];
  const userId = await getCurrentUserId().catch(() => null);
  if (!userId) return null;
  const meta = await fetchResMeta(resource, resId);
  const { data } = await supabase.from(c.commentTable)
    .insert({ [c.idCol]: resId, workspace_id: meta.workspaceId, user_id: userId, content: content.trim(), parent_id: parentId ?? null })
    .select('id, user_id, content, parent_id, created_at').single();
  const created = data as { id: string; user_id: string; content: string; parent_id: string | null; created_at: string } | null;
  if (!created) return null;

  if (meta.workspaceId) {
    const name = await getActorName(meta.workspaceId, userId);
    const type: NotifyType = 'notify_comment';
    if (parentId) {
      // 답글 → 부모 댓글 작성자
      const { data: parent } = await supabase.from(c.commentTable).select('user_id').eq('id', parentId).maybeSingle();
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

export async function deleteComment(resource: SocialResource, commentId: string): Promise<void> {
  await supabase.from(CFG[resource].commentTable).delete().eq('id', commentId);
}
