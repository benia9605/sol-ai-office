/* ============================================================================
 * 화면 ④ — 회의록 목록 페이지   (라우트: /notes)
 * ============================================================================
 *
 * 밋업 원본을 한 파일로 합친 디자인 참고본.
 *   src/pages/notes.tsx              ← 페이지 본체
 *   src/lib/note-preview.ts          ← 미리보기 추출 (아래 notePreview)
 *   src/components/task-progress.tsx ← 진행률 바   (아래 TaskProgress)
 *   src/components/pager.tsx         ← 페이저      (아래 Pager)
 *
 * ─── 화면 스케치 ────────────────────────────────────────────────────────────
 *
 *   All Notes                                  12건   [+ 회의록 작성]
 *   회의록
 *   함께 나눈 대화, 다시 꺼내 볼 수 있도록.
 *   ─────────────────────────────────────────────────────────────  border-b
 *   3분기 전략 회의                                    8월 20일 21:00
 *   예산 재배분 · 채용 계획 · 콘텐츠 방향            ← 아젠다 앞 3개
 *   ┌────────────────────────────┐
 *   │ 2/5                    40% │                  ← compact 진행률
 *   │ ████████░░░░░░░░░░░░░░░░░░ │
 *   └────────────────────────────┘
 *   ─────────────────────────────────────────────────────────────
 *   2026-08-14 회의록                                 8월 14일 22:10
 *   카톡으로 나눈 채용 논의 정리                      ← 본문 첫 줄 (아젠다 없을 때)
 *   ─────────────────────────────────────────────────────────────
 *                            ‹   1 / 2   ›
 *
 * ─── 할일 목록(01)과 다른 점 ────────────────────────────────────────────────
 *  · 탭 / 필터가 없다. 회의록은 시간순 하나면 충분해서 컨트롤을 안 만들었다.
 *    "필요해 보이니까 넣는" 게 아니라 실제로 쓸 때만 넣는다.
 *  · 행이 2~3줄짜리다 (제목 / 미리보기 / 진행률). 할일은 1줄.
 *    → 행 높이가 다르니 `py-5` + `-mx-4 px-4` 로 hover 영역을 넓게 잡는다.
 *  · 인라인 추가 폼이 없다. 회의록 작성은 폼이 커서 **별도 페이지**(/notes/new).
 *
 * ─── 디자인 규칙 ────────────────────────────────────────────────────────────
 *  · 헤더의 border-b 와 첫 행이 곧장 맞닿는다. 사이에 여백을 두지 않는다.
 *    (바깥 div 에 space-y-10 같은 큰 갭을 주지 않는 이유)
 *  · 미리보기는 2줄에서 자른다 (`line-clamp-2`). 절대 늘어나지 않게.
 *  · 진행률 바는 회의록에 연결된 할일이 있을 때만 뜬다 (total===0 이면 렌더 안 함).
 *  · 진행률 바 폭은 `max-w-md` — 넓은 화면에서 끝까지 늘어나면 조잡해진다.
 * ========================================================================== */

import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import { getWorkspaceNotes } from "@/lib/data/meeting-notes";
import { getTasks } from "@/lib/data/tasks";
import { formatShortDateTime } from "@/lib/format";

export const PAGE_SIZE = 20;

// ═══════════════════════════════════════════════════════════════════════════
// 페이지
// ═══════════════════════════════════════════════════════════════════════════

export function NotesPage() {
  const { workspace, loading: wsLoading } = useActiveWorkspace();
  const [page, setPage] = useState(1);

  const { data: notes, loading } = useAsync(
    () => (workspace ? getWorkspaceNotes(workspace.id) : Promise.resolve([])),
    [workspace?.id],
  );
  // 진행률을 위해 워크스페이스 할일을 통째로 한 번만 가져온다.
  // 회의록마다 쿼리를 날리면 N+1 이 된다.
  const { data: tasks } = useAsync(
    () => (workspace ? getTasks({ workspaceId: workspace.id }) : Promise.resolve([])),
    [workspace?.id],
  );

  const list = notes ?? [];

  /** note_id 별 { done, total } 로 한 번 순회해서 Map 을 만든다. */
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
    // ★ 바깥에 space-y-* 를 주지 않는다 — 헤더 border-b 와 첫 행이 붙어야 한다.
    <div>
      {/* ── 페이지 헤더 ───────────────────────────────────────────────── */}
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
          {/* 작성은 별도 페이지로 이동 (폼이 커서 인라인/모달이 안 맞는다) */}
          <Link
            to="/notes/new"
            className="bg-accent-teal text-accent-foreground px-3 py-1.5 text-xs hover:bg-accent-teal/85 transition-colors"
          >
            + 회의록 작성
          </Link>
        </div>
      </header>

      {/* ── 리스트 ───────────────────────────────────────────────────── */}
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
                  {/* 행 전체가 링크. -mx-4 px-4 로 hover 배경을 여백까지 넓힌다. */}
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

                    {/* 미리보기 — 아젠다 앞 3개, 없으면 본문 첫 줄. 2줄에서 컷 */}
                    {preview && (
                      <p className="mt-2.5 text-xs text-foreground-muted line-clamp-2 leading-relaxed">
                        {preview}
                      </p>
                    )}

                    {/* 연결된 할일이 있을 때만 진행률 */}
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

// ═══════════════════════════════════════════════════════════════════════════
// 진행률 바  (원본: src/components/task-progress.tsx)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ★ 진행률은 **저장하지 않는다.** 매번 배열에서 센다.
 *   total === 0 이면 아무것도 렌더하지 않는다 (0/0 = NaN% 방지).
 */
function TaskProgress({
  done,
  total,
  compact = false,
}: {
  done: number;
  total: number;
  /** 리스트 행 안에서 쓰는 축소형 — 박스 없이 작게. */
  compact?: boolean;
}) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);

  if (compact) {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-2 text-[11px] text-foreground-muted mb-1 tabular-nums">
          <span>
            {done}/{total}
          </span>
          <span className="text-foreground">{pct}%</span>
        </div>
        <div className="h-1 bg-line">
          <div
            className="h-full bg-accent-teal transition-all"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
      </div>
    );
  }

  // 박스형 — 회의록 상세 / 일정 상세에서 사용
  return (
    <div className="border border-accent-teal/40 bg-accent-teal/[0.03] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2 text-xs text-foreground-muted mb-1.5 tabular-nums">
        <span>
          {done}/{total}
        </span>
        <span className="text-foreground">{pct}%</span>
      </div>
      <div className="h-1 bg-line">
        <div
          className="h-full bg-accent-teal transition-all"
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 미리보기 추출  (원본: src/lib/note-preview.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 회의록 한 줄 미리보기.
 * 우선순위: 아젠다 앞 3개 → 본문 첫 줄.
 *
 * 본문은 에디터 HTML 이라 그대로 찍으면 태그가 보인다 — 반드시 정제해서 쓴다.
 */
function notePreview(note: {
  agenda: string | null;
  content: string | null;
}): string | null {
  return agendaPreview(note.agenda) ?? bodyFirstLine(note.content);
}

/** 줄바꿈으로 나누고 머리표 제거 후 앞 3개를 ' · ' 로 묶기. */
function agendaPreview(agenda: string | null): string | null {
  if (!agenda) return null;
  const items = agenda
    .split("\n")
    .map((s) => stripMarkers(s).trim())
    .filter(Boolean);
  if (items.length === 0) return null;
  return items.slice(0, 3).join(" · ");
}

/** 본문의 첫 의미있는 줄을 md/html 마커 제거한 평문으로. */
function bodyFirstLine(content: string | null): string | null {
  if (!content) return null;
  const stripped = content.replace(/<[^>]+>/g, " "); // HTML 태그 제거
  const lines = stripped
    .split("\n")
    .map((s) => stripMarkers(stripInline(s)).trim())
    .filter(Boolean);
  return lines[0] ?? null;
}

/** 줄 앞쪽의 #, -, *, •, 1., > 같은 머리표 제거. */
function stripMarkers(s: string): string {
  return s.replace(/^\s*(?:#{1,6}\s+|[-*•+]\s+|\d+[.)]\s+|>\s+)/, "");
}

/** 인라인 마크다운 마커 제거 (bold/italic/code/link 등). */
function stripInline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/(?:^|\s)_([^_]+)_(?=\s|$)/g, " $1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// ═══════════════════════════════════════════════════════════════════════════
// 페이저  (원본: src/components/pager.tsx)
// ═══════════════════════════════════════════════════════════════════════════

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
