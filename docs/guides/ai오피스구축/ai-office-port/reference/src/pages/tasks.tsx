import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAuth } from "@/lib/auth-context";
import { useAsync } from "@/lib/use-async";
import { getWorkspaceMembers } from "@/lib/data/workspace-members";
import { createTask, getTasks, updateTask } from "@/lib/data/tasks";
import { TaskRow } from "@/features/tasks/task-row";
import { TaskQuickAddForm } from "@/features/tasks/task-quick-add";
import { Pager, PAGE_SIZE, paginate } from "@/components/pager";
import type { Task, TaskStatus } from "@/lib/types/database";

type Tab = "all" | "mine";
type StatusFilter = "open" | "done" | "all";

export function TasksPage() {
  const { workspace, loading: wsLoading } = useActiveWorkspace();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const scope = params.get("scope");

  const [tab, setTab] = useState<Tab>(scope === "mine" ? "mine" : "all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  function bump() {
    setRefreshKey((v) => v + 1);
  }

  useEffect(() => {
    setTab(scope === "mine" ? "mine" : "all");
  }, [scope]);

  const { data: tasks, loading } = useAsync(
    () =>
      workspace ? getTasks({ workspaceId: workspace.id }) : Promise.resolve([]),
    [workspace?.id, refreshKey],
  );
  const { data: members } = useAsync(
    () =>
      workspace ? getWorkspaceMembers(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );

  const list = tasks ?? [];

  const tabFiltered = useMemo(() => {
    if (tab === "mine") {
      return list.filter((t) => t.assignee_id === user?.id);
    }
    return list;
  }, [list, tab, user?.id]);

  const counts = useMemo(
    () => ({
      all: list.length,
      mine: list.filter((t) => t.assignee_id === user?.id).length,
    }),
    [list, user?.id],
  );

  const filtered = useMemo(() => {
    return tabFiltered
      .filter((t) =>
        tab === "all" && assigneeFilter
          ? t.assignee_id === assigneeFilter
          : true,
      )
      .filter((t) => {
        if (statusFilter === "open") return t.status !== "done";
        if (statusFilter === "done") return t.status === "done";
        return true;
      })
      .sort(compareForList);
  }, [tabFiltered, tab, assigneeFilter, statusFilter]);

  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [tab, assigneeFilter, statusFilter]);

  if (wsLoading) return null;
  if (!user || !workspace) return null;

  async function handleCreate(input: {
    title: string;
    assignee_id: string | null;
    due_date: string | null;
  }) {
    if (!workspace || !user) return;
    await createTask(
      {
        workspace_id: workspace.id,
        title: input.title,
        assignee_id: input.assignee_id,
        due_date: input.due_date,
      },
      user.id,
    );
    bump();
  }

  async function handleToggle(t: Task, next: TaskStatus) {
    await updateTask(t.id, { status: next });
    bump();
  }

  return (
    <div className="space-y-10">
      <header className="flex items-end justify-between border-b border-line pb-6 gap-4">
        <div>
          <p className="label">Tasks</p>
          <h1 className="mt-3 text-3xl font-light">할일</h1>
          <p className="mt-2 text-sm text-foreground-muted">
            오늘의 한 칸을 차근차근 채워봐요.
          </p>
        </div>
        {!addOpen && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="bg-accent-teal text-accent-foreground px-3 py-1.5 text-xs hover:bg-accent-teal/85 transition-colors"
          >
            + 할일 추가
          </button>
        )}
      </header>

      <div className="flex items-end justify-between gap-4 border-b border-line -mb-px">
        <div className="flex gap-6 text-sm">
          <TabButton
            active={tab === "all"}
            onClick={() => setTab("all")}
            label="전체"
            count={counts.all}
          />
          <TabButton
            active={tab === "mine"}
            onClick={() => setTab("mine")}
            label="내 할일"
            count={counts.mine}
          />
        </div>
        <div className="flex items-center gap-3 pb-2 text-xs">
          <span className="text-foreground-faint">{filtered.length}건</span>
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            aria-expanded={filterOpen}
            aria-label="필터"
            className={`inline-flex items-center justify-center w-8 h-8 border transition-colors ${
              filterOpen || activeFilterCount(tab, assigneeFilter, statusFilter) > 0
                ? "border-foreground text-foreground"
                : "border-line-strong text-foreground-muted hover:border-foreground hover:text-foreground"
            }`}
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                d="M3 5h14M6 10h8M9 15h2"
                strokeLinecap="round"
              />
            </svg>
            {activeFilterCount(tab, assigneeFilter, statusFilter) > 0 && (
              <span className="ml-1 text-[10px] tabular-nums">
                {activeFilterCount(tab, assigneeFilter, statusFilter)}
              </span>
            )}
          </button>
        </div>
      </div>

      {filterOpen && (
        <div className="border border-line p-5 space-y-4">
          {tab === "all" && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-foreground-muted w-12 shrink-0">
                담당자
              </span>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="border border-line-strong bg-surface px-2 py-1.5 flex-1 min-w-[160px]"
              >
                <option value="">전체</option>
                {(members ?? []).map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profile.name ?? m.profile.email}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-foreground-muted w-12 shrink-0">상태</span>
            <div className="inline-flex border border-line-strong">
              <StatusPill
                active={statusFilter === "open"}
                onClick={() => setStatusFilter("open")}
                label="미완료"
              />
              <StatusPill
                active={statusFilter === "done"}
                onClick={() => setStatusFilter("done")}
                label="완료"
              />
              <StatusPill
                active={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}
                label="전체"
              />
            </div>
          </div>
          {activeFilterCount(tab, assigneeFilter, statusFilter) > 0 && (
            <button
              type="button"
              onClick={() => {
                setAssigneeFilter("");
                setStatusFilter("all");
              }}
              className="text-xs text-foreground-muted hover:text-foreground"
            >
              필터 초기화
            </button>
          )}
        </div>
      )}

      <section className="space-y-5">
        {addOpen && (
          <TaskQuickAddForm
            members={members ?? []}
            defaultAssigneeId={user.id}
            onCreate={async (input) => {
              await handleCreate(input);
              setAddOpen(false);
            }}
            onClose={() => setAddOpen(false)}
          />
        )}

        {loading ? null : filtered.length === 0 ? (
          <p className="border-b border-line py-12 text-center text-sm text-foreground-faint">
            일치하는 할일이 없습니다.
          </p>
        ) : (
          <>
            <ul className="divide-y divide-line border-b border-line">
              {paginate(filtered, page, PAGE_SIZE).map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  members={members ?? []}
                  onToggle={(next) => handleToggle(t, next)}
                  noteLink={t.note_id ? `/notes/${t.note_id}` : null}
                />
              ))}
            </ul>
            <Pager
              page={page}
              total={filtered.length}
              pageSize={PAGE_SIZE}
              onChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pb-3 -mb-px border-b transition-colors ${
        active
          ? "text-foreground border-foreground"
          : "text-foreground-muted hover:text-foreground border-transparent"
      }`}
    >
      {label}{" "}
      <span
        className={`ml-1 text-xs ${
          active ? "text-foreground" : "text-foreground-faint"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function StatusPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 transition-colors ${
        active
          ? "bg-foreground text-accent-foreground"
          : "text-foreground hover:bg-surface-muted"
      }`}
    >
      {label}
    </button>
  );
}

function activeFilterCount(
  tab: Tab,
  assigneeFilter: string,
  statusFilter: StatusFilter,
): number {
  let n = 0;
  if (tab === "all" && assigneeFilter) n += 1;
  if (statusFilter !== "all") n += 1; // 'all' is the default
  return n;
}

function compareForList(a: Task, b: Task): number {
  // 완료는 아래로, 그 외엔 최신 생성순(내림차순 — 최신이 위로)
  if (a.status === "done" && b.status !== "done") return 1;
  if (b.status === "done" && a.status !== "done") return -1;
  return b.created_at.localeCompare(a.created_at);
}
