/* ============================================================================
 * 화면 ① — 할일 목록 페이지   (라우트: /tasks)
 * ============================================================================
 *
 * 밋업 원본을 한 파일로 합친 디자인 참고본.
 *   src/pages/tasks.tsx                     ← 페이지 본체
 *   src/features/tasks/task-row.tsx         ← 리스트 행       (아래 TaskRow)
 *   src/features/tasks/task-quick-add.tsx   ← 인라인 추가 폼  (아래 TaskQuickAddForm)
 *   src/components/pager.tsx                ← 페이저          (아래 Pager)
 *   src/components/avatar.tsx               ← 아바타          (아래 Avatar)
 *
 * 원본은 파일이 나뉘어 있지만, 이 화면에서 "보이는 것 전부"를 한 눈에 보라고
 * 합쳐 두었다. className 과 마크업 구조는 원본 그대로다.
 *
 * ─── 화면 스케치 ────────────────────────────────────────────────────────────
 *
 *   Tasks                                                 [+ 할일 추가]
 *   할일
 *   오늘의 한 칸을 차근차근 채워봐요.
 *   ──────────────────────────────────────────────────────────────────  border-b
 *   전체 24   내 할일 7                              12건        [⚙ 2]
 *   ──────────────────────────────────────────────────────────────────
 *   ┌ (필터 서랍 — 접혀 있음이 기본) ────────────────────────────────┐
 *   │ 담당자 [전체 ▾]                                              │
 *   │ 상태   [미완료][완료][전체]                                   │
 *   │ 필터 초기화                                                   │
 *   └──────────────────────────────────────────────────────────────┘
 *   ☑ 예산안 초안 작성   ↗회의록   완료    담당 · (av)김대표    8/24
 *   ☐ 경쟁사 리서치                미완료   담당 · (av)박이사    8/20  ← danger
 *   ☐ 채용 공고 초안               미완료   담당 · 미지정        기한 없음
 *   ──────────────────────────────────────────────────────────────────
 *                            ‹   1 / 3   ›
 *
 * ─── 디자인 규칙 ────────────────────────────────────────────────────────────
 *  · 그림자 없음. 깊이는 hairline border(`border-line`) 로만.
 *  · 둥근 모서리 없음 (체크박스도 사각형).
 *  · 액센트 색(`accent-teal`)은 "완료" 상태와 등록 버튼에만.
 *  · 탭 nav 의 border-b 와 첫 행이 곧장 맞닿는다 — 사이에 여백을 넣지 않는다.
 *  · 필터는 접힌 서랍. 기본 화면이 컨트롤로 덮이지 않게.
 *  · 모바일: 담당/기한이 제목 아래 둘째 줄 / 데스크탑: 오른쪽 고정폭 열.
 *    같은 정보를 폭에 따라 재배치 → 가로 스크롤이 절대 생기지 않는다.
 * ========================================================================== */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAuth } from "@/lib/auth-context";
import { useAsync } from "@/lib/use-async";
import { getWorkspaceMembers } from "@/lib/data/workspace-members";
import { createTask, getTasks, updateTask } from "@/lib/data/tasks";
import { formatShortDate } from "@/lib/format";
import { inputClass, labelClass } from "@/features/auth/_shared";
import type { Task, TaskStatus } from "@/lib/types/database";
import type { MemberWithProfile } from "@/lib/data/workspace-members";

type Tab = "all" | "mine";
type StatusFilter = "open" | "done" | "all";

export const PAGE_SIZE = 20;

// ═══════════════════════════════════════════════════════════════════════════
// 페이지
// ═══════════════════════════════════════════════════════════════════════════

export function TasksPage() {
  const { workspace, loading: wsLoading } = useActiveWorkspace();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const scope = params.get("scope"); // ?scope=mine 으로 들어오면 「내 할일」 탭

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
    () => (workspace ? getWorkspaceMembers(workspace.id) : Promise.resolve([])),
    [workspace?.id],
  );

  const list = tasks ?? [];

  const tabFiltered = useMemo(() => {
    if (tab === "mine") return list.filter((t) => t.assignee_id === user?.id);
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
        tab === "all" && assigneeFilter ? t.assignee_id === assigneeFilter : true,
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
    // ★ 알림(new_task)은 createTask 안에서 담당자에게 자동 발송된다.
    //   페이지는 알림 코드를 한 줄도 쓰지 않는다.
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
    // ★ 완료 전환 감지 → 활동 피드 + 전체 알림도 updateTask 안에서.
    await updateTask(t.id, { status: next });
    bump();
  }

  return (
    <div className="space-y-10">
      {/* ── 페이지 헤더 ───────────────────────────────────────────────── */}
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

      {/* ── 탭 + 카운트 + 필터 토글 ──────────────────────────────────────
          -mb-px 로 이 줄의 border-b 와 탭 버튼의 border-b 를 겹쳐,
          활성 탭 밑줄이 구분선 위에 정확히 얹히게 한다. */}
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
              <path d="M3 5h14M6 10h8M9 15h2" strokeLinecap="round" />
            </svg>
            {activeFilterCount(tab, assigneeFilter, statusFilter) > 0 && (
              <span className="ml-1 text-[10px] tabular-nums">
                {activeFilterCount(tab, assigneeFilter, statusFilter)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── 필터 서랍 (기본 접힘) ─────────────────────────────────────── */}
      {filterOpen && (
        <div className="border border-line p-5 space-y-4">
          {tab === "all" && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-foreground-muted w-12 shrink-0">담당자</span>
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

      {/* ── 리스트 ───────────────────────────────────────────────────── */}
      <section className="space-y-5">
        {/* 추가는 인라인 폼. 모달이 아니다. */}
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

// ═══════════════════════════════════════════════════════════════════════════
// 리스트 행  (원본: src/features/tasks/task-row.tsx)
// ═══════════════════════════════════════════════════════════════════════════

function TaskRow({
  task,
  members,
  onToggle,
  noteLink,
}: {
  task: Task;
  members: MemberWithProfile[];
  onToggle?: (next: TaskStatus) => Promise<void> | void;
  noteLink?: string | null;
}) {
  const done = task.status === "done";
  const assignee = members.find((m) => m.user_id === task.assignee_id);
  const assigneeName = assignee?.profile.name ?? assignee?.profile.email ?? null;
  const overdue =
    !done && task.due_date && new Date(task.due_date).getTime() < Date.now();

  return (
    <li>
      {/* 행 전체가 링크 → 상세 페이지로 (팝업 아님) */}
      <Link
        to={`/tasks/${task.id}`}
        className={`block py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors ${
          done ? "bg-surface-muted" : ""
        }`}
      >
        <div className="flex items-start gap-3 sm:items-center">
          {/* ★ 체크박스만 링크 이동을 막는다. 이걸 안 하면 체크하려다 페이지가 넘어간다. */}
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
                  done ? "line-through text-foreground-faint" : "text-foreground"
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

            {/* 모바일 — 담당/기한을 제목 아래 둘째 줄로 */}
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

          {/* 데스크탑 — 오른쪽 고정폭 열 */}
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

// ═══════════════════════════════════════════════════════════════════════════
// 인라인 빠른 추가 폼  (원본: src/features/tasks/task-quick-add.tsx)
// ═══════════════════════════════════════════════════════════════════════════

function TaskQuickAddForm({
  members,
  defaultAssigneeId,
  onCreate,
  onClose,
}: {
  members: MemberWithProfile[];
  defaultAssigneeId?: string | null;
  onCreate: (input: {
    title: string;
    assignee_id: string | null;
    due_date: string | null;
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string | null>(
    defaultAssigneeId ?? null,
  );
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await onCreate({
      title: title.trim(),
      assignee_id: assigneeId,
      // 날짜만 있는 필드 → 자정 기준 ISO
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
    });
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="border border-line p-4 space-y-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="할 일 내용을 입력하세요."
        className={inputClass}
        autoFocus
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>담당자</label>
          <select
            value={assigneeId ?? ""}
            onChange={(e) => setAssigneeId(e.target.value || null)}
            className={`${inputClass} mt-1`}
          >
            <option value="">미지정</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.profile.name ?? m.profile.email}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>기한</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="border border-line-strong px-4 py-2 text-xs text-foreground hover:border-foreground"
        >
          닫기
        </button>
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="bg-accent-teal text-accent-foreground px-4 py-2 text-xs hover:bg-accent-teal/85 transition-colors disabled:opacity-60"
        >
          {busy ? "저장 중..." : "할일 추가"}
        </button>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 작은 조각들
// ═══════════════════════════════════════════════════════════════════════════

/** 탭 — 활성 탭만 밑줄 + 진한 글자. 옆에 카운트. */
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

/** 3분할 pill — 선택된 것만 반전(검정 배경). 액센트 색을 쓰지 않는다. */
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

/** 페이저 — "‹ 1 / 3 ›". 원본: src/components/pager.tsx */
function Pager({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (next: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const prev = Math.max(1, page - 1);
  const next = Math.min(pageCount, page + 1);
  return (
    <nav
      aria-label="페이지"
      className="flex items-center justify-center gap-4 pt-8"
    >
      <button
        type="button"
        onClick={() => onChange(prev)}
        disabled={page <= 1}
        aria-label="이전 페이지"
        className="text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:hover:text-foreground-muted text-sm w-7 h-7 flex items-center justify-center"
      >
        ‹
      </button>
      <span className="text-xs text-foreground-muted tabular-nums">
        {page} / {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onChange(next)}
        disabled={page >= pageCount}
        aria-label="다음 페이지"
        className="text-foreground-muted hover:text-foreground disabled:opacity-30 disabled:hover:text-foreground-muted text-sm w-7 h-7 flex items-center justify-center"
      >
        ›
      </button>
    </nav>
  );
}

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/**
 * 아바타 — 원형이 자연스러운 유일한 예외 (그 외 모든 요소는 직사각형).
 * 이미지가 없으면 이름 첫 글자를 muted 배경 위에.
 * 원본: src/components/avatar.tsx
 */
type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const AVATAR_DIMS: Record<AvatarSize, string> = {
  xs: "size-5",
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
  xl: "size-20",
};

function Avatar({
  url,
  name,
  size = "md",
}: {
  url: string | null;
  name: string;
  size?: AvatarSize;
}) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  const cls = `${AVATAR_DIMS[size]} shrink-0 rounded-full overflow-hidden border border-line bg-surface-muted`;
  if (url) {
    return (
      <div className={cls}>
        <img src={url} alt="" className="size-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`${cls} flex items-center justify-center`}>
      <span
        className={
          size === "xl"
            ? "text-2xl text-foreground-muted font-light"
            : size === "xs"
              ? "text-[10px] text-foreground-muted"
              : "text-sm text-foreground-muted"
        }
      >
        {initial}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 정렬 · 필터 헬퍼
// ═══════════════════════════════════════════════════════════════════════════

function activeFilterCount(
  tab: Tab,
  assigneeFilter: string,
  statusFilter: StatusFilter,
): number {
  let n = 0;
  if (tab === "all" && assigneeFilter) n += 1;
  if (statusFilter !== "all") n += 1; // 'all' 이 기본값
  return n;
}

function compareForList(a: Task, b: Task): number {
  // 완료는 아래로, 그 외엔 최신 생성순(내림차순 — 최신이 위로)
  if (a.status === "done" && b.status !== "done") return 1;
  if (b.status === "done" && a.status !== "done") return -1;
  return b.created_at.localeCompare(a.created_at);
}
