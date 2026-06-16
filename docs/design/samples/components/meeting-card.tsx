import { Link } from "react-router";
import { formatMonthDay, formatTime } from "@/lib/format";
import { ColorDot } from "@/features/meetings/type-picker";
import { TaskProgress } from "@/components/task-progress";
import type { Meeting, MeetingType } from "@/lib/types/database";

type Props = {
  meeting: Pick<
    Meeting,
    "id" | "title" | "description" | "location" | "starts_at" | "type_id"
  >;
  type?: MeetingType | null;
  attendeeCount?: number;
  /** Task completion stats for this meeting. */
  taskProgress?: { done: number; total: number };
};

export function MeetingCard({
  meeting,
  type,
  attendeeCount,
  taskProgress,
}: Props) {
  const { month, day, weekday } = formatMonthDay(meeting.starts_at);
  const time = formatTime(meeting.starts_at);

  return (
    <Link
      to={`/meetings/${meeting.id}`}
      className="grid grid-cols-[88px_1fr] gap-6 py-8 hover:bg-surface-muted -mx-4 px-4 transition-colors"
    >
      <div className="border-r border-line pr-6">
        <p className="text-xs text-foreground-faint">{month}</p>
        <p className="mt-1 text-3xl font-light leading-none">{day}</p>
        <p className="mt-2 text-xs text-foreground-faint">{weekday}</p>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {type && <ColorDot color={type.color} />}
          <p className="text-base">{meeting.title}</p>
        </div>
        {meeting.description && (
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted line-clamp-2">
            {meeting.description}
          </p>
        )}
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-foreground-muted">
          {type && <span>{type.name}</span>}
          <span>{time}</span>
          {meeting.location && <span>{meeting.location}</span>}
          {typeof attendeeCount === "number" && (
            <span>참석 {attendeeCount}명</span>
          )}
        </dl>
        {taskProgress && taskProgress.total > 0 && (
          <div className="mt-4 max-w-md">
            <TaskProgress
              done={taskProgress.done}
              total={taskProgress.total}
              compact
            />
          </div>
        )}
      </div>
    </Link>
  );
}
