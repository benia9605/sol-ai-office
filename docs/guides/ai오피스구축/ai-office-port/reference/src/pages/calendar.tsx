import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import { getWorkspaceMeetings } from "@/lib/data/meetings";
import { getWorkspaceMeetingTypes } from "@/lib/data/meeting-types";
import { getTasks } from "@/lib/data/tasks";
import {
  MonthCalendar,
  type CalendarEvent,
} from "@/features/meetings/month-calendar";
import { formatShortDate, formatTime } from "@/lib/format";

const TASK_COLOR = "#b5862c";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function sameDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}
function sameMonth(iso: string, ref: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
  );
}

export function CalendarPage() {
  const { user } = useAuth();
  const { workspace, loading: wsLoading } = useActiveWorkspace();

  const [visibleMonth, setVisibleMonth] = useState<Date>(() =>
    startOfMonth(new Date()),
  );
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data: meetings } = useAsync(
    () =>
      workspace ? getWorkspaceMeetings(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );
  const { data: types } = useAsync(
    () =>
      workspace ? getWorkspaceMeetingTypes(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );
  const { data: tasks } = useAsync(
    () =>
      workspace
        ? getTasks({ workspaceId: workspace.id })
        : Promise.resolve([]),
    [workspace?.id],
  );

  const typesById = useMemo(
    () => new Map((types ?? []).map((t) => [t.id, t])),
    [types],
  );

  const allMeetings = meetings ?? [];
  const datedTasks = (tasks ?? []).filter((t) => t.due_date);

  // Build calendar events from meetings + tasks. Each task is tinted amber so
  // it visually separates from typed meetings.
  const events: CalendarEvent[] = useMemo(() => {
    const out: CalendarEvent[] = [];
    allMeetings.forEach((m) => {
      out.push({
        id: `m-${m.id}`,
        date: m.starts_at,
        title: m.title,
        color: m.type_id
          ? typesById.get(m.type_id)?.color ?? "#a1a1a1"
          : "#a1a1a1",
      });
    });
    datedTasks.forEach((t) => {
      out.push({
        id: `t-${t.id}`,
        date: t.due_date!,
        title: `· ${t.title}`,
        color: t.status === "done" ? "#a1a1a1" : TASK_COLOR,
      });
    });
    return out;
  }, [allMeetings, datedTasks, typesById]);

  if (wsLoading || !workspace || !user) return null;

  // Filter both lists by selected day or by visible month
  const meetingsInScope = selectedDay
    ? allMeetings.filter((m) => sameDay(m.starts_at, selectedDay))
    : allMeetings.filter((m) => sameMonth(m.starts_at, visibleMonth));
  const tasksInScope = selectedDay
    ? datedTasks.filter((t) => sameDay(t.due_date!, selectedDay))
    : datedTasks.filter((t) => sameMonth(t.due_date!, visibleMonth));

  const selectedLabel = selectedDay
    ? new Intl.DateTimeFormat("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
      }).format(selectedDay)
    : null;

  return (
    <div className="space-y-10">
      <header className="border-b border-line pb-6">
        <p className="label">Calendar</p>
        <h1 className="mt-3 text-3xl font-light">캘린더</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          다음 한 걸음의 약속들.
        </p>
      </header>

      <MonthCalendar
        visibleMonth={visibleMonth}
        onChangeMonth={(d) => {
          setVisibleMonth(d);
          setSelectedDay(null);
        }}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
        events={events}
      />

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-foreground-muted">
        {(types ?? []).map((t) => (
          <li key={t.id} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="rounded-full"
              style={{ backgroundColor: t.color, width: 8, height: 8 }}
            />
            {t.name}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="rounded-full"
            style={{ backgroundColor: TASK_COLOR, width: 8, height: 8 }}
          />
          할일 기한
        </li>
      </ul>

      {selectedLabel && (
        <div className="flex items-center justify-between text-xs">
          <p className="text-foreground-muted">
            {selectedLabel} · 일정 {meetingsInScope.length}건 · 할일{" "}
            {tasksInScope.length}건
          </p>
          <button
            type="button"
            onClick={() => setSelectedDay(null)}
            className="text-foreground-muted hover:text-foreground"
          >
            선택 해제
          </button>
        </div>
      )}

      <section>
        <h2 className="label mb-3">일정 · {meetingsInScope.length}</h2>
        {meetingsInScope.length === 0 ? (
          <p className="border-b border-line py-8 text-center text-sm text-foreground-faint">
            {selectedDay
              ? "이 날에 등록된 일정이 없습니다."
              : "이 달에 등록된 일정이 없습니다."}
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {meetingsInScope.map((m) => {
              const t = m.type_id ? typesById.get(m.type_id) : null;
              return (
                <li key={m.id}>
                  <Link
                    to={`/meetings/${m.id}`}
                    className="flex items-center gap-3 py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors"
                  >
                    {t && (
                      <span
                        aria-hidden
                        className="rounded-full shrink-0"
                        style={{
                          backgroundColor: t.color,
                          width: 8,
                          height: 8,
                        }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{m.title}</p>
                      <p className="text-xs text-foreground-faint truncate">
                        {formatShortDate(m.starts_at)} · {formatTime(m.starts_at)}
                        {m.location ? ` · ${m.location}` : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="label">할일 · {tasksInScope.length}</h2>
          <Link
            to="/tasks"
            className="text-xs text-foreground-muted hover:text-foreground"
          >
            전체 할일 →
          </Link>
        </div>
        {tasksInScope.length === 0 ? (
          <p className="border-b border-line py-8 text-center text-sm text-foreground-faint">
            {selectedDay
              ? "이 날 기한의 할일이 없습니다."
              : "이 달 기한의 할일이 없습니다."}
          </p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {tasksInScope.map((t) => {
              const done = t.status === "done";
              const overdue =
                !done && new Date(t.due_date!).getTime() < Date.now();
              return (
                <li key={t.id} className="py-4">
                  <p
                    className={`text-sm ${
                      done
                        ? "line-through text-foreground-faint"
                        : "text-foreground"
                    }`}
                  >
                    {t.title}
                  </p>
                  <p className="mt-1 text-xs text-foreground-faint">
                    기한{" "}
                    <span className={overdue ? "text-danger" : ""}>
                      {formatShortDate(t.due_date!)}
                    </span>
                    {done ? " · 완료" : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
