import { useState } from "react";
import { Link, useParams, Navigate, useNavigate } from "react-router";
import { useAsync } from "@/lib/use-async";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import {
  deleteMeeting,
  getMeeting,
  getMeetingAttendees,
  setMeetingAttendance,
} from "@/lib/data/meetings";
import { getNotesForMeeting } from "@/lib/data/meeting-notes";
import { getProfile } from "@/lib/data/profile";
import { getMyRole } from "@/lib/data/workspaces";
import { getWorkspaceMeetingTypes } from "@/lib/data/meeting-types";
import { getProject } from "@/lib/data/projects";
import { getTasks } from "@/lib/data/tasks";
import { Avatar } from "@/components/avatar";
import { TaskProgress } from "@/components/task-progress";
import { formatMonthDay, formatTime, formatFullDate, formatShortDateTime } from "@/lib/format";
import type { MeetingAttendeeStatus } from "@/lib/types/database";

export function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);
  function bump() {
    setRefreshKey((v) => v + 1);
  }

  const { data: meeting, loading } = useAsync(
    () => (id ? getMeeting(id) : Promise.resolve(null)),
    [id, refreshKey],
  );
  const { data: attendees } = useAsync(
    () => (id ? getMeetingAttendees(id) : Promise.resolve([])),
    [id, refreshKey],
  );
  const { data: notes } = useAsync(
    () => (id ? getNotesForMeeting(id) : Promise.resolve([])),
    [id, refreshKey],
  );
  const { data: host } = useAsync(
    () =>
      meeting?.created_by ? getProfile(meeting.created_by) : Promise.resolve(null),
    [meeting?.created_by],
  );
  const { data: myRole } = useAsync(
    () =>
      workspace && user
        ? getMyRole(workspace.id, user.id)
        : Promise.resolve(null),
    [workspace?.id, user?.id],
  );
  const { data: meetingTypes } = useAsync(
    () =>
      workspace ? getWorkspaceMeetingTypes(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );
  const { data: meetingTasks } = useAsync(
    () => (id ? getTasks({ workspaceId: workspace?.id ?? "" }).then(
        (rows) => rows.filter((t) => t.meeting_id === id),
      ) : Promise.resolve([])),
    [id, workspace?.id, refreshKey],
  );
  const { data: linkedProject } = useAsync(
    () =>
      meeting?.project_id ? getProject(meeting.project_id) : Promise.resolve(null),
    [meeting?.project_id],
  );

  if (loading) return null;
  if (!meeting) return <Navigate to="/meetings" replace />;

  // 출석 마감 = 일정 4일 전 23:59. 이후엔 운영자만 변경 가능.
  const attendanceDeadline = (() => {
    const d = new Date(meeting.starts_at);
    d.setDate(d.getDate() - 4);
    d.setHours(23, 59, 0, 0);
    return d;
  })();

  const { month, day, weekday } = formatMonthDay(meeting.starts_at);
  const time = formatTime(meeting.starts_at);
  const fullDate = formatFullDate(meeting.starts_at);
  const attList = attendees ?? [];
  const goingCount = attList.filter((a) => a.status === "attending").length;
  const myAttendance = attList.find((a) => a.profile.user_id === user?.id);
  const myStatus = myAttendance?.status ?? null;
  const myReason = myAttendance?.reason ?? null;
  const myRespondedAt = myAttendance?.responded_at ?? null;

  const canManage =
    user &&
    (meeting.created_by === user.id ||
      myRole === "owner" ||
      myRole === "admin");

  const deadlinePassed = Date.now() > attendanceDeadline.getTime();
  const canChangeMine = !deadlinePassed || Boolean(canManage);

  async function changeAttendance(
    status: MeetingAttendeeStatus,
    reason?: string | null,
  ) {
    if (!user || !id) return;
    await setMeetingAttendance(id, user.id, status, reason);
    bump();
  }

  async function handleDelete() {
    if (!meeting) return;
    if (!confirm("이 일정을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    const ok = await deleteMeeting(meeting.id);
    if (ok) navigate("/meetings");
  }

  const noteList = notes ?? [];
  const meetingType =
    meeting.type_id
      ? (meetingTypes ?? []).find((t) => t.id === meeting.type_id) ?? null
      : null;

  return (
    <article className="space-y-14">
      <div className="flex items-center justify-between">
        <Link
          to="/meetings"
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          ← 일정
        </Link>
        {canManage && (
          <div className="flex items-center gap-3 text-xs">
            <Link
              to={`/meetings/${meeting.id}/edit`}
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

      <header className="grid gap-10 sm:grid-cols-[160px_1fr] sm:items-start">
        <div className="sm:border-r sm:border-line sm:pr-6">
          <p className="text-xs text-foreground-faint">{month}</p>
          <p className="mt-1 text-6xl font-light leading-none">{day}</p>
          <p className="mt-3 text-xs text-foreground-faint">{weekday}요일</p>
        </div>
        <div>
          <p className="label">Schedule</p>
          <div className="mt-3 flex items-center gap-2">
            {meetingType && (
              <span
                aria-hidden
                className="rounded-full shrink-0"
                style={{
                  backgroundColor: meetingType.color,
                  width: 10,
                  height: 10,
                }}
              />
            )}
            {meetingType && (
              <span className="text-xs text-foreground-muted">
                {meetingType.name}
              </span>
            )}
            {linkedProject && (
              <Link
                to={`/projects/${linkedProject.id}`}
                className="text-xs text-foreground-muted hover:text-foreground border border-line px-2 py-0.5"
              >
                {linkedProject.emoji} {linkedProject.name}
              </Link>
            )}
          </div>
          <h1 className="mt-3 text-3xl font-light leading-tight sm:text-4xl">
            {meeting.title}
          </h1>
          {meeting.description && (
            <p className="mt-6 text-base leading-[1.85] text-foreground-muted">
              {meeting.description}
            </p>
          )}
        </div>
      </header>

      <section className="grid gap-px bg-surface-muted border border-line sm:grid-cols-4">
        <Stat label="일시" value={fullDate} />
        <Stat label="시간" value={time} />
        <Stat label="장소" value={meeting.location ?? "장소 미정"} />
        <Stat label="참석 예정" value={`${goingCount}명`} />
      </section>

      {(meetingTasks ?? []).length > 0 && (
        <section>
          <p className="label mb-3">
            할일 · {(meetingTasks ?? []).length}
          </p>
          <TaskProgress
            done={(meetingTasks ?? []).filter((t) => t.status === "done").length}
            total={(meetingTasks ?? []).length}
          />
        </section>
      )}

      <section>
        <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
          <h2 className="text-base">회의록 · {noteList.length}</h2>
          <Link
            to={`/notes/new?meeting=${meeting.id}`}
            className="text-xs text-foreground-muted hover:text-foreground"
          >
            + 회의록 작성
          </Link>
        </div>
        {noteList.length === 0 ? (
          <p className="border-b border-line py-10 text-center text-sm text-foreground-faint">
            아직 이 일정에 작성된 회의록이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-line border-b border-line">
            {noteList.map((n) => (
              <li key={n.id}>
                <Link
                  to={`/notes/${n.id}`}
                  className="block py-4 hover:bg-surface-muted -mx-2 px-2 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="text-sm">{n.title}</p>
                    <span className="text-xs text-foreground-faint shrink-0">
                      {formatShortDateTime(n.created_at)}
                    </span>
                  </div>
                  {n.summary && (
                    <p className="mt-1 text-xs text-foreground-muted line-clamp-2">
                      {n.summary}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {host && (
        <section>
          <h2 className="label mb-4">Host</h2>
          <Link
            to={`/members/${host.user_id}`}
            className="flex items-center gap-4 border border-line p-5 hover:border-foreground transition-colors"
          >
            <Avatar
              url={host.avatar_url}
              name={host.name ?? host.email}
              size="lg"
            />
            <div>
              <p className="text-sm">{host.name ?? host.email}</p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                {[host.company, host.position].filter(Boolean).join(" · ") ||
                  host.industry ||
                  "—"}
              </p>
            </div>
          </Link>
        </section>
      )}

      {user && (
        <section>
          <h2 className="label mb-3">내 참석</h2>
          <MyAttendanceCard
            status={myStatus}
            reason={myReason}
            respondedAt={myRespondedAt}
            meetingStartsAt={meeting.starts_at}
            deadline={attendanceDeadline}
            deadlinePassed={deadlinePassed}
            canChange={canChangeMine}
            onSave={changeAttendance}
          />
        </section>
      )}

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="label">Attendees · {attList.length}</h2>
          {canManage && (
            <p className="text-xs text-foreground-faint">
              운영자는 멤버별 상태를 직접 표시할 수 있어요
            </p>
          )}
        </div>
        {attList.length === 0 ? (
          <p className="border-b border-line py-10 text-center text-sm text-foreground-faint">
            아직 참석 표시가 없습니다.
          </p>
        ) : (
          <ul className="grid gap-px bg-surface-muted border border-line sm:grid-cols-2">
            {attList.map((a) => {
              const p = a.profile;
              const display = p.name ?? p.email;
              const showReason =
                (a.status === "late" || a.status === "absent") && a.reason;
              const daysBefore =
                a.responded_at && meeting
                  ? Math.round(
                      (new Date(meeting.starts_at).getTime() -
                        new Date(a.responded_at).getTime()) /
                        (1000 * 60 * 60 * 24),
                    )
                  : null;
              return (
                <li key={p.user_id} className="bg-surface">
                  <div className="flex items-start gap-3 p-4">
                    <Link
                      to={`/members/${p.user_id}`}
                      className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80"
                    >
                      <Avatar url={p.avatar_url} name={display} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{display}</p>
                        <p className="text-xs text-foreground-muted truncate">
                          {p.industry ?? "—"}
                        </p>
                        {showReason && (
                          <>
                            <p className="mt-1 text-xs text-foreground-muted line-clamp-2">
                              {a.status === "late" ? "지각" : "불참"} ·{" "}
                              {a.reason}
                            </p>
                            {daysBefore !== null && (
                              <p className="mt-0.5 text-[11px] text-foreground-faint">
                                {display}이(가){" "}
                                {daysBefore >= 1
                                  ? `일정 ${daysBefore}일 전`
                                  : daysBefore === 0
                                    ? "일정 당일"
                                    : `일정 ${Math.abs(daysBefore)}일 후`}{" "}
                                작성
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </Link>
                    {canManage && id ? (
                      <AttendancePicker
                        status={a.status}
                        meetingId={id}
                        userId={p.user_id}
                        onChanged={bump}
                      />
                    ) : (
                      <StatusBadge status={a.status} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface p-5">
      <p className="text-xs text-foreground-faint">{label}</p>
      <p className="mt-1.5 text-sm">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: MeetingAttendeeStatus }) {
  const map = {
    attending: { text: "참석", className: "text-foreground" },
    absent:    { text: "불참", className: "text-foreground-faint" },
    late:      { text: "지각", className: "text-foreground-muted" },
  };
  const v = map[status];
  return <span className={`text-xs shrink-0 ${v.className}`}>{v.text}</span>;
}

/** 내 참석 — 지각/불참 선택 시 사유 입력 → 작성완료. */
function MyAttendanceCard({
  status,
  reason,
  respondedAt,
  meetingStartsAt,
  deadline,
  deadlinePassed,
  canChange,
  onSave,
}: {
  status: MeetingAttendeeStatus | null;
  reason: string | null;
  respondedAt: string | null;
  meetingStartsAt: string;
  deadline: Date;
  deadlinePassed: boolean;
  canChange: boolean;
  onSave: (
    status: MeetingAttendeeStatus,
    reason?: string | null,
  ) => Promise<void>;
}) {
  // 지각/불참 사유 입력 모드. null 이면 입력창 닫힘.
  const [draftStatus, setDraftStatus] = useState<
    "late" | "absent" | null
  >(null);
  const [draftReason, setDraftReason] = useState("");
  const [busy, setBusy] = useState(false);

  function startDraft(next: "late" | "absent") {
    setDraftStatus(next);
    setDraftReason(status === next ? reason ?? "" : "");
  }

  async function submitDraft() {
    if (!draftStatus) return;
    if (!draftReason.trim()) return;
    setBusy(true);
    try {
      await onSave(draftStatus, draftReason);
      setDraftStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function markAttending() {
    setBusy(true);
    try {
      await onSave("attending", null);
    } finally {
      setBusy(false);
    }
  }

  const labels = { attending: "참석", late: "지각", absent: "불참" } as const;
  const activeStyle: Record<MeetingAttendeeStatus, string> = {
    attending: "border-accent-teal bg-accent-teal text-accent-foreground",
    late: "border-accent-amber bg-accent-amber text-accent-foreground",
    absent: "border-foreground bg-foreground text-accent-foreground",
  };

  // 며칠 전 작성했는지 — 일정 시작 시각 기준
  const daysBeforeMeeting = (() => {
    if (!respondedAt) return null;
    const ms =
      new Date(meetingStartsAt).getTime() - new Date(respondedAt).getTime();
    const days = Math.round(ms / (1000 * 60 * 60 * 24));
    return days;
  })();

  return (
    <div className="border-y border-line py-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-foreground-muted mr-2">
          현재 ·{" "}
          <span className="text-foreground">
            {status === "attending"
              ? "참석"
              : status === "late"
                ? "지각"
                : status === "absent"
                  ? "불참"
                  : "미표시"}
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            setDraftStatus(null);
            markAttending();
          }}
          disabled={!canChange || busy || status === "attending"}
          className={`border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
            status === "attending"
              ? activeStyle.attending
              : "border-line-strong text-foreground-muted hover:border-foreground hover:text-foreground"
          }`}
        >
          {labels.attending}
        </button>
        <button
          type="button"
          onClick={() => startDraft("late")}
          disabled={!canChange || busy}
          className={`border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
            status === "late" && draftStatus !== "late"
              ? activeStyle.late
              : "border-line-strong text-foreground-muted hover:border-foreground hover:text-foreground"
          }`}
        >
          {labels.late}
        </button>
        <button
          type="button"
          onClick={() => startDraft("absent")}
          disabled={!canChange || busy}
          className={`border px-3 py-1.5 text-xs transition-colors disabled:opacity-50 ${
            status === "absent" && draftStatus !== "absent"
              ? activeStyle.absent
              : "border-line-strong text-foreground-muted hover:border-foreground hover:text-foreground"
          }`}
        >
          {labels.absent}
        </button>
      </div>

      {draftStatus && (
        <div className="space-y-2">
          <label className="text-xs text-foreground-muted">
            {draftStatus === "late" ? "지각" : "불참"} 사유
          </label>
          <textarea
            value={draftReason}
            onChange={(e) => setDraftReason(e.target.value)}
            placeholder="멤버들이 알 수 있도록 짧게 적어주세요."
            rows={2}
            autoFocus
            className="w-full border border-line-strong bg-surface px-3 py-2 text-sm focus:border-foreground focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraftStatus(null)}
              disabled={busy}
              className="border border-line-strong px-3 py-1.5 text-xs hover:border-foreground disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submitDraft}
              disabled={busy || !draftReason.trim()}
              className="border border-accent bg-accent px-3 py-1.5 text-xs text-accent-foreground hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-60"
            >
              {busy ? "저장 중..." : "작성 완료"}
            </button>
          </div>
        </div>
      )}

      {/* 기존 사유 + 작성자 + 작성 시점 + 수정 버튼 */}
      {!draftStatus && (status === "late" || status === "absent") && reason && (
        <div className="bg-surface-muted border border-line px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs text-foreground-muted">
              {status === "late" ? "지각" : "불참"} 사유
            </p>
            {canChange && (
              <button
                type="button"
                onClick={() => startDraft(status as "late" | "absent")}
                className="text-[11px] text-foreground-muted hover:text-foreground underline underline-offset-2"
              >
                수정
              </button>
            )}
          </div>
          <p className="mt-1 text-sm whitespace-pre-line">{reason}</p>
          <p className="mt-1.5 text-[11px] text-foreground-faint">
            내가
            {daysBeforeMeeting !== null
              ? daysBeforeMeeting >= 1
                ? ` 일정 ${daysBeforeMeeting}일 전`
                : daysBeforeMeeting === 0
                  ? " 일정 당일"
                  : ` 일정 ${Math.abs(daysBeforeMeeting)}일 후`
              : ""}{" "}
            작성
          </p>
        </div>
      )}

      <p className="text-[11px] text-foreground-faint">
        {deadlinePassed
          ? `작성 마감 (${deadline.toLocaleDateString("ko-KR")} 23:59 지남) — 운영자만 변경 가능`
          : `작성 마감 — ${deadline.toLocaleDateString("ko-KR", {
              month: "long",
              day: "numeric",
              weekday: "short",
            })} 23:59 (일정 4일 전)`}
      </p>
    </div>
  );
}

function AttendancePicker({
  status,
  meetingId,
  userId,
  onChanged,
}: {
  status: MeetingAttendeeStatus;
  meetingId: string;
  userId: string;
  onChanged: () => void;
}) {
  const opts: Array<{ key: MeetingAttendeeStatus; label: string; cls: string }> =
    [
      { key: "attending", label: "참석", cls: "border-accent-teal bg-accent-teal text-accent-foreground" },
      { key: "late",      label: "지각", cls: "border-accent-amber bg-accent-amber text-accent-foreground" },
      { key: "absent",    label: "불참", cls: "border-foreground bg-foreground text-accent-foreground" },
    ];
  return (
    <div className="flex items-center gap-1 shrink-0">
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={async () => {
            await setMeetingAttendance(
              meetingId,
              userId,
              o.key,
              null,
              false, // 운영자 override — 활동 피드에 기록 안 함
            );
            onChanged();
          }}
          className={`border px-2 py-1 text-[11px] transition-colors ${
            status === o.key
              ? o.cls
              : "border-line-strong text-foreground-muted hover:border-foreground hover:text-foreground"
          }`}
          aria-label={`${o.label} 으로 변경`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
