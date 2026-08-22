import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Avatar } from "@/components/avatar";
import { inputClass } from "@/features/auth/_shared";
import { formatDateTime } from "@/lib/format";

/**
 * 한 줄에서 시작해 내용 줄 수만큼만 늘어나는 댓글 입력칸.
 * rows={2} 처럼 빈 줄 여백이 생기지 않도록 scrollHeight 로 높이를 맞춘다.
 * 밑줄(border-b) 이 항상 마지막 글자 바로 아래에 오게 borders 보정 포함.
 */
function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const borders = el.offsetHeight - el.clientHeight; // border-box 보정
    el.style.height = `${el.scrollHeight + borders}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className={`${className ?? ""} resize-none overflow-hidden`}
    />
  );
}

type AuthorRef = {
  user_id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
};

export type CommentRow = {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  /** 048 — 값이 있으면 그 댓글에 대한 답글. */
  parent_id?: string | null;
  author: AuthorRef | null;
};

type Props = {
  liked: boolean;
  likeCount: number;
  onToggleLike: () => Promise<void> | void;

  comments: CommentRow[];
  currentUserId: string;
  /** Workspace admin/owner can delete others' comments. */
  canModerate: boolean;
  /** parentId 가 있으면 답글로 저장. */
  onAddComment: (content: string, parentId?: string | null) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
};

// 우하단 액션 버튼 — 연한 네모박스 톤
const ACTION_BTN =
  "border border-accent-teal/40 bg-accent-teal/10 px-2.5 py-1 text-[11px] text-accent-teal/90 hover:bg-accent-teal/[0.18] hover:border-accent-teal/60 transition-colors";
const DELETE_BTN =
  "border border-line px-2.5 py-1 text-[11px] text-foreground-faint hover:text-danger hover:border-danger/50 transition-colors";

/**
 * 좋아요 + 댓글(+답글) 통합 블록 — 글/인사이트/책 자료/할일 상세 공용.
 *
 * 최상위 댓글마다 아래에 아주 연한 구분선, 우하단에 [삭제]·[답글] 연한 박스.
 * 답글은 댓글 아래 연한 초록 콜아웃(진한 초록 테두리) 박스에 ↳ 화살표와 함께.
 */
export function LikeCommentBlock({
  liked,
  likeCount,
  onToggleLike,
  comments,
  currentUserId,
  canModerate,
  onAddComment,
  onDeleteComment,
}: Props) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  // 좋아요 — 낙관적 업데이트. 클릭 즉시 UI 반영하고 서버는 뒤따른다.
  // (예전엔 서버 왕복 + 전체 refetch 가 끝나야 반영돼 느리고, 빠른 더블클릭
  //  시 토글이 두 번 돌아 되돌아가는 문제가 있었다.)
  const [optimisticLiked, setOptimisticLiked] = useState(liked);
  const [optimisticCount, setOptimisticCount] = useState(likeCount);
  const likePending = useRef(false);

  // 부모(refetch)가 새 값을 주면 동기화 — 단, 인플라이트 중엔 덮어쓰지 않음.
  useEffect(() => {
    if (likePending.current) return;
    setOptimisticLiked(liked);
    setOptimisticCount(likeCount);
  }, [liked, likeCount]);

  async function handleToggleLike() {
    if (likePending.current) return; // 중복 클릭 차단
    likePending.current = true;
    const next = !optimisticLiked;
    setOptimisticLiked(next);
    setOptimisticCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      await onToggleLike();
    } catch {
      // 실패 시 롤백
      setOptimisticLiked(!next);
      setOptimisticCount((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      likePending.current = false;
    }
  }

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesByParent = new Map<string, CommentRow[]>();
  for (const c of comments) {
    if (!c.parent_id) continue;
    const arr = repliesByParent.get(c.parent_id) ?? [];
    arr.push(c);
    repliesByParent.set(c.parent_id, arr);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setBusy(true);
    await onAddComment(t);
    setDraft("");
    setBusy(false);
  }

  return (
    <section className="border-t border-line pt-6 space-y-6">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleToggleLike}
          className={`flex items-center gap-2 border px-3 py-1.5 text-sm transition-colors ${
            optimisticLiked
              ? "border-accent-teal text-accent-teal"
              : "border-line-strong text-foreground-muted hover:border-foreground hover:text-foreground"
          }`}
          aria-pressed={optimisticLiked}
        >
          <span>{optimisticLiked ? "♥" : "♡"}</span>
          <span>{optimisticCount}</span>
        </button>
        <p className="label">댓글 {comments.length}</p>
      </header>

      {topLevel.length > 0 && (
        <ul>
          {topLevel.map((c) => (
            <CommentThread
              key={c.id}
              comment={c}
              replies={repliesByParent.get(c.id) ?? []}
              currentUserId={currentUserId}
              canModerate={canModerate}
              onAddReply={(content) => onAddComment(content, c.id)}
              onDeleteComment={onDeleteComment}
            />
          ))}
        </ul>
      )}

      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <AutoTextarea
          value={draft}
          onChange={setDraft}
          placeholder={
            topLevel.length === 0
              ? "첫 댓글을 남겨주세요. 한줄평도 좋아요."
              : "댓글을 남겨주세요."
          }
          className={`${inputClass} flex-1`}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="bg-accent-teal text-accent-foreground px-4 py-2 text-xs hover:bg-accent-teal/85 transition-colors disabled:opacity-60 sm:self-end shrink-0"
        >
          {busy ? "저장 중..." : "등록"}
        </button>
      </form>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────
// CommentThread — 최상위 댓글 1개 + 그 답글들 + 답글 입력
// ───────────────────────────────────────────────────────────────

function CommentThread({
  comment,
  replies,
  currentUserId,
  canModerate,
  onAddReply,
  onDeleteComment,
}: {
  comment: CommentRow;
  replies: CommentRow[];
  currentUserId: string;
  canModerate: boolean;
  onAddReply: (content: string) => Promise<void>;
  onDeleteComment: (id: string) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const canDelete = comment.user_id === currentUserId || canModerate;

  async function handleDelete(id: string) {
    if (!confirm("이 댓글을 삭제하시겠습니까?")) return;
    await onDeleteComment(id);
  }

  async function submitReply(e: FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setBusy(true);
    await onAddReply(t);
    setDraft("");
    setBusy(false);
    setReplying(false);
  }

  return (
    <li className="py-5 border-b border-line/40 last:border-b-0 first:pt-0">
      <CommentBody
        comment={comment}
        action={
          <div className="flex items-center gap-1.5">
            {canDelete && (
              <button
                type="button"
                onClick={() => handleDelete(comment.id)}
                className={DELETE_BTN}
              >
                삭제
              </button>
            )}
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className={ACTION_BTN}
            >
              {replying ? "취소" : "답글"}
            </button>
          </div>
        }
      />

      {/* 답글 — 연한 초록 콜아웃 + ↳ 화살표, 우하단 삭제 박스 */}
      {replies.length > 0 && (
        <ul className="mt-3 space-y-2">
          {replies.map((r) => {
            const canDeleteReply = r.user_id === currentUserId || canModerate;
            return (
              <li
                key={r.id}
                className="ml-8 border border-accent-teal/70 bg-accent-teal/[0.05] px-3 py-2"
              >
                <CommentBody
                  comment={r}
                  isReply
                  action={
                    canDeleteReply ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(r.id)}
                        className={DELETE_BTN}
                      >
                        삭제
                      </button>
                    ) : null
                  }
                />
              </li>
            );
          })}
        </ul>
      )}

      {replying && (
        <form onSubmit={submitReply} className="mt-2 ml-8 space-y-2">
          <AutoTextarea
            value={draft}
            onChange={setDraft}
            autoFocus
            placeholder="답글을 남겨주세요."
            className={inputClass}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="bg-accent-teal text-accent-foreground px-4 py-2 text-xs hover:bg-accent-teal/85 transition-colors disabled:opacity-60 shrink-0"
            >
              {busy ? "저장 중..." : "답글 등록"}
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

// ───────────────────────────────────────────────────────────────
// CommentBody — 댓글/답글 공용 본문 (아바타 + 이름·날짜 + 내용)
// ───────────────────────────────────────────────────────────────

function CommentBody({
  comment,
  isReply = false,
  action,
}: {
  comment: CommentRow;
  isReply?: boolean;
  /** 행 오른쪽 끝에 수직 가운데로 들어갈 요소 (예: 답글 삭제 버튼). */
  action?: ReactNode;
}) {
  const display = comment.author?.name ?? comment.author?.email ?? "익명";
  return (
    <div className={`flex gap-2.5 ${isReply ? "items-center" : ""}`}>
      {isReply && (
        <ReplyArrow className="w-4 h-4 shrink-0 text-accent-teal" />
      )}
      <Avatar url={comment.author?.avatar_url ?? null} name={display} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-sm">{display}</p>
          <span className="text-xs text-foreground-faint">
            {formatDateTime(comment.created_at)}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-[1.85] text-foreground">
          {comment.content}
        </p>
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/** ↳ 오른쪽 아래로 꺾인 화살표 (답글 표시). */
function ReplyArrow({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 5v6a2 2 0 002 2h7" />
      <path d="M14 10l3.5 3.5L14 17" />
    </svg>
  );
}
