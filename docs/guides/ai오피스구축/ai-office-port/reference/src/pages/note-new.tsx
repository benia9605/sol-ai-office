import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { useAsync } from "@/lib/use-async";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { getWorkspaceMeetings, getMeeting } from "@/lib/data/meetings";
import { getWorkspaceMembers } from "@/lib/data/workspace-members";
import { createNote } from "@/lib/data/meeting-notes";
import { getTasks, syncTasksForNote } from "@/lib/data/tasks";
import { NoteForm } from "@/features/notes/note-form";

export function NoteNewPage() {
  const { user } = useAuth();
  const { workspace, loading: wsLoading } = useActiveWorkspace();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const presetMeetingId = params.get("meeting");

  const { data: meetings } = useAsync(
    () => (workspace ? getWorkspaceMeetings(workspace.id) : Promise.resolve([])),
    [workspace?.id],
  );
  const { data: members } = useAsync(
    () => (workspace ? getWorkspaceMembers(workspace.id) : Promise.resolve([])),
    [workspace?.id],
  );
  const { data: preselect } = useAsync(
    () => (presetMeetingId ? getMeeting(presetMeetingId) : Promise.resolve(null)),
    [presetMeetingId],
  );
  const { data: workspaceTasks } = useAsync(
    () => (workspace ? getTasks({ workspaceId: workspace.id }) : Promise.resolve([])),
    [workspace?.id],
  );

  if (wsLoading) return null;
  if (!user || !workspace) return <Navigate to="/notes" replace />;

  return (
    <div className="space-y-10 max-w-3xl">
      <div>
        <Link
          to="/notes"
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          ← 회의록
        </Link>
      </div>

      {meetings === null || members === null ? (
        <p className="border-y border-line py-10 text-center text-sm text-foreground-faint">
          로딩 중...
        </p>
      ) : (
        <NoteForm
          meetings={meetings}
          members={members}
          preselectMeeting={preselect ?? null}
          workspaceTasks={workspaceTasks ?? []}
          draftKey={`note-draft:new:${workspace.id}:${user.id}`}
          submitLabel="회의록 작성"
          onSubmit={async (values, actions) => {
            const created = await createNote(
              { ...values, workspace_id: workspace.id },
              user.id,
            );
            if (!created) throw new Error("회의록 생성에 실패했습니다.");

            // 새 노트라 기존 연결은 없음 — keep(기존 할일 불러온 것) + create(새로 입력) 동기화
            await syncTasksForNote(
              created.id,
              workspace.id,
              created.meeting_id,
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
                      meeting_id: created.meeting_id,
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
            navigate(`/notes/${created.id}`);
          }}
          onCancel={() => navigate("/notes")}
        />
      )}
    </div>
  );
}
