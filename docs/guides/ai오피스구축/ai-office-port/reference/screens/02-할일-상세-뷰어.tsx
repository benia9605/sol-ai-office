/* ============================================================================
 * 화면 ② — 할일 상세 (뷰 모드)   (라우트: /tasks/:id)
 * ============================================================================
 *
 * 리스트에서 행을 누르면 열리는 화면. **팝업이 아니라 새 페이지**다.
 * 알림(`url: '/tasks/abc'`)을 눌렀을 때 착지하는 곳도 여기다.
 *
 * 밋업 원본을 한 파일로 합친 디자인 참고본.
 *   src/pages/task-detail.tsx                       ← 페이지 셸 + ViewMode
 *   src/components/avatar.tsx                       ← 아바타 (아래 Avatar)
 *   src/features/attachments/attachments-section.tsx ← 첨부 (import 유지)
 *   src/features/editor/rich-editor.tsx             ← RichRender (import 유지)
 *   src/features/social/like-comment-block.tsx      ← 좋아요·댓글·답글 (import 유지)
 *
 * 편집 버튼을 누르면 → 03-할일-상세-편집.tsx (같은 URL, mode state 만 전환)
 *
 * ─── 화면 스케치 ────────────────────────────────────────────────────────────
 *
 *   ← 할일                              [편집] [작업 완료]  삭제
 *
 *   예산안 초안 작성                              ← h1 text-3xl font-light
 *   (완료 상태면 line-through + "완료된 할일")
 *
 *   ┌───────────┬───────────┬───────────┐   ← gap-px + bg-surface-muted 로
 *   │ 담당자     │ 기한       │ 작성자     │      구분선을 만든다 (이중선 방지)
 *   │ (av)김대표 │ 2026년 8월 │ (av)박이사 │
 *   │           │ 24일       │           │
 *   └───────────┴───────────┴───────────┘
 *
 *   ┌────────────────────────────────────────────┐
 *   │ 회의록   3분기 전략 회의                  › │  ← 연결된 회의록 (있을 때만)
 *   └────────────────────────────────────────────┘
 *
 *   내용
 *   (RichRender — 서식/이미지/체크리스트가 살아있는 본문)
 *
 *   첨부 · 2
 *   기획안_v3.pdf                    1.2 MB · application/pdf
 *   레퍼런스.png                     340 KB · image/png
 *   ─────────────────────────────────────────────  ← border-t
 *   [♥ 3]                                  댓글 5
 *   (av) 김대표  8월 21일 14:20
 *        수치 다시 확인 부탁드려요           [삭제] [답글]
 *   ─────────────────────────────────────
 *       ↳ (av) 박이사  네 반영했습니다            [삭제]
 *
 *   [ 댓글을 남겨주세요.                    ]  [등록]
 *
 * ─── 디자인 규칙 ────────────────────────────────────────────────────────────
 *  · 최상단은 항상 「← 상위목록」 링크. 뒤로가기와 같은 목적지.
 *  · 우측 액션은 [편집](테두리) · [작업 완료](액센트 채움) · 삭제(텍스트 링크).
 *    파괴적 동작만 텍스트 링크로 약하게 — 시각적 무게 = 위험도의 역순.
 *  · 섹션 간격은 space-y-10. 여백이 곧 디자인.
 *  · 메타 3칸은 border 를 셀마다 그리지 않는다. gap-px 틈으로 선을 만든다.
 *  · 뷰 모드의 첨부는 canManage={false} — 목록만 보이고 추가/삭제 버튼은 숨김.
 *  · 좋아요·댓글 블록은 뷰 모드에서만 렌더한다 (편집 중엔 감춤).
 * ========================================================================== */

import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import { getMyRole } from "@/lib/data/workspaces";
import { getProfile } from "@/lib/data/profile";
import { getNote } from "@/lib/data/meeting-notes";
import {
  addTaskComment,
  deleteTask,
  deleteTaskComment,
  getTaskById,
  getTaskComments,
  getTaskLikeState,
  toggleTaskLike,
  updateTask,
} from "@/lib/data/tasks";
import { LikeCommentBlock } from "@/features/social/like-comment-block";
import { AttachmentsSection } from "@/features/attachments/attachments-section";
import { RichRender } from "@/features/editor/rich-editor";
import { formatFullDate } from "@/lib/format";
import type { Task } from "@/lib/types/database";

// ═══════════════════════════════════════════════════════════════════════════
// 페이지 셸 — 데이터 로딩 + 상단 액션 바
// ═══════════════════════════════════════════════════════════════════════════

export function TaskDetailViewPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();

  // 변경 후 리페치 트리거. useAsync 는 재조회 중에도 이전 데이터를 유지해서
  // 좋아요를 눌러도 화면이 깜빡이거나 스크롤이 위로 튀지 않는다.
  const [refreshKey, setRefreshKey] = useState(0);

  // ★ 원본(src/pages/task-detail.tsx)은 뷰/편집을 **한 파일에서 mode state 로**
  //   전환한다. URL 은 /tasks/:id 그대로다 (새 라우트도, 팝업도 아니다).
  //     const [mode, setMode] = useState<"view" | "edit">("view");
  //     {mode === "view" ? <ViewMode … /> : <EditMode … />}
  //   이 참고본은 화면을 보기 쉽게 파일만 둘로 나눴다 —
  //   편집 모드 본문은 03-할일-상세-편집.tsx 의 <EditMode> 다.
  const [mode, setMode] = useState<"view" | "edit">("view");

  const { data: task, loading } = useAsync(
    () => (id ? getTaskById(id) : Promise.resolve(null)),
    [id, refreshKey],
  );
  const { data: myRole } = useAsync(
    () =>
      workspace && user
        ? getMyRole(workspace.id, user.id)
        : Promise.resolve(null),
    [workspace?.id, user?.id],
  );
  const { data: assignee } = useAsync(
    () =>
      task?.assignee_id ? getProfile(task.assignee_id) : Promise.resolve(null),
    [task?.assignee_id],
  );
  const { data: creator } = useAsync(
    () =>
      task?.created_by ? getProfile(task.created_by) : Promise.resolve(null),
    [task?.created_by],
  );
  const { data: likeState } = useAsync(
    () =>
      id && user
        ? getTaskLikeState(id, user.id)
        : Promise.resolve({ count: 0, liked: false }),
    [id, user?.id, refreshKey],
  );
  const { data: comments } = useAsync(
    () => (id ? getTaskComments(id) : Promise.resolve([])),
    [id, refreshKey],
  );
  const { data: linkedNote } = useAsync(
    () => (task?.note_id ? getNote(task.note_id) : Promise.resolve(null)),
    [task?.note_id, refreshKey],
  );

  if (loading) return null;
  if (!task) return <Navigate to="/tasks" replace />;
  if (!user || !workspace) return null;

  // 편집·완료·삭제 권한: 작성자 / 담당자 / 운영자
  const canManage =
    task.created_by === user.id ||
    task.assignee_id === user.id ||
    myRole === "owner" ||
    myRole === "admin";
  // 남의 댓글까지 지울 수 있는 권한
  const canModerate = myRole === "owner" || myRole === "admin";
  const done = task.status === "done";

  async function handleDelete() {
    if (!task) return;
    if (!confirm("이 할일을 삭제하시겠습니까?")) return;
    const ok = await deleteTask(task.id);
    if (ok) navigate("/tasks");
  }

  async function handleToggleDone() {
    if (!task) return;
    // ★ 완료로 전환되면 updateTask 안에서 활동 피드 + 전체 알림이 자동 발송된다.
    await updateTask(task.id, {
      status: task.status === "done" ? "todo" : "done",
    });
    setRefreshKey((v) => v + 1);
  }

  return (
    <article className="space-y-10 max-w-3xl">
      {/* ── 상단 바 — 돌아가기 + 액션 ─────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/tasks"
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          ← 할일
        </Link>

        {/* 원본: {mode === "view" && canManage && ( … )} — 편집 중엔 액션 바를 감춘다 */}
        {mode === "view" && canManage && (
          <div className="flex items-center gap-2">
            {/* 편집 → 같은 URL 에서 편집 모드로 전환. 본문은 03 파일 참고. */}
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="border border-line-strong px-3 py-1.5 text-xs hover:border-foreground"
            >
              편집
            </button>
            <button
              type="button"
              onClick={handleToggleDone}
              className={`px-3 py-1.5 text-xs transition-colors ${
                done
                  ? "border border-line-strong text-foreground-muted hover:border-foreground hover:text-foreground"
                  : "bg-accent-teal text-accent-foreground hover:bg-accent-teal/85"
              }`}
            >
              {done ? "완료 취소" : "작업 완료"}
            </button>
            {/* 파괴적 동작은 가장 약한 시각 무게로 */}
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs text-danger hover:underline underline-offset-4 px-2"
            >
              삭제
            </button>
          </div>
        )}
      </div>

      {/* ── 본문 ─────────────────────────────────────────────────────── */}
      {/* mode === "edit" 이면 여기가 03 파일의 <EditMode> 로 바뀐다. */}
      <ViewMode
        task={task}
        workspaceId={workspace.id}
        assignee={
          assignee
            ? {
                name: assignee.name ?? assignee.email ?? "미지정",
                avatar_url: assignee.avatar_url ?? null,
              }
            : null
        }
        creator={
          creator
            ? {
                name: creator.name ?? creator.email ?? "—",
                avatar_url: creator.avatar_url ?? null,
              }
            : null
        }
        linkedNote={
          linkedNote ? { id: linkedNote.id, title: linkedNote.title } : null
        }
        done={done}
      />

      {/* ── 좋아요 · 댓글 · 답글 ────────────────────────────────────────
          전 자원 공용 컴포넌트. 페이지는 콜백 4개만 넘긴다.
          ★ 뷰 모드에서만 렌더한다 — 원본은 {mode === "view" && <LikeCommentBlock … />}.
          전체 구현: reference/src/features/social/like-comment-block.tsx */}
      <LikeCommentBlock
        liked={likeState?.liked ?? false}
        likeCount={likeState?.count ?? 0}
        onToggleLike={async () => {
          await toggleTaskLike(task.id, user.id);
          setRefreshKey((v) => v + 1);
        }}
        comments={comments ?? []}
        currentUserId={user.id}
        canModerate={canModerate}
        onAddComment={async (content, parentId) => {
          // parentId 가 있으면 답글 → 부모 댓글 작성자에게 알림
          await addTaskComment(task.id, user.id, content, parentId);
          setRefreshKey((v) => v + 1);
        }}
        onDeleteComment={async (cid) => {
          await deleteTaskComment(cid);
          setRefreshKey((v) => v + 1);
        }}
      />
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 뷰 모드 본문 — 읽기 전용
// ═══════════════════════════════════════════════════════════════════════════

function ViewMode({
  task,
  workspaceId,
  assignee,
  creator,
  linkedNote,
  done,
}: {
  task: Task;
  workspaceId: string;
  assignee: { name: string; avatar_url: string | null } | null;
  creator: { name: string; avatar_url: string | null } | null;
  linkedNote: { id: string; title: string } | null;
  done: boolean;
}) {
  return (
    <>
      {/* 제목 — 완료면 취소선 + 흐린 글자 */}
      <header>
        <h1
          className={`text-3xl font-light leading-tight sm:text-4xl ${
            done ? "line-through text-foreground-faint" : ""
          }`}
        >
          {task.title}
        </h1>
        {done && (
          <p className="mt-3 text-xs text-foreground-faint">완료된 할일</p>
        )}
      </header>

      {/* 메타 3칸 —
          바깥에 border 하나 + gap-px 틈에 bg-surface-muted 가 비쳐 구분선이 된다.
          셀마다 border 를 그리면 이중선이 생긴다. 다른 자원 상세에서도 같은 기법. */}
      <section className="grid gap-px bg-surface-muted border border-line sm:grid-cols-3">
        <MetaCell
          label="담당자"
          person={assignee ?? { name: "미지정", avatar_url: null }}
        />
        <MetaCell
          label="기한"
          value={task.due_date ? formatFullDate(task.due_date) : "기한 없음"}
        />
        <MetaCell
          label="작성자"
          person={creator ?? { name: "—", avatar_url: null }}
        />
      </section>

      {/* 연결된 회의록 — 있을 때만. 행 전체가 링크 */}
      {linkedNote && (
        <section className="border border-line">
          <Link
            to={`/notes/${linkedNote.id}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-surface-muted transition-colors"
          >
            <span className="label shrink-0">회의록</span>
            <span className="text-sm truncate flex-1">{linkedNote.title}</span>
            <span aria-hidden className="text-foreground-faint">
              ›
            </span>
          </Link>
        </section>
      )}

      {/* 본문 — 에디터 HTML 을 그대로 렌더.
          평문 <p>{content}</p> 로 찍으면 서식이 다 깨진다. 반드시 RichRender. */}
      <section>
        <p className="label mb-3">내용</p>
        {task.description ? (
          <RichRender html={task.description} />
        ) : (
          <p className="py-6 text-center text-sm text-foreground-faint">
            아직 작성된 내용이 없습니다.
          </p>
        )}
      </section>

      {/* 첨부 — 뷰 모드에선 read-only (canManage=false 로 추가/삭제 숨김).
          클릭하면 뷰어 모달이 열린다. PDF/이미지/오피스 미리보기 지원.
          전체 구현: reference/src/features/attachments/attachments-section.tsx */}
      <AttachmentsSection
        workspaceId={workspaceId}
        refType="task"
        refId={task.id}
        canManage={false}
      />
    </>
  );
}

/** 메타 한 칸 — 라벨(작게, 흐리게) + 값 또는 사람(아바타 + 이름). */
function MetaCell({
  label,
  value,
  person,
}: {
  label: string;
  value?: string;
  person?: { name: string; avatar_url: string | null };
}) {
  return (
    <div className="bg-surface p-5">
      <p className="text-xs text-foreground-faint">{label}</p>
      {person ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-sm">
          <Avatar url={person.avatar_url} name={person.name} size="xs" />
          <span className="truncate">{person.name}</span>
        </div>
      ) : (
        <p className="mt-1.5 text-sm">{value}</p>
      )}
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
