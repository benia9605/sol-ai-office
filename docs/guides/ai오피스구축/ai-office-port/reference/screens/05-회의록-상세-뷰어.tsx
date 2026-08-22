/* ============================================================================
 * 화면 ⑤ — 회의록 상세 (뷰어)   (라우트: /notes/:id)
 * ============================================================================
 *
 * 목록에서 행을 누르면 열리는 새 페이지. 알림 `url: '/notes/abc'` 의 착지점.
 *
 * 밋업 원본을 한 파일로 합친 디자인 참고본.
 *   src/pages/note-detail.tsx                       ← 페이지 본체
 *   src/components/avatar.tsx                       ← 아바타   (아래 Avatar)
 *   src/components/task-progress.tsx                ← 진행률   (아래 TaskProgress)
 *   src/features/editor/rich-editor.tsx             ← RichRender (import 유지)
 *   src/features/attachments/attachments-section.tsx ← 첨부 (import 유지)
 *
 * 편집 버튼 → /notes/:id/edit (별도 페이지. 06 파일)
 *
 * ─── 화면 스케치 ────────────────────────────────────────────────────────────
 *
 *   ← 회의록                                          편집 · 삭제
 *
 *   MEETING NOTE
 *   3분기 전략 회의                            ← h1 text-3xl font-light
 *   (summary 가 있으면 그 아래 큰 회색 문단)
 *
 *   ┌─────────────────────────┬─────────────────────────┐
 *   │ 연결된 일정              │ 작성일                   │
 *   │ 3분기 전략 회의 ·        │ 2026년 8월 20일 21:00    │
 *   │ 2026년 8월 20일 20:00   │                          │
 *   └─────────────────────────┴─────────────────────────┘
 *      ↑ 클릭하면 /meetings/:id 로 (링크가 있는 칸만 hover 반응)
 *
 *   참석자 · 4명
 *   [(av) 김대표] [(av) 박이사] [(av) 이대표] [(av) 최이사]   ← 각각 멤버 링크
 *
 *   아젠다
 *    1.  예산 재배분
 *    2.  채용 계획
 *    3.  콘텐츠 방향
 *
 *   본문
 *   (RichRender — 서식·이미지·체크리스트가 살아있는 회의 내용)
 *
 *   첨부 · 2
 *   기획안_v3.pdf                        1.2 MB · application/pdf
 *
 *   할일 · 5
 *   ┌──────────────────────────────────┐
 *   │ 2/5                          40% │              ← 박스형 진행률
 *   │ ████████░░░░░░░░░░░░░░░░░░░░░░░░ │
 *   └──────────────────────────────────┘
 *   ☑ 예산안 초안 작성          완료    담당 · 김대표   기한 · 8/24
 *   ☐ 경쟁사 리서치            미완료   담당 · 박이사   기한 · 8/20 ← danger
 *   행을 클릭하면 상세에서 상태 변경 · 본문 / 첨부 편집이 가능합니다.
 *
 *   작성자
 *   ┌──────────────────────────────────────────┐
 *   │ (av) 김대표                               │  ← 클릭 시 멤버 상세로
 *   │      주식회사 밋업 · 대표                  │
 *   └──────────────────────────────────────────┘
 *
 * ─── 할일 상세(02)와 다른 점 ────────────────────────────────────────────────
 *  · 좋아요·댓글 블록이 없다. 회의록은 "기록"이라 반응을 붙이지 않았다.
 *    (붙이고 싶으면 01 문서대로 note_likes / note_comments 를 만들면 된다)
 *  · 편집이 모드 토글이 아니라 **별도 페이지**(/notes/:id/edit).
 *    폼이 크고(아젠다 + 에디터 + 할일 3방식) 임시저장까지 붙어서, 같은 화면에서
 *    갈아끼우면 스크롤 위치가 튄다. 할일은 폼이 작아서 모드 토글로 충분했다.
 *  · 섹션 간격이 space-y-14 (할일은 10). 읽는 문서라 더 여유를 준다.
 *
 * ─── 디자인 규칙 ────────────────────────────────────────────────────────────
 *  · 액션은 텍스트 링크 "편집 · 삭제" 뿐. 회의록은 상태 전환이 없어서
 *    할일처럼 액센트 버튼([작업 완료])을 둘 이유가 없다.
 *  · 메타 2칸도 gap-px 기법 (셀마다 border 를 그리지 않는다).
 *  · 아젠다는 grid-cols-[28px_1fr] — 번호 열을 고정폭 우측정렬해서
 *    두 자리 수(10.)가 되어도 본문 왼쪽 라인이 흔들리지 않는다.
 *  · 각 섹션 제목은 .label (영문 대문자 트래킹이 아니라 한글이어도 같은 유틸).
 * ========================================================================== */

import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useAsync } from "@/lib/use-async";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { getNote, deleteNote } from "@/lib/data/meeting-notes";
import { getMeeting, getMeetingAttendees } from "@/lib/data/meetings";
import { getProfile, getProfiles } from "@/lib/data/profile";
import { getMyRole } from "@/lib/data/workspaces";
import { getTasksForNote } from "@/lib/data/tasks";
import { AttachmentsSection } from "@/features/attachments/attachments-section";
import { RichRender } from "@/features/editor/rich-editor";
import {
  formatDateTime,
  formatFullDate,
  formatShortDate,
  formatTime,
} from "@/lib/format";

// ═══════════════════════════════════════════════════════════════════════════
// 페이지
// ═══════════════════════════════════════════════════════════════════════════

export function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();

  const { data: note, loading } = useAsync(
    () => (id ? getNote(id) : Promise.resolve(null)),
    [id],
  );
  const { data: meeting } = useAsync(
    () =>
      note?.meeting_id ? getMeeting(note.meeting_id) : Promise.resolve(null),
    [note?.meeting_id],
  );
  const { data: attendees } = useAsync(
    () =>
      note?.meeting_id
        ? getMeetingAttendees(note.meeting_id)
        : Promise.resolve([]),
    [note?.meeting_id],
  );
  const { data: author } = useAsync(
    () =>
      note?.created_by ? getProfile(note.created_by) : Promise.resolve(null),
    [note?.created_by],
  );
  const { data: tasks } = useAsync(
    () => (id ? getTasksForNote(id) : Promise.resolve([])),
    [id],
  );
  // 담당자 프로필을 한 번에 — 행마다 getProfile 을 부르면 N+1 이 된다.
  const assigneeIds = (tasks ?? [])
    .map((t) => t.assignee_id)
    .filter((x): x is string => !!x);
  const { data: assigneeProfiles } = useAsync(
    () => getProfiles(assigneeIds),
    [assigneeIds.join(",")],
  );
  const { data: myRole } = useAsync(
    () =>
      workspace && user
        ? getMyRole(workspace.id, user.id)
        : Promise.resolve(null),
    [workspace?.id, user?.id],
  );

  if (loading) return null;
  if (!note) return <Navigate to="/notes" replace />;

  const canManage =
    !!user &&
    (note.created_by === user.id || myRole === "owner" || myRole === "admin");

  async function handleDelete() {
    if (!note) return;
    if (!confirm("이 회의록을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    const ok = await deleteNote(note.id);
    if (ok) navigate("/notes");
  }

  return (
    // 읽는 문서라 섹션 간격을 넉넉히 (할일 상세는 space-y-10)
    <article className="space-y-14 max-w-3xl">
      {/* ── 상단 바 ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <Link
          to="/notes"
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          ← 회의록
        </Link>
        {canManage && (
          <div className="flex items-center gap-3 text-xs">
            {/* ★ 편집은 별도 페이지 (06 파일). 모드 토글도 모달도 아니다. */}
            <Link
              to={`/notes/${note.id}/edit`}
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

      {/* ── 제목 ─────────────────────────────────────────────────────── */}
      <header>
        <p className="label">Meeting Note</p>
        <h1 className="mt-3 text-3xl font-light leading-tight sm:text-4xl">
          {note.title}
        </h1>
        {note.summary && (
          <p className="mt-6 text-base leading-[1.85] text-foreground-muted">
            {note.summary}
          </p>
        )}
      </header>

      {/* ── 메타 2칸 — gap-px 틈이 구분선이 된다 ──────────────────────── */}
      <section className="grid gap-px bg-surface-muted border border-line sm:grid-cols-2">
        <Stat
          label="연결된 일정"
          value={
            meeting
              ? `${meeting.title} · ${formatFullDate(meeting.starts_at)} ${formatTime(meeting.starts_at)}`
              : "일정 미연결 (카톡 등)"
          }
          link={meeting ? `/meetings/${meeting.id}` : null}
        />
        <Stat label="작성일" value={formatDateTime(note.created_at)} />
      </section>

      {/* ── 참석자 — 일정에 연결됐고 응답이 있을 때만 ────────────────── */}
      {meeting && (attendees ?? []).length > 0 && (
        <section>
          <h2 className="label mb-4">
            참석자 ·{" "}
            {(attendees ?? []).filter((a) => a.status === "attending").length}명
          </h2>
          <ul className="flex flex-wrap gap-2">
            {(attendees ?? [])
              .filter((a) => a.status === "attending")
              .map((a) => {
                const display = a.profile.name ?? a.profile.email;
                return (
                  <li key={a.profile.user_id}>
                    {/* 칩 = 멤버 상세 링크. 직사각형 + hairline */}
                    <Link
                      to={`/members/${a.profile.user_id}`}
                      className="flex items-center gap-2 border border-line px-3 py-1.5 text-xs hover:border-foreground"
                    >
                      <Avatar
                        url={a.profile.avatar_url}
                        name={display}
                        size="sm"
                      />
                      <span>{display}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {/* ── 아젠다 — '\n' 으로 저장된 문자열을 번호 목록으로 ──────────── */}
      {note.agenda && (
        <section>
          <h2 className="label mb-3">아젠다</h2>
          <ol className="space-y-2 text-sm leading-[1.85] text-foreground-muted">
            {note.agenda
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
              .map((item, i) => (
                // 번호 열 28px 고정 + 우측정렬 → 10. 이 되어도 본문 라인이 안 흔들림
                <li
                  key={i}
                  className="grid grid-cols-[28px_1fr] gap-2 items-baseline"
                >
                  <span className="text-foreground-faint tabular-nums text-right">
                    {i + 1}.
                  </span>
                  <span className="text-foreground">{item}</span>
                </li>
              ))}
          </ol>
        </section>
      )}

      {/* ── 본문 — 반드시 RichRender (평문 <p> 로 찍으면 서식이 다 깨진다) ── */}
      {note.content && (
        <section>
          <h2 className="label mb-3">본문</h2>
          <RichRender html={note.content} />
        </section>
      )}

      {/* ── 첨부 — 회의록은 작성자/운영자면 뷰에서도 관리 가능 ────────── */}
      {workspace && (
        <AttachmentsSection
          workspaceId={workspace.id}
          refType="meeting_note"
          refId={note.id}
          canManage={canManage}
        />
      )}

      {/* ── 할일 (액션 아이템) ────────────────────────────────────────
          회의록의 자식이 아니라 별도 자원이다. 여기선 역참조로 보여줄 뿐. */}
      {(tasks ?? []).length > 0 && (
        <section>
          <div className="mb-4 space-y-3">
            <h2 className="label">할일 · {(tasks ?? []).length}</h2>
            <TaskProgress
              done={(tasks ?? []).filter((t) => t.status === "done").length}
              total={(tasks ?? []).length}
            />
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {(tasks ?? []).map((t) => {
              const assignee =
                assigneeProfiles?.find((p) => p.user_id === t.assignee_id) ??
                null;
              const overdue =
                t.due_date &&
                t.status !== "done" &&
                new Date(t.due_date).getTime() < Date.now();
              const done = t.status === "done";
              const assigneeName = assignee
                ? assignee.name ?? assignee.email
                : "미지정";
              const dueText = t.due_date
                ? formatShortDate(t.due_date)
                : "기한 없음";
              return (
                <li key={t.id}>
                  {/* 여기선 체크박스가 버튼이 아니라 **표시용 아이콘**이다.
                      상태 변경은 할일 상세에서 — 그래서 행 전체가 링크. */}
                  <Link
                    to={`/tasks/${t.id}`}
                    className={`block py-4 -mx-2 px-2 hover:bg-surface-muted transition-colors ${
                      done ? "bg-surface-muted" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3 sm:items-center">
                      <span
                        aria-hidden
                        className={`size-5 mt-0.5 sm:mt-0 shrink-0 border flex items-center justify-center ${
                          done
                            ? "border-accent-teal bg-accent-teal text-accent-foreground"
                            : "border-line-strong"
                        }`}
                        title={done ? "완료" : "미완료"}
                      >
                        {done && <span className="text-xs leading-none">✓</span>}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p
                            className={`text-sm min-w-0 truncate max-w-full ${
                              done
                                ? "line-through text-foreground-faint"
                                : "text-foreground"
                            }`}
                          >
                            {t.title}
                          </p>
                          <span
                            className={`shrink-0 text-[10px] uppercase tracking-wider ${
                              done ? "text-accent-teal" : "text-foreground-faint"
                            }`}
                          >
                            {done ? "완료" : "미완료"}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-foreground-muted">
                          <span>담당 · {assigneeName}</span>
                          <span className={overdue ? "text-danger" : ""}>
                            기한 · {dueText}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {/* 클릭하면 뭐가 되는지 한 줄로 알려준다 — 헤매지 않게 */}
          <p className="mt-3 text-xs text-foreground-faint">
            행을 클릭하면 상세에서 상태 변경 · 본문 / 첨부 편집이 가능합니다.
          </p>
        </section>
      )}

      {/* ── 작성자 카드 ──────────────────────────────────────────────── */}
      {author && (
        <section>
          <h2 className="label mb-4">작성자</h2>
          <Link
            to={`/members/${author.user_id}`}
            className="flex items-center gap-4 border border-line p-5 hover:border-foreground transition-colors"
          >
            <Avatar
              url={author.avatar_url}
              name={author.name ?? author.email}
              size="lg"
            />
            <div>
              <p className="text-sm">{author.name ?? author.email}</p>
              <p className="mt-0.5 text-xs text-foreground-muted">
                {[author.company, author.position].filter(Boolean).join(" · ") ||
                  author.industry ||
                  "—"}
              </p>
            </div>
          </Link>
        </section>
      )}
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 조각들
// ═══════════════════════════════════════════════════════════════════════════

/** 메타 한 칸. link 가 있으면 hover 반응 + 클릭 이동. */
function Stat({
  label,
  value,
  link,
}: {
  label: string;
  value: string;
  link?: string | null;
}) {
  const body = (
    <div className="bg-surface p-5">
      <p className="text-xs text-foreground-faint">{label}</p>
      <p className="mt-1.5 text-sm">{value}</p>
    </div>
  );
  if (link) {
    return (
      <Link to={link} className="hover:bg-surface-muted transition-colors">
        {body}
      </Link>
    );
  }
  return body;
}

/** 진행률 바 (박스형) — 원본: src/components/task-progress.tsx */
function TaskProgress({
  done,
  total,
  compact = false,
}: {
  done: number;
  total: number;
  compact?: boolean;
}) {
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  const bar = (
    <div className="h-1 bg-line">
      <div
        className="h-full bg-accent-teal transition-all"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
  if (compact) {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-2 text-[11px] text-foreground-muted mb-1 tabular-nums">
          <span>
            {done}/{total}
          </span>
          <span className="text-foreground">{pct}%</span>
        </div>
        {bar}
      </div>
    );
  }
  return (
    <div className="border border-accent-teal/40 bg-accent-teal/[0.03] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2 text-xs text-foreground-muted mb-1.5 tabular-nums">
        <span>
          {done}/{total}
        </span>
        <span className="text-foreground">{pct}%</span>
      </div>
      {bar}
    </div>
  );
}

/** 아바타 — 원본: src/components/avatar.tsx */
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
