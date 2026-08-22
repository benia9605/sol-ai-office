import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useAsync } from "@/lib/use-async";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { getNote, deleteNote } from "@/lib/data/meeting-notes";
import { getMeeting, getMeetingAttendees } from "@/lib/data/meetings";
import { getProfile, getProfiles } from "@/lib/data/profile";
import { getMyRole } from "@/lib/data/workspaces";
import { getTasksForNote } from "@/lib/data/tasks";
import { Avatar } from "@/components/avatar";
import { AttachmentsSection } from "@/features/attachments/attachments-section";
import { RichRender } from "@/features/editor/rich-editor";
import { TaskProgress } from "@/components/task-progress";
import { formatDateTime, formatFullDate, formatShortDate, formatTime } from "@/lib/format";

export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();

  const { data: note, loading } = useAsync(
    () => (id ? getNote(id) : Promise.resolve(null)),
    [id],
  );
  const { data: meeting } = useAsync(
    () => (note?.meeting_id ? getMeeting(note.meeting_id) : Promise.resolve(null)),
    [note?.meeting_id],
  );
  const { data: attendees } = useAsync(
    () =>
      note?.meeting_id
        ? getMeetingAttendees(note.meeting_id)
        : Promise.resolve([]),
    [note?.meeting_id],
  );
  const { data: author } = useAsync(
    () => (note?.created_by ? getProfile(note.created_by) : Promise.resolve(null)),
    [note?.created_by],
  );
  const { data: tasks } = useAsync(
    () => (id ? getTasksForNote(id) : Promise.resolve([])),
    [id],
  );
  const assigneeIds = (tasks ?? [])
    .map((t) => t.assignee_id)
    .filter((id): id is string => !!id);
  const { data: assigneeProfiles } = useAsync(
    () => getProfiles(assigneeIds),
    [assigneeIds.join(",")],
  );
  const { data: myRole } = useAsync(
    () =>
      workspace && user
        ? getMyRole(workspace.id, user.id)
        : Promise.resolve(null),
    [workspace?.id, user?.id],
  );

  if (loading) return null;
  if (!note) return <Navigate to="/notes" replace />;

  const canManage =
    !!user &&
    (note.created_by === user.id ||
      myRole === "owner" ||
      myRole === "admin");

  async function handleDelete() {
    if (!note) return;
    if (!confirm("이 회의록을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    const ok = await deleteNote(note.id);
    if (ok) navigate("/notes");
  }

  return (
    <article className="space-y-14 max-w-3xl">
      <div className="flex items-center justify-between">
        <Link
          to="/notes"
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          ← 회의록
        </Link>
        {canManage && (
          <div className="flex items-center gap-3 text-xs">
            <Link
              to={`/notes/${note.id}/edit`}
              className="text-foreground-muted hover:text-foreground"
            >
              편집
            </Link>
            <span aria-hidden className="text-foreground-faint">
              ·
            </span>
            <button
              type="button"
              onClick={handleDelete}
              className="text-danger hover:underline underline-offset-4"
            >
              삭제
            </button>
          </div>
        )}
      </div>

      <header>
        <p className="label">Meeting Note</p>
        <h1 className="mt-3 text-3xl font-light leading-tight sm:text-4xl">
          {note.title}
        </h1>
        {note.summary && (
          <p className="mt-6 text-base leading-[1.85] text-foreground-muted">
            {note.summary}
          </p>
        )}
      </header>

      <section className="grid gap-px bg-surface-muted border border-line sm:grid-cols-2">
        <Stat
          label="연결된 일정"
          value={
            meeting
              ? `${meeting.title} · ${formatFullDate(meeting.starts_at)} ${formatTime(meeting.starts_at)}`
              : "일정 미연결 (카톡 등)"
          }
          link={meeting ? `/meetings/${meeting.id}` : null}
        />
        <Stat label="작성일" value={formatDateTime(note.created_at)} />
      </section>

      {meeting && (attendees ?? []).length > 0 && (
        <section>
          <h2 className="label mb-4">
            참석자 · {(attendees ?? []).filter((a) => a.status === "attending").length}명
          </h2>
          <ul className="flex flex-wrap gap-2">
            {(attendees ?? [])
              .filter((a) => a.status === "attending")
              .map((a) => {
                const display = a.profile.name ?? a.profile.email;
                return (
                  <li key={a.profile.user_id}>
                    <Link
                      to={`/members/${a.profile.user_id}`}
                      className="flex items-center gap-2 border border-line px-3 py-1.5 text-xs hover:border-foreground"
                    >
                      <Avatar
                        url={a.profile.avatar_url}
                        name={display}
                        size="sm"
                      />
                      <span>{display}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {note.agenda && (
        <section>
          <h2 className="label mb-3">아젠다</h2>
          <ol className="space-y-2 text-sm leading-[1.85] text-foreground-muted">
            {note.agenda
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((item, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[28px_1fr] gap-2 items-baseline"
                >
                  <span className="text-foreground-faint tabular-nums text-right">
                    {i + 1}.
                  </span>
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
          </ol>
        </section>
      )}

      {note.content && (
        <section>
          <h2 className="label mb-3">본문</h2>
          <RichRender html={note.content} />
        </section>
      )}

      {workspace && (
        <AttachmentsSection
          workspaceId={workspace.id}
          refType="meeting_note"
          refId={note.id}
          canManage={canManage}
        />
      )}

      {(tasks ?? []).length > 0 && (
        <section>
          <div className="mb-4 space-y-3">
            <h2 className="label">할일 · {(tasks ?? []).length}</h2>
            <TaskProgress
              done={(tasks ?? []).filter((t) => t.status === "done").length}
              total={(tasks ?? []).length}
            />
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {(tasks ?? []).map((t) => {
              const assignee =
                assigneeProfiles?.find((p) => p.user_id === t.assignee_id) ??
                null;
              const overdue =
                t.due_date &&
                t.status !== "done" &&
                new Date(t.due_date).getTime() < Date.now();
              const done = t.status === "done";
              const assigneeName = assignee
                ? assignee.name ?? assignee.email
                : "미지정";
              const dueText = t.due_date
                ? formatShortDate(t.due_date)
                : "기한 없음";
              return (
                <li key={t.id}>
                  <Link
                    to={`/tasks/${t.id}`}
                    className={`block py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors ${
                      done ? "bg-surface-muted" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3 sm:items-center">
                      <span
                        aria-hidden
                        className={`size-5 mt-0.5 sm:mt-0 shrink-0 border flex items-center justify-center ${
                          done
                            ? "border-accent-teal bg-accent-teal text-accent-foreground"
                            : "border-line-strong"
                        }`}
                        title={done ? "완료" : "미완료"}
                      >
                        {done && <span className="text-xs leading-none">✓</span>}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p
                            className={`text-sm min-w-0 truncate max-w-full ${
                              done
                                ? "line-through text-foreground-faint"
                                : "text-foreground"
                            }`}
                          >
                            {t.title}
                          </p>
                          <span
                            className={`shrink-0 text-[10px] uppercase tracking-wider ${
                              done ? "text-accent-teal" : "text-foreground-faint"
                            }`}
                          >
                            {done ? "완료" : "미완료"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-foreground-muted">
                          <span>담당 · {assigneeName}</span>
                          <span className={overdue ? "text-danger" : ""}>
                            기한 · {dueText}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-foreground-faint">
            행을 클릭하면 상세에서 상태 변경 · 본문 / 첨부 편집이 가능합니다.
          </p>
        </section>
      )}

      {author && (
        <section>
          <h2 className="label mb-4">작성자</h2>
          <Link
            to={`/members/${author.user_id}`}
            className="flex items-center gap-4 border border-line p-5 hover:border-foreground transition-colors"
          >
            <Avatar
              url={author.avatar_url}
              name={author.name ?? author.email}
              size="lg"
            />
            <div>
              <p className="text-sm">{author.name ?? author.email}</p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                {[author.company, author.position].filter(Boolean).join(" · ") ||
                  author.industry ||
                  "—"}
              </p>
            </div>
          </Link>
        </section>
      )}
    </article>
  );
}

function Stat({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: string | null;
}) {
  const body = (
    <div className="bg-surface p-5">
      <p className="text-xs text-foreground-faint">{label}</p>
      <p className="mt-1.5 text-sm">{value}</p>
    </div>
  );
  if (link) {
    return (
      <Link to={link} className="hover:bg-surface-muted transition-colors">
        {body}
      </Link>
    );
  }
  return body;
}

