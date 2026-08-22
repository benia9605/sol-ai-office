import { useState } from "react";
import { Link, Navigate } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import {
  listAgendas,
  isAgendaClosed,
  type AgendaWithAuthor,
} from "@/lib/data/agendas";
import { getWorkspaceMembers } from "@/lib/data/workspace-members";
import { Avatar } from "@/components/avatar";
import { Pager, PAGE_SIZE, paginate } from "@/components/pager";

const POLL_LABEL: Record<string, string> = {
  single: "단일선택",
  multi: "복수선택",
  text: "주관식",
};

function deadlineParts(iso: string): {
  month: string;
  day: string;
  weekday: string;
} {
  const d = new Date(iso);
  return {
    month: new Intl.DateTimeFormat("ko-KR", { month: "short" }).format(d),
    day: String(d.getDate()),
    weekday: new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(d),
  };
}

function timeRemainingLabel(deadline: string, closed: boolean): string {
  if (closed) return "마감";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "마감";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days >= 1) return `${days}일 ${hours}시간 남음`;
  if (hours >= 1) return `${hours}시간 남음`;
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${mins}분 남음`;
}

export function AgendasPage() {
  const { user } = useAuth();
  const { workspace, loading: wsLoading } = useActiveWorkspace();
  const [page, setPage] = useState(1);

  const { data: agendas, loading } = useAsync(
    () => (workspace ? listAgendas(workspace.id) : Promise.resolve([])),
    [workspace?.id],
  );
  const { data: members } = useAsync(
    () =>
      workspace ? getWorkspaceMembers(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );

  if (wsLoading || loading) return null;
  if (!user || !workspace) return <Navigate to="/dashboard" replace />;

  const memberCount = (members ?? []).length;

  // 마감일 내림차순. (최신 = 가장 늦은 마감)
  const list = [...(agendas ?? [])].sort((a, b) =>
    b.deadline.localeCompare(a.deadline),
  );

  return (
    <div className="max-w-3xl">
      <header className="flex items-end justify-between border-b border-line pb-6 gap-4">
        <div>
          <p className="label">Agenda</p>
          <h1 className="mt-3 text-3xl font-light">안건 · 투표</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            모두의 의견을 모아 답을 정해요.
          </p>
        </div>
        <Link
          to="/agendas/new"
          className="bg-accent-teal text-accent-foreground px-3 py-1.5 text-xs hover:bg-accent-teal/85 transition-colors"
        >
          + 안건 올리기
        </Link>
      </header>

      {list.length === 0 ? (
        <p className="border-b border-line py-16 text-center text-sm text-foreground-faint">
          아직 등록된 안건이 없습니다.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line border-b border-line">
            {paginate(list, page, PAGE_SIZE).map((a) => (
              <li key={a.id}>
                <AgendaCard agenda={a} memberCount={memberCount} />
              </li>
            ))}
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

function AgendaCard({
  agenda,
  memberCount,
}: {
  agenda: AgendaWithAuthor;
  memberCount: number;
}) {
  const { month, day, weekday } = deadlineParts(agenda.deadline);
  const closed = isAgendaClosed(agenda);
  const display = agenda.author?.name ?? agenda.author?.email ?? "익명";
  const voteCount = agenda.vote_count ?? 0;
  const denom = Math.max(memberCount, voteCount, 1);
  const pct = Math.round((voteCount / denom) * 100);

  return (
    <Link
      to={`/agendas/${agenda.id}`}
      className="grid grid-cols-[88px_1fr] gap-6 py-8 hover:bg-surface-muted -mx-4 px-4 transition-colors"
    >
      <div className="border-r border-line pr-6">
        <p className="text-xs text-foreground-faint">{month}</p>
        <p className="mt-1 text-3xl font-light leading-none">{day}</p>
        <p className="mt-2 text-xs text-foreground-faint">{weekday}</p>
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-base">{agenda.title}</p>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] tracking-widest uppercase ${
              closed
                ? "bg-foreground/5 text-foreground-faint"
                : "bg-accent-teal/10 text-accent-teal"
            }`}
          >
            {closed ? "마감" : "진행 중"}
          </span>
        </div>

        {/* 응답률 진행바 */}
        <div className="mt-3 max-w-md">
          <div className="flex items-baseline justify-between text-xs text-foreground-muted">
            <span>응답률</span>
            <span className="tabular-nums">
              <span className="text-foreground">{voteCount}</span>
              <span className="text-foreground-faint"> / {memberCount}명</span>
              <span className="ml-1.5 text-foreground-faint">· {pct}%</span>
            </span>
          </div>
          <div className="mt-1.5 h-1 bg-line">
            <div
              className={`h-full transition-all ${
                closed ? "bg-foreground-faint" : "bg-accent-teal"
              }`}
              style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
            />
          </div>
        </div>

        <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground-muted">
          <span className="inline-flex items-center gap-1.5">
            <Avatar
              url={agenda.author?.avatar_url ?? null}
              name={display}
              size="xs"
            />
            <span>{display}</span>
          </span>
          <span>{POLL_LABEL[agenda.poll_type] ?? agenda.poll_type}</span>
          <span className={closed ? "text-foreground-faint" : ""}>
            {timeRemainingLabel(agenda.deadline, closed)}
          </span>
        </dl>
      </div>
    </Link>
  );
}
