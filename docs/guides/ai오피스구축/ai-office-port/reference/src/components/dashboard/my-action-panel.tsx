import { Link } from "react-router";
import type { Meeting, Task } from "@/lib/types/database";
import type { AgendaWithAuthor } from "@/lib/data/agendas";

type AttendancePending = {
  meeting: Pick<Meeting, "id" | "title" | "starts_at">;
  deadline: Date;
};

type Props = {
  /** 다음 모임 출석 미응답 (마감 안 지남) 이 있을 때만. */
  attendance: AttendancePending | null;
  /** 내가 아직 투표 안 한 open agenda 들. */
  pendingAgendas: AgendaWithAuthor[];
  /** 오늘 또는 지난 마감 (미완료) 내 할일. */
  pendingTasks: Task[];
  /** 내 임시저장 글/인사이트 갯수. */
  draftCount: number;
};

/**
 * 홈 상단의 "내가 해야 할 것" 카드. 항목이 하나라도 있을 때만 렌더.
 * 다음 모임 출석 / 미응답 안건 / 오늘 마감 할일 / 임시저장 — 한눈에.
 */
export function MyActionPanel({
  attendance,
  pendingAgendas,
  pendingTasks,
  draftCount,
}: Props) {
  const total =
    (attendance ? 1 : 0) +
    pendingAgendas.length +
    pendingTasks.length +
    (draftCount > 0 ? 1 : 0);
  if (total === 0) return null;

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="label">
          확인이 필요한 일{" "}
          <span className="ml-1 text-foreground-faint tabular-nums">
            {total}
          </span>
        </h2>
      </div>
      <ul className="border border-accent-teal/40 bg-accent-teal/[0.03] divide-y divide-line">
        {attendance && (
          <ActionRow
            to={`/meetings/${attendance.meeting.id}`}
            tag="출석"
            title={attendance.meeting.title}
            sub={`${formatBy(attendance.deadline)} 까지 응답`}
          />
        )}
        {pendingAgendas.map((a) => (
          <ActionRow
            key={a.id}
            to={`/agendas/${a.id}`}
            tag="투표"
            title={a.title}
            sub={timeLeftLabel(a.deadline)}
          />
        ))}
        {pendingTasks.map((t) => (
          <ActionRow
            key={t.id}
            to={`/tasks/${t.id}`}
            tag="할일"
            title={t.title}
            sub={taskDueLabel(t.due_date)}
            danger={taskOverdue(t.due_date)}
          />
        ))}
        {draftCount > 0 && (
          <ActionRow
            to="/me/posts"
            tag="초안"
            title="임시저장된 글이 있어요"
            sub={`${draftCount}건 — 마저 완성해 보기`}
          />
        )}
      </ul>
    </section>
  );
}

function ActionRow({
  to,
  tag,
  title,
  sub,
  danger,
}: {
  to: string;
  tag: string;
  title: string;
  sub: string;
  danger?: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-muted transition-colors"
      >
        <span className="shrink-0 text-[10px] tracking-widest uppercase text-foreground-faint w-10">
          {tag}
        </span>
        <span className="min-w-0 flex-1 text-sm truncate">{title}</span>
        <span
          className={`shrink-0 text-xs tabular-nums ${
            danger ? "text-danger" : "text-foreground-muted"
          }`}
        >
          {sub}
        </span>
      </Link>
    </li>
  );
}

function formatBy(d: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(d);
}

function timeLeftLabel(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "마감";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days >= 1) return `${days}일 남음`;
  if (hours >= 1) return `${hours}시간 남음`;
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${mins}분 남음`;
}

function taskDueLabel(due: string | null | undefined): string {
  if (!due) return "기한 없음";
  const dueDate = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(dueDate);
  dueDay.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff < 0) return `${Math.abs(diff)}일 지남`;
  if (diff === 0) return "오늘 마감";
  if (diff === 1) return "내일 마감";
  return `${diff}일 남음`;
}

function taskOverdue(due: string | null | undefined): boolean {
  if (!due) return false;
  return new Date(due).getTime() < Date.now();
}
