import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useAsync } from "@/lib/use-async";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { getMyRole } from "@/lib/data/workspaces";
import { getWorkspaceMeetings } from "@/lib/data/meetings";
import { getWorkspaceMembers } from "@/lib/data/workspace-members";
import { deleteNote, getNote, updateNote } from "@/lib/data/meeting-notes";
import { getTasks, getTasksForNote, syncTasksForNote } from "@/lib/data/tasks";
import { NoteForm } from "@/features/notes/note-form";

export function NoteEditPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();

  const { data: note, loading } = useAsync(
    () => (id ? getNote(id) : Promise.resolve(null)),
    [id],
  );
  const { data: meetings } = useAsync(
    () =>
      workspace ? getWorkspaceMeetings(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );
  const { data: members } = useAsync(
    () =>
      workspace ? getWorkspaceMembers(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );
  const { data: existingTasks } = useAsync(
    () => (id ? getTasksForNote(id) : Promise.resolve([])),
    [id],
  );
  const { data: workspaceTasks } = useAsync(
    () =>
      workspace
        ? getTasks({ workspaceId: workspace.id })
        : Promise.resolve([]),
    [workspace?.id],
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
  if (!user) return null;

  const canManage =
    note.created_by === user.id ||
    myRole === "owner" ||
    myRole === "admin";
  if (!canManage) return <Navigate to={`/notes/${note.id}`} replace />;

  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <Link
          to={`/notes/${note.id}`}
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          ← 회의록
        </Link>
      </div>

      {meetings === null || members === null || existingTasks === null ? (
        <p className="border-y border-line py-10 text-center text-sm text-foreground-faint">
          로딩 중...
        </p>
      ) : (
        <NoteForm
          initial={note}
          meetings={meetings}
          members={members}
          initialTasks={existingTasks}
          workspaceTasks={workspaceTasks ?? []}
          draftKey={`note-draft:${note.id}:${user.id}`}
          submitLabel="수정 저장"
          onSubmit={async (values, actions) => {
            const updated = await updateNote(note.id, values);
            if (!updated) throw new Error("회의록 수정에 실패했습니다.");

            await syncTasksForNote(
              note.id,
              workspace!.id,
              updated.meeting_id,
              user.id,
              {
                keep: actions
                  .filter((a) => a.id)
                  .map((a) => ({
                    id: a.id!,
                    patch: {
                      title: a.title,
                      assignee_id: a.assignee_id,
                      due_date: a.due_date
                        ? new Date(a.due_date).toISOString()
                        : null,
                      meeting_id: updated.meeting_id,
                    },
                  })),
                create: actions
                  .filter((a) => !a.id)
                  .map((a) => ({
                    title: a.title,
                    assignee_id: a.assignee_id,
                    due_date: a.due_date
                      ? new Date(a.due_date).toISOString()
                      : null,
                  })),
              },
            );

            navigate(`/notes/${note.id}`);
          }}
          onCancel={() => navigate(`/notes/${note.id}`)}
          onDelete={async () => {
            const ok = await deleteNote(note.id);
            if (!ok) throw new Error("삭제에 실패했습니다.");
            navigate("/notes");
          }}
        />
      )}
    </div>
  );
}
