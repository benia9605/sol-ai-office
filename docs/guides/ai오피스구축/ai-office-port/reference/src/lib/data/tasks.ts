import { isDemoMode } from "@/lib/demo/mode";
import { MOCK_TASKS, MOCK_USER_PROFILES } from "@/lib/demo/fixtures";
import { supabase } from "@/lib/supabase";
import { recordActivity } from "@/lib/data/activities";
import { getActorName, getParentCommentAuthor, notify } from "@/lib/data/notify";
import type {
  Task,
  TaskComment,
  TaskLike,
  TaskPriority,
  TaskStatus,
  UserProfile,
} from "@/lib/types/database";

type Filters = {
  workspaceId?: string;
  assigneeId?: string;
  /** Exclude rows where status = 'done' (default: include all). */
  openOnly?: boolean;
};

export async function getTasks({
  workspaceId,
  assigneeId,
  openOnly = false,
}: Filters): Promise<Task[]> {
  if (isDemoMode()) {
    return MOCK_TASKS
      .filter((t) => (workspaceId ? t.workspace_id === workspaceId : true))
      .filter((t) => (assigneeId ? t.assignee_id === assigneeId : true))
      .filter((t) => (openOnly ? t.status !== "done" : true))
      .sort((a, b) => compareForBoard(a, b));
  }

  let query = supabase!.from("tasks").select("*");
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  if (assigneeId) query = query.eq("assignee_id", assigneeId);
  if (openOnly) query = query.neq("status", "done");
  query = query.order("created_at", { ascending: false });
  const { data } = await query;
  return (data as Task[]) ?? [];
}

/** Open tasks assigned to me in a given workspace. */
export async function getMyOpenTasks(
  workspaceId: string,
  userId: string,
): Promise<Task[]> {
  return getTasks({ workspaceId, assigneeId: userId, openOnly: true });
}

export async function getTaskById(id: string): Promise<Task | null> {
  if (isDemoMode()) {
    return MOCK_TASKS.find((t) => t.id === id) ?? null;
  }
  const { data } = await supabase!
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Task | null) ?? null;
}

/** All tasks tied to a specific 회의록. */
export async function getTasksForNote(noteId: string): Promise<Task[]> {
  if (isDemoMode()) {
    return MOCK_TASKS.filter((t) => t.note_id === noteId).sort(compareForBoard);
  }
  const { data } = await supabase!
    .from("tasks")
    .select("*")
    .eq("note_id", noteId)
    .order("created_at", { ascending: false });
  return (data as Task[]) ?? [];
}

// ───────────────────────────────────────────────────────────────
// Mutations
// ───────────────────────────────────────────────────────────────

export type TaskInput = {
  workspace_id: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  assignee_id?: string | null;
  meeting_id?: string | null;
  note_id?: string | null;
  category?: string | null;
};

export async function createTask(
  input: TaskInput,
  createdBy: string,
): Promise<Task | null> {
  const now = new Date().toISOString();

  if (isDemoMode()) {
    const t: Task = {
      id: crypto.randomUUID(),
      workspace_id: input.workspace_id,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      due_date: input.due_date ?? null,
      assignee_id: input.assignee_id ?? null,
      created_by: createdBy,
      meeting_id: input.meeting_id ?? null,
      note_id: input.note_id ?? null,
      category: input.category ?? null,
      created_at: now,
      completed_at: null,
    };
    MOCK_TASKS.push(t);
    await recordActivity(
      {
        workspace_id: t.workspace_id,
        action: "created_task",
        resource_type: "task",
        resource_id: t.id,
        metadata: { title: t.title },
      },
      createdBy,
    );
    return t;
  }

  const { data } = await supabase!
    .from("tasks")
    .insert({
      workspace_id: input.workspace_id,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      due_date: input.due_date ?? null,
      assignee_id: input.assignee_id ?? null,
      created_by: createdBy,
      meeting_id: input.meeting_id ?? null,
      note_id: input.note_id ?? null,
      category: input.category ?? null,
    })
    .select()
    .single();
  // 담당자에게만 알림 (본인이 본인에게 만든 건 actor_id 가 같아 자동 제외됨)
  if (data && (data as Task).assignee_id) {
    const name = await getActorName(createdBy);
    await notify({
      type: "new_task",
      workspace_id: (data as Task).workspace_id,
      actor_id: createdBy,
      title: "📝 새 할일",
      body: `${name} 님이 회원님께 「${(data as Task).title}」을 배정했어요.`,
      url: `/tasks/${(data as Task).id}`,
      tag: `task-${(data as Task).id}`,
      target_user_ids: [(data as Task).assignee_id!],
    });
  }
  return (data as Task | null) ?? null;
}

export type TaskPatch = Partial<
  Omit<TaskInput, "workspace_id"> & {
    completed_at: string | null;
  }
>;

export type UpdateTaskOpts = {
  /** 명시적 actor — 없으면 담당자/작성자 순. 알림 발송 시 'actor 자신은 제외' 처리에 필수. */
  actorId?: string;
};

export async function updateTask(
  id: string,
  patch: TaskPatch,
  opts?: UpdateTaskOpts,
): Promise<Task | null> {
  if (isDemoMode()) {
    const i = MOCK_TASKS.findIndex((t) => t.id === id);
    if (i < 0) return null;
    const wasDone = MOCK_TASKS[i].status === "done";
    const merged: Task = { ...MOCK_TASKS[i], ...patch } as Task;
    if (patch.status === "done" && !merged.completed_at) {
      merged.completed_at = new Date().toISOString();
    } else if (patch.status && patch.status !== "done") {
      merged.completed_at = null;
    }
    MOCK_TASKS[i] = merged;
    const actor = opts?.actorId ?? merged.assignee_id ?? merged.created_by;
    if (!wasDone && merged.status === "done") {
      await recordActivity(
        {
          workspace_id: merged.workspace_id,
          action: "completed_task",
          resource_type: "task",
          resource_id: merged.id,
          metadata: { title: merged.title },
        },
        actor,
      );
    }
    return merged;
  }
  // 실모드 — done 전환 감지를 위해 이전 상태 조회
  const { data: prev } = await supabase!
    .from("tasks")
    .select("status, completed_at")
    .eq("id", id)
    .maybeSingle();
  const wasDone = (prev as { status?: string } | null)?.status === "done";

  // 상태 → done 으로 바뀌면 completed_at 자동 set, 다른 상태로 가면 clear
  const finalPatch: TaskPatch = { ...patch };
  if (patch.status === "done" && !(prev as { completed_at?: string | null } | null)?.completed_at) {
    (finalPatch as TaskPatch & { completed_at?: string | null }).completed_at =
      new Date().toISOString();
  } else if (patch.status && patch.status !== "done") {
    (finalPatch as TaskPatch & { completed_at?: string | null }).completed_at = null;
  }

  const { data } = await supabase!
    .from("tasks")
    .update(finalPatch)
    .eq("id", id)
    .select()
    .single();
  const updated = (data as Task | null) ?? null;
  if (!updated) return null;

  const actor = opts?.actorId ?? updated.assignee_id ?? updated.created_by;
  const justCompleted = !wasDone && updated.status === "done";

  // done 으로 전환된 경우 활동 피드 + 전체 멤버 푸시 (본인 제외).
  // 작성자 / 담당자 구분 없이 동일 메시지 — "○○님이 「제목」을 완료했어요".
  if (justCompleted) {
    await recordActivity(
      {
        workspace_id: updated.workspace_id,
        action: "completed_task",
        resource_type: "task",
        resource_id: updated.id,
        metadata: { title: updated.title },
      },
      actor,
    );
    const name = await getActorName(actor);
    await notify({
      type: "task_completed",
      workspace_id: updated.workspace_id,
      actor_id: actor,
      title: "✅ 할일 완료",
      body: `${name} 님이 「${updated.title}」을 완료했어요.`,
      url: `/tasks/${updated.id}`,
      tag: `task-${updated.id}-done`,
    });
  }

  return updated;
}

export async function deleteTask(id: string): Promise<boolean> {
  if (isDemoMode()) {
    const i = MOCK_TASKS.findIndex((t) => t.id === id);
    if (i < 0) return false;
    MOCK_TASKS.splice(i, 1);
    return true;
  }
  const { error } = await supabase!.from("tasks").delete().eq("id", id);
  return !error;
}

/**
 * Reconcile the tasks attached to a 회의록.
 *
 * - `keep` rows are existing tasks (with `id`) that survive; the patch is applied.
 * - `create` rows are new tasks linked to this note.
 * - Tasks currently linked to the note but missing from both lists are deleted.
 *
 * Status / completed_at on kept rows is preserved unless the caller passes
 * a new value in the patch.
 */
export async function syncTasksForNote(
  noteId: string,
  workspaceId: string,
  meetingId: string | null,
  createdBy: string,
  rows: {
    keep: { id: string; patch: TaskPatch }[];
    create: { title: string; assignee_id: string | null; due_date: string | null }[];
  },
): Promise<void> {
  const existing = await getTasksForNote(noteId);
  const keepIds = new Set(rows.keep.map((r) => r.id));

  // Delete the ones not kept
  for (const t of existing) {
    if (!keepIds.has(t.id)) {
      await deleteTask(t.id);
    }
  }
  // Update the kept ones — note_id 를 강제로 이 노트로 설정해, 다른 노트/무연결
  // 이던 기존 할일을 picker 로 불러왔을 때 실제로 이 회의록에 연결되도록 한다.
  for (const k of rows.keep) {
    await updateTask(k.id, { ...k.patch, note_id: noteId });
  }
  // Create the new ones
  for (const c of rows.create) {
    await createTask(
      {
        workspace_id: workspaceId,
        title: c.title,
        assignee_id: c.assignee_id,
        due_date: c.due_date,
        meeting_id: meetingId,
        note_id: noteId,
      },
      createdBy,
    );
  }
}

// ───────────────────────────────────────────────────────────────
// 좋아요 + 댓글 (task_likes / task_comments — 마이그레이션 047)
// reading_note_likes / reading_note_comments 와 동일 패턴.
// ───────────────────────────────────────────────────────────────

type TaskAuthorRef = Pick<
  UserProfile,
  "user_id" | "name" | "email" | "avatar_url"
>;

export type TaskCommentWithAuthor = TaskComment & {
  author: TaskAuthorRef | null;
};

const MOCK_TASK_LIKES: TaskLike[] = [];
const MOCK_TASK_COMMENTS: TaskComment[] = [];

function taskAuthorFor(userId: string): TaskAuthorRef | null {
  const p = MOCK_USER_PROFILES.find((x) => x.user_id === userId);
  if (!p) return null;
  return {
    user_id: p.user_id,
    name: p.name,
    email: p.email,
    avatar_url: p.avatar_url,
  };
}

/** 할일 작성자 + 담당자 (actor 제외, 중복 제거) — 좋아요/댓글 알림 대상. */
function taskNotifyTargets(
  task: { created_by: string; assignee_id: string | null },
  actorId: string,
): string[] {
  return [task.created_by, task.assignee_id].filter(
    (id): id is string => !!id && id !== actorId,
  );
}

export async function getTaskLikeState(
  taskId: string,
  userId: string,
): Promise<{ count: number; liked: boolean }> {
  if (isDemoMode()) {
    const rows = MOCK_TASK_LIKES.filter((l) => l.task_id === taskId);
    return { count: rows.length, liked: rows.some((l) => l.user_id === userId) };
  }
  const { data } = await supabase!
    .from("task_likes")
    .select("user_id")
    .eq("task_id", taskId);
  const rows = (data ?? []) as { user_id: string }[];
  return { count: rows.length, liked: rows.some((l) => l.user_id === userId) };
}

export async function toggleTaskLike(
  taskId: string,
  userId: string,
): Promise<boolean> {
  if (isDemoMode()) {
    const idx = MOCK_TASK_LIKES.findIndex(
      (l) => l.task_id === taskId && l.user_id === userId,
    );
    if (idx >= 0) {
      MOCK_TASK_LIKES.splice(idx, 1);
      return false;
    }
    MOCK_TASK_LIKES.push({
      task_id: taskId,
      user_id: userId,
      created_at: new Date().toISOString(),
    });
    return true;
  }
  const { error } = await supabase!
    .from("task_likes")
    .insert({ task_id: taskId, user_id: userId });
  if (error) {
    // 이미 눌러져 있으면 toggle off
    await supabase!
      .from("task_likes")
      .delete()
      .eq("task_id", taskId)
      .eq("user_id", userId);
    return false;
  }
  // 작성자/담당자에게 알림 (본인 제외)
  const { data: task } = await supabase!
    .from("tasks")
    .select("created_by, assignee_id, workspace_id, title")
    .eq("id", taskId)
    .maybeSingle();
  if (task) {
    const t = task as {
      created_by: string;
      assignee_id: string | null;
      workspace_id: string;
      title: string;
    };
    const targets = taskNotifyTargets(t, userId);
    if (targets.length) {
      const name = await getActorName(userId);
      await notify({
        type: "like",
        workspace_id: t.workspace_id,
        actor_id: userId,
        title: "👏 좋아요",
        body: `${name} 님이 「${t.title}」 할일에 좋아요를 눌렀어요.`,
        url: `/tasks/${taskId}`,
        tag: `task-like-${taskId}-${userId}`,
        target_user_ids: targets,
      });
    }
  }
  return true;
}

export async function getTaskComments(
  taskId: string,
): Promise<TaskCommentWithAuthor[]> {
  if (isDemoMode()) {
    return MOCK_TASK_COMMENTS.filter((c) => c.task_id === taskId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({ ...c, author: taskAuthorFor(c.user_id) }));
  }
  const { data } = await supabase!
    .from("task_comments")
    .select(
      "*, author:user_profiles!task_comments_user_id_fkey(user_id, name, email, avatar_url)",
    )
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as TaskCommentWithAuthor[];
}

export async function addTaskComment(
  taskId: string,
  userId: string,
  content: string,
  parentId?: string | null,
): Promise<TaskComment | null> {
  if (isDemoMode()) {
    const c: TaskComment = {
      id: crypto.randomUUID(),
      task_id: taskId,
      user_id: userId,
      content,
      parent_id: parentId ?? null,
      created_at: new Date().toISOString(),
    };
    MOCK_TASK_COMMENTS.push(c);
    return c;
  }
  const { data } = await supabase!
    .from("task_comments")
    .insert({
      task_id: taskId,
      user_id: userId,
      content,
      parent_id: parentId ?? null,
    })
    .select()
    .single();
  if (data) {
    const { data: task } = await supabase!
      .from("tasks")
      .select("created_by, assignee_id, workspace_id, title")
      .eq("id", taskId)
      .maybeSingle();
    if (task) {
      const t = task as {
        created_by: string;
        assignee_id: string | null;
        workspace_id: string;
        title: string;
      };
      const name = await getActorName(userId);
      if (parentId) {
        // 답글 → 부모 댓글 작성자에게
        const parentAuthor = await getParentCommentAuthor(
          "task_comments",
          parentId,
        );
        if (parentAuthor && parentAuthor !== userId) {
          await notify({
            type: "comment",
            workspace_id: t.workspace_id,
            actor_id: userId,
            title: "↳ 내 댓글에 답글",
            body: `${name} 님이 회원님의 댓글에 답글을 남겼어요: ${content.slice(0, 60)}`,
            url: `/tasks/${taskId}`,
            tag: `task-reply-${(data as { id: string }).id}`,
            target_user_ids: [parentAuthor],
          });
        }
      } else {
        const targets = taskNotifyTargets(t, userId);
        if (targets.length) {
          await notify({
            type: "comment",
            workspace_id: t.workspace_id,
            actor_id: userId,
            title: "💬 할일에 새 댓글",
            body: `${name} 님: ${content.slice(0, 80)}`,
            url: `/tasks/${taskId}`,
            tag: `task-comment-${taskId}-${(data as { id: string }).id}`,
            target_user_ids: targets,
          });
        }
      }
    }
  }
  return (data as TaskComment | null) ?? null;
}

export async function deleteTaskComment(id: string): Promise<boolean> {
  if (isDemoMode()) {
    const idx = MOCK_TASK_COMMENTS.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    MOCK_TASK_COMMENTS.splice(idx, 1);
    return true;
  }
  const { error } = await supabase!
    .from("task_comments")
    .delete()
    .eq("id", id);
  return !error;
}

function compareForBoard(a: Task, b: Task): number {
  // done tasks last
  if (a.status === "done" && b.status !== "done") return 1;
  if (b.status === "done" && a.status !== "done") return -1;
  // 최신 생성순 (내림차순 — 최신이 위로)
  return b.created_at.localeCompare(a.created_at);
}
