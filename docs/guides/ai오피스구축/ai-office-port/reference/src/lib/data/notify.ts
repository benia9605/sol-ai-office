import { isDemoMode } from "@/lib/demo/mode";
import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/data/profile";

/**
 * Invoke the `notify` Edge Function. Best-effort — failures are logged
 * but never throw (domain mutations should not be blocked by a notification
 * delivery error).
 */
export async function notify(params: {
  type:
    | "join_request"
    | "join_approved"
    | "member_joined"
    | "new_meeting"
    | "new_note"
    | "new_task"
    | "task_completed"
    | "new_insight"
    | "new_writing"
    | "new_reading"
    | "new_agenda"
    | "new_notice"
    | "attendance_reported"
    | "guest_application"
    | "comment"
    | "like"
    | "dev_message";
  workspace_id: string;
  actor_id?: string | null;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  target_user_ids?: string[];
}): Promise<void> {
  if (isDemoMode()) return;
  if (!supabase) return;
  try {
    await supabase.functions.invoke("notify", { body: params });
  } catch (e) {
    console.warn("[notify] invoke failed", e);
  }
}

/**
 * 답글 알림용 — 부모 댓글의 작성자(user_id)를 조회. 데모/미연결/에러 시 null.
 * `table` 은 해당 댓글 테이블명 (예: 'insight_comments').
 */
export async function getParentCommentAuthor(
  table: string,
  parentId: string | null | undefined,
): Promise<string | null> {
  if (!parentId || !supabase) return null;
  try {
    const { data } = await supabase
      .from(table)
      .select("user_id")
      .eq("id", parentId)
      .maybeSingle();
    return (data as { user_id?: string } | null)?.user_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a user's display name for push body text. Tries `name` first,
 * then email local-part, falls back to `'누군가'`. Best-effort — never
 * blocks the surrounding mutation.
 */
export async function getActorName(
  userId: string | null | undefined,
): Promise<string> {
  if (!userId) return "누군가";
  try {
    const p = await getProfile(userId);
    if (!p) return "누군가";
    if (p.name && p.name.trim()) return p.name.trim();
    if (p.email) return p.email.split("@")[0];
    return "누군가";
  } catch {
    return "누군가";
  }
}
