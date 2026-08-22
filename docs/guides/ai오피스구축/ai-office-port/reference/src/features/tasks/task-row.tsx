import { Link } from "react-router";
import { Avatar } from "@/components/avatar";
import { formatShortDate } from "@/lib/format";
import type { Task, TaskStatus } from "@/lib/types/database";
import type { MemberWithProfile } from "@/lib/data/workspace-members";

type Props = {
  task: Task;
  members: MemberWithProfile[];
  /** Toggle the done status. When omitted, the checkbox is non-interactive. */
  onToggle?: (next: TaskStatus) => Promise<void> | void;
  /** Link back to the note this task belongs to, if any. */
  noteLink?: string | null;
};

export function TaskRow({ task, members, onToggle, noteLink }: Props) {
  const done = task.status === "done";
  const assignee = members.find((m) => m.user_id === task.assignee_id);
  const assigneeName = assignee?.profile.name ?? assignee?.profile.email ?? null;
  const overdue =
    !done &&
    task.due_date &&
    new Date(task.due_date).getTime() < Date.now();

  return (
    <li>
      <Link
        to={`/tasks/${task.id}`}
        className={`block py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors ${
          done ? "bg-surface-muted" : ""
        }`}
      >
        <div className="flex items-start gap-3 sm:items-center">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onToggle) void onToggle(done ? "todo" : "done");
            }}
            disabled={!onToggle}
            aria-label={done ? "미완료로 표시" : "완료로 표시"}
            title={done ? "완료 (클릭해 미완료로)" : "미완료 (클릭해 완료로)"}
            className={`size-5 mt-0.5 sm:mt-0 shrink-0 border flex items-center justify-center transition-colors ${
              done
                ? "border-accent-teal bg-accent-teal text-accent-foreground"
                : "border-line-strong hover:border-foreground"
            } ${onToggle ? "cursor-pointer" : "cursor-default"}`}
          >
            {done && <span className="text-xs leading-none">✓</span>}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p
                className={`text-sm min-w-0 truncate max-w-full ${
                  done
                    ? "line-through text-foreground-faint"
                    : "text-foreground"
                }`}
              >
                {task.title}
              </p>
              {noteLink && (
                <Link
                  to={noteLink}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 text-xs text-foreground-faint hover:text-accent-teal"
                >
                  ↗ 회의록
                </Link>
              )}
              <span
                className={`shrink-0 text-[10px] uppercase tracking-wider ${
                  done ? "text-accent-teal" : "text-foreground-faint"
                }`}
              >
                {done ? "완료" : "미완료"}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-foreground-muted sm:hidden">
              <span className="inline-flex items-center gap-1">
                담당 ·
                {assigneeName ? (
                  <>
                    <Avatar
                      url={assignee?.profile.avatar_url ?? null}
                      name={assigneeName}
                      size="xs"
                    />
                    <span>{assigneeName}</span>
                  </>
                ) : (
                  <span>미지정</span>
                )}
              </span>
              <span className={overdue ? "text-danger" : ""}>
                기한 · {task.due_date ? formatShortDate(task.due_date) : "없음"}
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-sm text-foreground-muted w-40 shrink-0">
            <span>담당 ·</span>
            {assigneeName ? (
              <>
                <Avatar
                  url={assignee?.profile.avatar_url ?? null}
                  name={assigneeName}
                  size="xs"
                />
                <span className="truncate">{assigneeName}</span>
              </>
            ) : (
              <span>미지정</span>
            )}
          </div>
          <p
            className={`hidden sm:block text-sm shrink-0 w-28 ${
              overdue ? "text-danger" : "text-foreground-faint"
            }`}
          >
            {task.due_date ? formatShortDate(task.due_date) : "기한 없음"}
          </p>
        </div>
      </Link>
    </li>
  );
}
