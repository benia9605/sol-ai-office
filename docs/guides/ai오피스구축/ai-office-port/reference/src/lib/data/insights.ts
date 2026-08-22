import { isDemoMode } from "@/lib/demo/mode";
import {
  MOCK_INSIGHTS,
  MOCK_INSIGHT_LIKES,
  MOCK_INSIGHT_COMMENTS,
  MOCK_USER_PROFILES,
} from "@/lib/demo/fixtures";
import { supabase } from "@/lib/supabase";
import { recordActivity } from "@/lib/data/activities";
import { getActorName, getParentCommentAuthor, notify } from "@/lib/data/notify";
import type {
  Insight,
  InsightComment,
  UserProfile,
} from "@/lib/types/database";

export type AuthorRef = Pick<
  UserProfile,
  "user_id" | "name" | "email" | "avatar_url" | "company" | "position"
>;

export type InsightWithMeta = Insight & {
  author: AuthorRef | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
};

function authorFor(userId: string): AuthorRef | null {
  const p = MOCK_USER_PROFILES.find((x) => x.user_id === userId);
  if (!p) return null;
  return {
    user_id: p.user_id,
    name: p.name,
    email: p.email,
    avatar_url: p.avatar_url,
    company: p.company,
    position: p.position,
  };
}

export async function getWorkspaceInsights(
  workspaceId: string,
  currentUserId: string,
): Promise<InsightWithMeta[]> {
  if (isDemoMode()) {
    return MOCK_INSIGHTS
      .filter((i) => i.workspace_id === workspaceId)
      .filter((i) => i.is_shared || i.user_id === currentUserId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((i) => withMeta(i, currentUserId));
  }

  const embedSelect =
    "*, author:user_profiles!insights_user_id_fkey(user_id, name, email, avatar_url, company, position), likes:insight_likes(user_id), comments:insight_comments(id)";
  const first = await supabase!
    .from("insights")
    .select(embedSelect)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (first.error) {
    console.error(
      `[meetup-insights] embed query failed — code=${first.error.code} message="${first.error.message}" details="${first.error.details ?? ""}" hint="${first.error.hint ?? ""}"`,
    );
    const fallback = await supabase!
      .from("insights")
      .select(
        "*, author:user_profiles!insights_user_id_fkey(user_id, name, email, avatar_url, company, position)",
      )
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (fallback.error) {
      console.error(
        `[meetup-insights] fallback (author only) also failed — code=${fallback.error.code} message="${fallback.error.message}" details="${fallback.error.details ?? ""}" hint="${fallback.error.hint ?? ""}"`,
      );
      const bare = await supabase!
        .from("insights")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (bare.error) {
        console.error(
          `[meetup-insights] bare select also failed — code=${bare.error.code} message="${bare.error.message}" details="${bare.error.details ?? ""}" hint="${bare.error.hint ?? ""}"`,
        );
        return [];
      }
      console.warn(
        `[meetup-insights] bare select recovered ${bare.data?.length ?? 0} rows — embed/author are broken (likely RLS recursion on insights or user_profiles)`,
      );
      return ((bare.data ?? []) as unknown as Insight[]).map((row) => ({
        ...row,
        author: null,
        like_count: 0,
        comment_count: 0,
        liked_by_me: false,
      }));
    }
    return ((fallback.data ?? []) as unknown as Array<
      Insight & { author: AuthorRef | null }
    >).map((row) => ({
      ...row,
      like_count: 0,
      comment_count: 0,
      liked_by_me: false,
    }));
  }

  return ((first.data ?? []) as unknown as Array<
    Insight & {
      author: AuthorRef | null;
      likes: { user_id: string }[];
      comments: { id: string }[];
    }
  >).map((row) => ({
    ...row,
    like_count: row.likes?.length ?? 0,
    comment_count: row.comments?.length ?? 0,
    liked_by_me: row.likes?.some((l) => l.user_id === currentUserId) ?? false,
  }));
}

export async function getInsight(
  id: string,
  currentUserId: string,
): Promise<InsightWithMeta | null> {
  if (isDemoMode()) {
    const i = MOCK_INSIGHTS.find((x) => x.id === id);
    if (!i) return null;
    return withMeta(i, currentUserId);
  }
  const { data } = await supabase!
    .from("insights")
    .select(
      "*, author:user_profiles!insights_user_id_fkey(user_id, name, email, avatar_url, company, position), likes:insight_likes(user_id), comments:insight_comments(id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as Insight & {
    author: AuthorRef | null;
    likes: { user_id: string }[];
    comments: { id: string }[];
  };
  return {
    ...row,
    like_count: row.likes?.length ?? 0,
    comment_count: row.comments?.length ?? 0,
    liked_by_me: row.likes?.some((l) => l.user_id === currentUserId) ?? false,
  };
}

function withMeta(i: Insight, currentUserId: string): InsightWithMeta {
  const likes = MOCK_INSIGHT_LIKES.filter((l) => l.insight_id === i.id);
  const comments = MOCK_INSIGHT_COMMENTS.filter((c) => c.insight_id === i.id);
  return {
    ...i,
    author: authorFor(i.user_id),
    like_count: likes.length,
    comment_count: comments.length,
    liked_by_me: likes.some((l) => l.user_id === currentUserId),
  };
}

// ───────────────────────────────────────────────────────────────
// Mutations
// ───────────────────────────────────────────────────────────────

export type InsightInput = {
  workspace_id: string;
  title: string;
  content: string | null;
  source: string | null;
  tags: string[];
  is_shared?: boolean;
  /** 029 — 임시저장(draft) 또는 발행(published). 기본 published. */
  status?: "draft" | "published";
};

export async function createInsight(
  input: InsightInput,
  userId: string,
): Promise<Insight | null> {
  const filled = {
    is_shared: true, // 공개 토글 제거 — 항상 모임 공유
    status: "published" as const,
    ...input,
  };
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const i: Insight = {
      id: crypto.randomUUID(),
      ...filled,
      user_id: userId,
      created_at: now,
      updated_at: now,
    };
    MOCK_INSIGHTS.unshift(i);
    if (i.is_shared && i.status === "published") {
      await recordActivity(
        {
          workspace_id: i.workspace_id,
          action: "shared_insight",
          resource_type: "insight",
          resource_id: i.id,
          metadata: { title: i.title },
        },
        userId,
      );
    }
    return i;
  }
  const { data, error } = await supabase!
    .from("insights")
    .insert({ ...filled, user_id: userId })
    .select()
    .single();
  if (error) {
    console.error("[meetup-insights] createInsight failed", {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      payload: input,
    });
    throw new Error(
      `인사이트 저장에 실패했습니다 (${error.code ?? "unknown"}): ${error.message}`,
    );
  }
  if (
    data &&
    (data as Insight).is_shared &&
    (data as Insight).status === "published"
  ) {
    await recordActivity(
      {
        workspace_id: (data as Insight).workspace_id,
        action: "shared_insight",
        resource_type: "insight",
        resource_id: (data as Insight).id,
        metadata: { title: (data as Insight).title },
      },
      userId,
    );
    const name = await getActorName(userId);
    await notify({
      type: "new_insight",
      workspace_id: (data as Insight).workspace_id,
      actor_id: userId,
      title: "💡 새 인사이트",
      body: `${name} 님이 「${(data as Insight).title}」 인사이트를 공유했어요.`,
      url: `/insights/${(data as Insight).id}`,
      tag: `insight-${(data as Insight).id}`,
    });
  }
  return (data as Insight | null) ?? null;
}

export type InsightPatch = Partial<Omit<InsightInput, "workspace_id">>;

export async function updateInsight(
  id: string,
  patch: InsightPatch,
): Promise<Insight | null> {
  if (isDemoMode()) {
    const idx = MOCK_INSIGHTS.findIndex((i) => i.id === id);
    if (idx < 0) return null;
    MOCK_INSIGHTS[idx] = {
      ...MOCK_INSIGHTS[idx],
      ...patch,
      updated_at: new Date().toISOString(),
    };
    return MOCK_INSIGHTS[idx];
  }
  const { data } = await supabase!
    .from("insights")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  return (data as Insight | null) ?? null;
}

export async function deleteInsight(id: string): Promise<boolean> {
  if (isDemoMode()) {
    const idx = MOCK_INSIGHTS.findIndex((i) => i.id === id);
    if (idx < 0) return false;
    MOCK_INSIGHTS.splice(idx, 1);
    for (let j = MOCK_INSIGHT_LIKES.length - 1; j >= 0; j--) {
      if (MOCK_INSIGHT_LIKES[j].insight_id === id) MOCK_INSIGHT_LIKES.splice(j, 1);
    }
    for (let j = MOCK_INSIGHT_COMMENTS.length - 1; j >= 0; j--) {
      if (MOCK_INSIGHT_COMMENTS[j].insight_id === id)
        MOCK_INSIGHT_COMMENTS.splice(j, 1);
    }
    return true;
  }
  const { error } = await supabase!.from("insights").delete().eq("id", id);
  return !error;
}

// ───────────────────────────────────────────────────────────────
// Likes
// ───────────────────────────────────────────────────────────────

export async function toggleInsightLike(
  insightId: string,
  userId: string,
): Promise<boolean> {
  let liked = false;
  if (isDemoMode()) {
    const idx = MOCK_INSIGHT_LIKES.findIndex(
      (l) => l.insight_id === insightId && l.user_id === userId,
    );
    if (idx >= 0) {
      MOCK_INSIGHT_LIKES.splice(idx, 1);
      liked = false;
    } else {
      MOCK_INSIGHT_LIKES.push({
        insight_id: insightId,
        user_id: userId,
        created_at: new Date().toISOString(),
      });
      liked = true;
    }
  } else {
    // Try insert; if it conflicts, that means already liked → delete instead
    const { error } = await supabase!
      .from("insight_likes")
      .insert({ insight_id: insightId, user_id: userId });
    if (error) {
      await supabase!
        .from("insight_likes")
        .delete()
        .eq("insight_id", insightId)
        .eq("user_id", userId);
      liked = false;
    } else {
      liked = true;
    }
  }
  if (liked) {
    const ins = await getInsight(insightId, userId);
    if (ins) {
      await recordActivity(
        {
          workspace_id: ins.workspace_id,
          action: "liked_insight",
          resource_type: "insight",
          resource_id: ins.id,
          metadata: { title: ins.title },
        },
        userId,
      );
      if (ins.user_id !== userId) {
        const name = await getActorName(userId);
        await notify({
          type: "like",
          workspace_id: ins.workspace_id,
          actor_id: userId,
          title: "👏 좋아요",
          body: `${name} 님이 「${ins.title}」 인사이트에 좋아요를 눌렀어요.`,
          url: `/insights/${ins.id}`,
          tag: `insight-like-${ins.id}-${userId}`,
          target_user_ids: [ins.user_id],
        });
      }
    }
  }
  return liked;
}

// ───────────────────────────────────────────────────────────────
// Comments
// ───────────────────────────────────────────────────────────────

export type CommentWithAuthor = InsightComment & {
  author: AuthorRef | null;
};

export async function getInsightComments(
  insightId: string,
): Promise<CommentWithAuthor[]> {
  if (isDemoMode()) {
    return MOCK_INSIGHT_COMMENTS
      .filter((c) => c.insight_id === insightId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({ ...c, author: authorFor(c.user_id) }));
  }
  const { data } = await supabase!
    .from("insight_comments")
    .select(
      "*, author:user_profiles!insight_comments_user_id_fkey(user_id, name, email, avatar_url, company, position)",
    )
    .eq("insight_id", insightId)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as CommentWithAuthor[];
}

export async function addInsightComment(
  insightId: string,
  userId: string,
  content: string,
  parentId?: string | null,
): Promise<InsightComment | null> {
  let created: InsightComment | null = null;
  if (isDemoMode()) {
    const c: InsightComment = {
      id: crypto.randomUUID(),
      insight_id: insightId,
      user_id: userId,
      content,
      parent_id: parentId ?? null,
      created_at: new Date().toISOString(),
    };
    MOCK_INSIGHT_COMMENTS.push(c);
    created = c;
  } else {
    const { data } = await supabase!
      .from("insight_comments")
      .insert({
        insight_id: insightId,
        user_id: userId,
        content,
        parent_id: parentId ?? null,
      })
      .select()
      .single();
    created = (data as InsightComment | null) ?? null;
  }
  if (created) {
    const ins = await getInsight(insightId, userId);
    if (ins) {
      await recordActivity(
        {
          workspace_id: ins.workspace_id,
          action: "commented_insight",
          resource_type: "insight",
          resource_id: ins.id,
          metadata: { title: ins.title, excerpt: content.slice(0, 80) },
        },
        userId,
      );
      const name = await getActorName(userId);
      if (parentId) {
        // 답글 → 부모 댓글 작성자에게 알림
        const parentAuthor = await getParentCommentAuthor(
          "insight_comments",
          parentId,
        );
        if (parentAuthor && parentAuthor !== userId) {
          await notify({
            type: "comment",
            workspace_id: ins.workspace_id,
            actor_id: userId,
            title: "↳ 내 댓글에 답글",
            body: `${name} 님이 회원님의 댓글에 답글을 남겼어요: ${content.slice(0, 60)}`,
            url: `/insights/${ins.id}`,
            tag: `insight-reply-${created.id}`,
            target_user_ids: [parentAuthor],
          });
        }
      } else if (ins.user_id !== userId) {
        await notify({
          type: "comment",
          workspace_id: ins.workspace_id,
          actor_id: userId,
          title: "💬 인사이트에 새 댓글",
          body: `${name} 님: ${content.slice(0, 80)}`,
          url: `/insights/${ins.id}`,
          tag: `insight-comment-${ins.id}-${created.id}`,
          target_user_ids: [ins.user_id],
        });
      }
    }
  }
  return created;
}

export async function deleteInsightComment(id: string): Promise<boolean> {
  if (isDemoMode()) {
    const idx = MOCK_INSIGHT_COMMENTS.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    MOCK_INSIGHT_COMMENTS.splice(idx, 1);
    return true;
  }
  const { error } = await supabase!.from("insight_comments").delete().eq("id", id);
  return !error;
}
