import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import { getMyRole } from "@/lib/data/workspaces";
import { getProfile } from "@/lib/data/profile";
import { getWorkspaceMembers } from "@/lib/data/workspace-members";
import { getNote, getWorkspaceNotes } from "@/lib/data/meeting-notes";
import {
  addTaskComment,
  deleteTask,
  deleteTaskComment,
  getTaskById,
  getTaskComments,
  getTaskLikeState,
  toggleTaskLike,
  updateTask,
  type TaskPatch,
} from "@/lib/data/tasks";
import { Avatar } from "@/components/avatar";
import { LikeCommentBlock } from "@/features/social/like-comment-block";
import { AttachmentsSection } from "@/features/attachments/attachments-section";
import { RichEditor, RichRender } from "@/features/editor/rich-editor";
import { errorBox, inputClass, labelClass } from "@/features/auth/_shared";
import { useDraft } from "@/lib/use-draft";
import { DraftRestoreBanner, DraftSaveButton } from "@/features/common/draft-bar";
import { formatFullDate } from "@/lib/format";
import type { Task } from "@/lib/types/database";

type Mode = "view" | "edit";

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [mode, setMode] = useState<Mode>("view");

  const { data: task, loading } = useAsync(
    () => (id ? getTaskById(id) : Promise.resolve(null)),
    [id, refreshKey],
  );
  const { data: members } = useAsync(
    () =>
      workspace ? getWorkspaceMembers(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );
  const { data: myRole } = useAsync(
    () =>
      workspace && user
        ? getMyRole(workspace.id, user.id)
        : Promise.resolve(null),
    [workspace?.id, user?.id],
  );
  const { data: assignee } = useAsync(
    () =>
      task?.assignee_id ? getProfile(task.assignee_id) : Promise.resolve(null),
    [task?.assignee_id],
  );
  const { data: creator } = useAsync(
    () =>
      task?.created_by ? getProfile(task.created_by) : Promise.resolve(null),
    [task?.created_by],
  );
  const { data: likeState } = useAsync(
    () =>
      id && user
        ? getTaskLikeState(id, user.id)
        : Promise.resolve({ count: 0, liked: false }),
    [id, user?.id, refreshKey],
  );
  const { data: comments } = useAsync(
    () => (id ? getTaskComments(id) : Promise.resolve([])),
    [id, refreshKey],
  );
  // 회의록 연결용 — 전체 회의록 목록(편집 셀렉트) + 현재 연결된 회의록(뷰 표시)
  const { data: notes } = useAsync(
    () =>
      workspace ? getWorkspaceNotes(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );
  const { data: linkedNote } = useAsync(
    () => (task?.note_id ? getNote(task.note_id) : Promise.resolve(null)),
    [task?.note_id, refreshKey],
  );

  if (loading) return null;
  if (!task) return <Navigate to="/tasks" replace />;
  if (!user || !workspace) return null;

  const canManage =
    task.created_by === user.id ||
    task.assignee_id === user.id ||
    myRole === "owner" ||
    myRole === "admin";

  async function handleDelete() {
    if (!task) return;
    if (!confirm("이 할일을 삭제하시겠습니까?")) return;
    const ok = await deleteTask(task.id);
    if (ok) navigate("/tasks");
  }

  async function handleToggleDone() {
    if (!task) return;
    await updateTask(task.id, { status: task.status === "done" ? "todo" : "done" });
    setRefreshKey((v) => v + 1);
  }

  async function handleToggleLike() {
    if (!task || !user) return;
    await toggleTaskLike(task.id, user.id);
    setRefreshKey((v) => v + 1);
  }

  async function handleAddComment(content: string, parentId?: string | null) {
    if (!task || !user) return;
    await addTaskComment(task.id, user.id, content, parentId);
    setRefreshKey((v) => v + 1);
  }

  async function handleDeleteComment(commentId: string) {
    await deleteTaskComment(commentId);
    setRefreshKey((v) => v + 1);
  }

  const done = task.status === "done";
  const canModerate = myRole === "owner" || myRole === "admin";

  return (
    <article className="space-y-10 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/tasks"
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          ← 할일
        </Link>

        {mode === "view" && canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="border border-line-strong px-3 py-1.5 text-xs hover:border-foreground"
            >
              편집
            </button>
            <button
              type="button"
              onClick={handleToggleDone}
              className={`px-3 py-1.5 text-xs transition-colors ${
                done
                  ? "border border-line-strong text-foreground-muted hover:border-foreground hover:text-foreground"
                  : "bg-accent-teal text-accent-foreground hover:bg-accent-teal/85"
              }`}
            >
              {done ? "완료 취소" : "작업 완료"}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs text-danger hover:underline underline-offset-4 px-2"
            >
              삭제
            </button>
          </div>
        )}
      </div>

      {mode === "view" ? (
        <ViewMode
          task={task}
          workspaceId={workspace.id}
          assignee={
            assignee
              ? {
                  name: assignee.name ?? assignee.email ?? "미지정",
                  avatar_url: assignee.avatar_url ?? null,
                }
              : null
          }
          creator={
            creator
              ? {
                  name: creator.name ?? creator.email ?? "—",
                  avatar_url: creator.avatar_url ?? null,
                }
              : null
          }
          linkedNote={
            linkedNote ? { id: linkedNote.id, title: linkedNote.title } : null
          }
          done={done}
        />
      ) : (
        <EditMode
          task={task}
          workspaceId={workspace.id}
          members={members ?? []}
          notes={notes ?? []}
          canManage={canManage}
          userId={user.id}
          onCancel={() => setMode("view")}
          onSaved={() => {
            setMode("view");
            setRefreshKey((v) => v + 1);
          }}
        />
      )}

      {mode === "view" && (
        <LikeCommentBlock
          liked={likeState?.liked ?? false}
          likeCount={likeState?.count ?? 0}
          onToggleLike={handleToggleLike}
          comments={comments ?? []}
          currentUserId={user.id}
          canModerate={canModerate}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
        />
      )}
    </article>
  );
}

// ───────────────────────────────────────────────────────────────
// 뷰 모드 — 읽기 전용, 깔끔하게
// ───────────────────────────────────────────────────────────────

function ViewMode({
  task,
  workspaceId,
  assignee,
  creator,
  linkedNote,
  done,
}: {
  task: Task;
  workspaceId: string;
  assignee: { name: string; avatar_url: string | null } | null;
  creator: { name: string; avatar_url: string | null } | null;
  linkedNote: { id: string; title: string } | null;
  done: boolean;
}) {
  return (
    <>
      <header>
        <h1
          className={`text-3xl font-light leading-tight sm:text-4xl ${
            done ? "line-through text-foreground-faint" : ""
          }`}
        >
          {task.title}
        </h1>
        {done && (
          <p className="mt-3 text-xs text-foreground-faint">완료된 할일</p>
        )}
      </header>

      <section className="grid gap-px bg-surface-muted border border-line sm:grid-cols-3">
        <MetaCell label="담당자" person={assignee ?? { name: "미지정", avatar_url: null }} />
        <MetaCell
          label="기한"
          value={task.due_date ? formatFullDate(task.due_date) : "기한 없음"}
        />
        <MetaCell label="작성자" person={creator ?? { name: "—", avatar_url: null }} />
      </section>

      {linkedNote && (
        <section className="border border-line">
          <Link
            to={`/notes/${linkedNote.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted transition-colors"
          >
            <span className="label shrink-0">회의록</span>
            <span className="text-sm truncate flex-1">{linkedNote.title}</span>
            <span aria-hidden className="text-foreground-faint">›</span>
          </Link>
        </section>
      )}

      <section>
        <p className="label mb-3">내용</p>
        {task.description ? (
          <RichRender html={task.description} />
        ) : (
          <p className="py-6 text-center text-sm text-foreground-faint">
            아직 작성된 내용이 없습니다.
          </p>
        )}
      </section>

      {/* 첨부 — 뷰 모드에선 read-only (canManage=false 로 추가/삭제 숨김). */}
      <AttachmentsSection
        workspaceId={workspaceId}
        refType="task"
        refId={task.id}
        canManage={false}
      />
    </>
  );
}

// ───────────────────────────────────────────────────────────────
// 편집 모드 — 모든 필드 한 폼
// ───────────────────────────────────────────────────────────────

type TaskDraft = {
  title: string;
  assigneeId: string | null;
  dueDate: string;
  description: string;
  noteId: string | null;
};

function EditMode({
  task,
  workspaceId,
  members,
  notes,
  canManage,
  userId,
  onCancel,
  onSaved,
}: {
  task: Task;
  workspaceId: string;
  members: Awaited<ReturnType<typeof getWorkspaceMembers>>;
  notes: Awaited<ReturnType<typeof getWorkspaceNotes>>;
  canManage: boolean;
  userId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  // 수동 임시저장 — 자동 저장 안 함. 실제 task 값에서 시작하고, 임시저장본이
  // 있으면 상단 배너로 불러올 수 있게.
  const { draft, save: saveDraft, clear: clearDraftStore, savedAt } =
    useDraft<TaskDraft>(`task-draft:${task.id}:${userId}`);
  const [restored, setRestored] = useState(false);

  const [title, setTitle] = useState(task.title);
  const [assigneeId, setAssigneeId] = useState<string | null>(task.assignee_id);
  const [dueDate, setDueDate] = useState<string>(
    task.due_date ? task.due_date.slice(0, 10) : "",
  );
  const [description, setDescription] = useState(task.description ?? "");
  // 회의록 연결(단일)
  const [noteId, setNoteId] = useState<string | null>(task.note_id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyDraft() {
    if (!draft) return;
    setTitle(draft.title);
    setAssigneeId(draft.assigneeId);
    setDueDate(draft.dueDate);
    setDescription(draft.description);
    setNoteId(draft.noteId);
    setRestored(true);
  }
  function saveDraftNow() {
    saveDraft({ title, assigneeId, dueDate, description, noteId });
  }

  async function persist(opts: { complete: boolean }): Promise<boolean> {
    if (!title.trim()) {
      setError("제목은 필수입니다.");
      return false;
    }
    setBusy(true);
    setError(null);
    const patch: TaskPatch = {
      title: title.trim(),
      assignee_id: assigneeId,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      description: description.trim() ? description : null,
      note_id: noteId,
    };
    if (opts.complete) {
      patch.status = "done";
    }
    const updated = await updateTask(task.id, patch, { actorId: userId });
    if (!updated) {
      setError("저장에 실패했습니다.");
      setBusy(false);
      return false;
    }
    clearDraftStore();
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = await persist({ complete: false });
    if (ok) onSaved();
  }

  async function handleSubmitAndComplete() {
    const ok = await persist({ complete: true });
    if (ok) onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {draft && !restored && (
        <DraftRestoreBanner
          onRestore={applyDraft}
          onDiscard={() => {
            clearDraftStore();
            setRestored(true);
          }}
        />
      )}

      <header>
        <p className="label">Editing Task</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${inputClass} mt-3 text-2xl font-light !py-2 sm:text-3xl`}
          placeholder="제목"
        />
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>담당자</label>
          <select
            value={assigneeId ?? ""}
            onChange={(e) => setAssigneeId(e.target.value || null)}
            className={`${inputClass} mt-2`}
          >
            <option value="">미지정</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profile.name ?? m.profile.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>기한</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={`${inputClass} mt-2`}
          />
        </div>
      </section>

      <div>
        <label className={labelClass}>회의록 연결</label>
        <select
          value={noteId ?? ""}
          onChange={(e) => setNoteId(e.target.value || null)}
          className={`${inputClass} mt-2`}
          aria-label="연결할 회의록"
        >
          <option value="">— 연결 안 함 —</option>
          {notes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass}>내용</label>
        <div className="mt-2">
          <RichEditor
            value={description}
            onChange={setDescription}
            placeholder="과제 설명 / 참고 자료 / 체크리스트 등."
            minHeight={280}
          />
        </div>
      </div>

      <AttachmentsSection
        workspaceId={workspaceId}
        refType="task"
        refId={task.id}
        canManage={canManage}
      />

      {error && <p className={errorBox}>{error}</p>}

      {/* 취소 · 임시저장 · 수정저장 순 */}
      <footer className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="border border-line-strong px-5 py-2.5 text-sm hover:border-foreground disabled:opacity-60"
        >
          취소
        </button>
        <DraftSaveButton onSave={saveDraftNow} savedAt={savedAt} disabled={busy} />
        <button
          type="submit"
          disabled={busy}
          className="border border-accent-teal/40 bg-accent-teal/15 px-5 py-2.5 text-sm text-foreground hover:bg-accent-teal/25 hover:border-accent-teal/60 disabled:opacity-60"
        >
          {busy ? "저장 중..." : "수정 저장"}
        </button>
        {task.status !== "done" && (
          <button
            type="button"
            onClick={handleSubmitAndComplete}
            disabled={busy}
            className="border border-accent-teal bg-accent-teal px-5 py-2.5 text-sm text-accent-foreground hover:bg-accent-teal/85 disabled:opacity-60"
          >
            수정 + 할일 완료
          </button>
        )}
      </footer>
    </form>
  );
}

function MetaCell({
  label,
  value,
  person,
}: {
  label: string;
  value?: string;
  person?: { name: string; avatar_url: string | null };
}) {
  return (
    <div className="bg-surface p-5">
      <p className="text-xs text-foreground-faint">{label}</p>
      {person ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-sm">
          <Avatar
            url={person.avatar_url}
            name={person.name}
            size="xs"
          />
          <span className="truncate">{person.name}</span>
        </div>
      ) : (
        <p className="mt-1.5 text-sm">{value}</p>
      )}
    </div>
  );
}
