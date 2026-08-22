import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import { getWorkspaceNotes } from "@/lib/data/meeting-notes";
import { getTasks } from "@/lib/data/tasks";
import { TaskProgress } from "@/components/task-progress";
import { Pager, PAGE_SIZE, paginate } from "@/components/pager";
import { formatShortDateTime } from "@/lib/format";
import { notePreview } from "@/lib/note-preview";

export function NotesPage() {
  const { workspace, loading: wsLoading } = useActiveWorkspace();
  const [page, setPage] = useState(1);

  const { data: notes, loading } = useAsync(
    () =>
      workspace ? getWorkspaceNotes(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );
  const { data: tasks } = useAsync(
    () =>
      workspace
        ? getTasks({ workspaceId: workspace.id })
        : Promise.resolve([]),
    [workspace?.id],
  );

  const list = notes ?? [];

  /** Task progress grouped by note_id. */
  const progressByNote = useMemo(() => {
    const map = new Map<string, { done: number; total: number }>();
    (tasks ?? []).forEach((t) => {
      if (!t.note_id) return;
      const prev = map.get(t.note_id) ?? { done: 0, total: 0 };
      prev.total += 1;
      if (t.status === "done") prev.done += 1;
      map.set(t.note_id, prev);
    });
    return map;
  }, [tasks]);

  if (wsLoading) return null;

  return (
    <div>
      <header className="flex items-end justify-between border-b border-line pb-6 gap-4">
        <div>
          <p className="label">All Notes</p>
          <h1 className="mt-3 text-3xl font-light">회의록</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            함께 나눈 대화, 다시 꺼내 볼 수 있도록.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-foreground-faint">{list.length}건</p>
          <Link
            to="/notes/new"
            className="bg-accent-teal text-accent-foreground px-3 py-1.5 text-xs hover:bg-accent-teal/85 transition-colors"
          >
            + 회의록 작성
          </Link>
        </div>
      </header>

      {loading ? null : list.length === 0 ? (
        <p className="border-b border-line py-16 text-center text-sm text-foreground-faint">
          아직 작성된 회의록이 없습니다.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line border-b border-line">
            {paginate(list, page, PAGE_SIZE).map((n) => {
              const preview = notePreview(n);
              const p = progressByNote.get(n.id);
              return (
                <li key={n.id}>
                  <Link
                    to={`/notes/${n.id}`}
                    className="block py-5 hover:bg-surface-muted -mx-4 px-4 transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-4">
                      <p className="text-base">{n.title}</p>
                      <span className="text-xs text-foreground-faint shrink-0">
                        {formatShortDateTime(n.created_at)}
                      </span>
                    </div>
                    {preview && (
                      <p className="mt-2.5 text-xs text-foreground-muted line-clamp-2 leading-relaxed">
                        {preview}
                      </p>
                    )}
                    {p && (
                      <div className="mt-4 max-w-md">
                        <TaskProgress done={p.done} total={p.total} compact />
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Pager
            page={page}
            total={list.length}
            pageSize={PAGE_SIZE}
            onChange={setPage}
          />
        </>
      )}
    </div>
  );
}
