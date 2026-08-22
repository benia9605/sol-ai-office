import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { useAuth } from "@/lib/auth-context";
import { useActiveWorkspace } from "@/lib/active-workspace";
import { useAsync } from "@/lib/use-async";
import { getMyRole } from "@/lib/data/workspaces";
import { getWorkspaceMembers } from "@/lib/data/workspace-members";
import {
  addComment,
  castVote,
  deleteAgenda,
  deleteComment,
  getAgenda,
  isAgendaClosed,
  listComments,
  listVotes,
  tallyAgenda,
  updateAgenda,
} from "@/lib/data/agendas";
import { Avatar } from "@/components/avatar";
import { Modal } from "@/components/modal";
import { errorBox, inputClass } from "@/features/auth/_shared";
import { RichRender } from "@/features/editor/rich-editor";
import { formatDateTime, formatShortDateTime } from "@/lib/format";
import type { AgendaOption } from "@/lib/types/database";
import type { MemberWithProfile } from "@/lib/data/workspace-members";

const POLL_LABEL: Record<string, string> = {
  single: "단일선택",
  multi: "복수선택",
  text: "주관식",
};

function deadlineLabel(deadline: string, closed: boolean): string {
  if (closed) return "마감됨";
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "마감됨";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days >= 1) return `${days}일 ${hours}시간 남음`;
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 1) return `${hours}시간 ${mins}분 남음`;
  return `${mins}분 남음`;
}

export function AgendaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { workspace } = useActiveWorkspace();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: agenda, loading } = useAsync(
    () => (id ? getAgenda(id) : Promise.resolve(null)),
    [id, refreshKey],
  );
  const { data: votes } = useAsync(
    () => (id ? listVotes(id) : Promise.resolve([])),
    [id, refreshKey],
  );
  const { data: comments } = useAsync(
    () => (id ? listComments(id) : Promise.resolve([])),
    [id, refreshKey],
  );
  const { data: myRole } = useAsync(
    () =>
      workspace && user
        ? getMyRole(workspace.id, user.id)
        : Promise.resolve(null),
    [workspace?.id, user?.id],
  );
  const { data: members } = useAsync(
    () =>
      workspace ? getWorkspaceMembers(workspace.id) : Promise.resolve([]),
    [workspace?.id],
  );

  const closed = useMemo(
    () => (agenda ? isAgendaClosed(agenda) : false),
    [agenda],
  );

  if (loading) return null;
  if (!agenda) return <Navigate to="/agendas" replace />;
  if (!user) return null;

  const canManage =
    agenda.user_id === user.id || myRole === "owner" || myRole === "admin";
  const isAuthor = agenda.user_id === user.id;
  const authorName = agenda.author?.name ?? agenda.author?.email ?? "익명";

  const myVote = (votes ?? []).find((v) => v.user_id === user.id);

  const { tally, winnerId } = tallyAgenda(agenda, votes ?? []);
  const totalVoters = (votes ?? []).length;
  const memberCount = (members ?? []).length;

  async function handleCloseNow() {
    if (!confirm("지금 마감하시겠습니까? 더 이상 응답을 받지 않습니다.")) return;
    await updateAgenda(agenda!.id, { closed_at: new Date().toISOString() });
    setRefreshKey((v) => v + 1);
  }

  async function handleDelete() {
    if (!confirm("이 안건을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    const ok = await deleteAgenda(agenda!.id);
    if (ok) navigate("/agendas");
  }

  return (
    <article className="space-y-10 max-w-3xl">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/agendas"
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          ← 안건 · 투표
        </Link>
        {canManage && (
          <div className="flex items-center gap-2 text-xs">
            <Link
              to={`/agendas/${agenda.id}/edit`}
              className="border border-line-strong px-3 py-1.5 hover:border-foreground"
            >
              {isAuthor ? "편집" : "편집 (운영자)"}
            </Link>
            {!closed && (
              <button
                type="button"
                onClick={handleCloseNow}
                className="border border-line-strong px-3 py-1.5 hover:border-foreground"
              >
                지금 마감
              </button>
            )}
            <button
              type="button"
              onClick={handleDelete}
              className="px-2 text-danger hover:underline underline-offset-4"
            >
              {isAuthor ? "삭제" : "삭제 (운영자)"}
            </button>
          </div>
        )}
      </div>

      <header>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-foreground/5 px-2.5 py-1 text-[10px] tracking-widest uppercase text-foreground-muted">
            {POLL_LABEL[agenda.poll_type] ?? agenda.poll_type}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] tracking-widest uppercase ${
              closed
                ? "bg-foreground/5 text-foreground-muted"
                : "bg-accent-teal/10 text-accent-teal"
            }`}
          >
            {deadlineLabel(agenda.deadline, closed)}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-light leading-tight sm:text-4xl">
          {agenda.title}
        </h1>
        {agenda.description && (
          <div className="mt-4">
            <RichRender html={agenda.description} />
          </div>
        )}
      </header>

      <section className="flex items-center gap-4 border-y border-line py-4">
        <Avatar
          url={agenda.author?.avatar_url ?? null}
          name={authorName}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm">{authorName}</p>
          <p className="text-xs text-foreground-faint">
            {formatShortDateTime(agenda.created_at)} · 마감{" "}
            {new Date(agenda.deadline).toLocaleString("ko-KR", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <p className="text-xs text-foreground-muted shrink-0">
          {totalVoters} / {memberCount}명 응답
        </p>
      </section>

      {agenda.poll_type === "text" ? (
        <TextAnswerSection
          agendaId={agenda.id}
          userId={user.id}
          closed={closed}
          initialAnswer={myVote?.text_answer ?? ""}
          allAnswers={(votes ?? []).filter(
            (v) => v.user_id !== user.id && v.text_answer,
          )}
          memberById={new Map(
            (members ?? []).map((m) => [m.user_id, m]),
          )}
          onSaved={() => setRefreshKey((v) => v + 1)}
        />
      ) : (
        <PollSection
          options={agenda.options}
          poll_type={agenda.poll_type}
          agendaId={agenda.id}
          userId={user.id}
          tally={tally}
          winnerId={winnerId}
          closed={closed}
          currentChoices={myVote?.choices ?? []}
          memberById={new Map(
            (members ?? []).map((m) => [m.user_id, m]),
          )}
          onSaved={() => setRefreshKey((v) => v + 1)}
        />
      )}

      <CommentsSection
        agendaId={agenda.id}
        userId={user.id}
        comments={comments ?? []}
        canModerate={myRole === "owner" || myRole === "admin"}
        onChanged={() => setRefreshKey((v) => v + 1)}
      />
    </article>
  );
}

function PollSection({
  options,
  poll_type,
  agendaId,
  userId,
  tally,
  winnerId,
  closed,
  currentChoices,
  memberById,
  onSaved,
}: {
  options: AgendaOption[];
  poll_type: "single" | "multi";
  agendaId: string;
  userId: string;
  tally: { option: AgendaOption; count: number; voters: string[] }[];
  winnerId: string | null;
  closed: boolean;
  currentChoices: string[];
  memberById: Map<string, MemberWithProfile>;
  onSaved: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(currentChoices);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voterDialog, setVoterDialog] = useState<{
    optionLabel: string;
    voterIds: string[];
  } | null>(null);

  const total = tally.reduce((acc, t) => acc + t.count, 0);

  function toggle(id: string) {
    if (closed) return;
    setPicked((cur) => {
      if (poll_type === "single") return [id];
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });
  }

  async function submit() {
    if (closed) return;
    if (picked.length === 0) {
      setError("최소 1개 옵션을 선택해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await castVote({ agenda_id: agendaId, choices: picked }, userId);
      onSaved();
    } catch (err) {
      setError((err as Error).message || "투표 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="label">투표</h2>
        {!closed && currentChoices.length > 0 && (
          <p className="text-xs text-foreground-faint">변경 가능</p>
        )}
      </div>
      <ul className="space-y-2">
        {options.map((o) => {
          const t = tally.find((x) => x.option.id === o.id);
          const count = t?.count ?? 0;
          const pct = total === 0 ? 0 : Math.round((count / total) * 100);
          const isPicked = picked.includes(o.id);
          const isWinner = winnerId === o.id && total > 0;
          const showResults = closed || currentChoices.length > 0;
          const openVoters = () =>
            count > 0 &&
            setVoterDialog({
              optionLabel: o.label,
              voterIds: t?.voters ?? [],
            });
          return (
            <li
              key={o.id}
              className={`relative flex items-stretch border transition-colors overflow-hidden ${
                closed
                  ? "border-line"
                  : isPicked
                    ? "border-foreground bg-surface-muted"
                    : "border-line hover:border-foreground"
              }`}
            >
              {/* progress fill (closed 이거나 이미 투표한 후만 표시) */}
              {showResults && (
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 pointer-events-none ${
                    isWinner ? "bg-accent-teal/15" : "bg-foreground/5"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              )}
              {/* 라디오 — 토글 트리거 (이 영역만 투표 ON/OFF) */}
              <button
                type="button"
                onClick={() => toggle(o.id)}
                disabled={closed}
                aria-label={`${o.label} ${isPicked ? "선택 해제" : "선택"}`}
                className={`relative shrink-0 flex items-center justify-center px-3 py-3 ${
                  closed ? "cursor-default" : ""
                }`}
              >
                <span
                  aria-hidden
                  className={`inline-block ${
                    poll_type === "multi" ? "rounded-none" : "rounded-full"
                  } w-4 h-4 border ${
                    isPicked
                      ? "bg-foreground border-foreground"
                      : "border-line-strong"
                  }`}
                />
              </button>
              {/* 라벨 — 투표자 팝업 트리거 (count 0 면 비활성) */}
              <button
                type="button"
                onClick={openVoters}
                disabled={count === 0}
                aria-label={
                  count > 0
                    ? `「${o.label}」 에 투표한 사람 보기`
                    : `「${o.label}」 (투표 없음)`
                }
                className="relative flex-1 flex items-center gap-2 text-left pr-3 py-3 text-sm disabled:cursor-default"
              >
                <span className="truncate">{o.label}</span>
                {isWinner && (
                  <span className="text-[10px] tracking-widest uppercase text-accent-teal shrink-0">
                    다수 채택
                  </span>
                )}
              </button>
              {/* 카운트 — 동일 팝업 트리거. w-28 고정으로 구분선 위치 일정. */}
              {showResults && (
                <button
                  type="button"
                  onClick={openVoters}
                  disabled={count === 0}
                  aria-label={
                    count > 0
                      ? `「${o.label}」 에 투표한 사람 보기`
                      : "투표 없음"
                  }
                  className="relative shrink-0 w-28 border-l border-line px-3 py-3 text-xs tabular-nums text-foreground-muted hover:text-foreground hover:bg-surface-muted disabled:hover:bg-transparent disabled:cursor-default text-right"
                >
                  {count}표 · {pct}%
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {error && <p className={`${errorBox} mt-3`}>{error}</p>}

      {!closed && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="border border-accent bg-accent px-5 py-2 text-sm text-accent-foreground hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-60"
          >
            {busy
              ? "투표 중..."
              : currentChoices.length > 0
                ? "투표 수정"
                : "투표하기"}
          </button>
        </div>
      )}

      <VotersDialog
        open={!!voterDialog}
        onClose={() => setVoterDialog(null)}
        optionLabel={voterDialog?.optionLabel ?? ""}
        voterIds={voterDialog?.voterIds ?? []}
        memberById={memberById}
      />
    </section>
  );
}

function VotersDialog({
  open,
  onClose,
  optionLabel,
  voterIds,
  memberById,
}: {
  open: boolean;
  onClose: () => void;
  optionLabel: string;
  voterIds: string[];
  memberById: Map<string, MemberWithProfile>;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="투표한 사람"
      subtitle={optionLabel ? `「${optionLabel}」` : undefined}
      size="sm"
    >
      {voterIds.length === 0 ? (
        <p className="py-4 text-center text-sm text-foreground-faint">
          아직 투표한 사람이 없어요.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {voterIds.map((uid) => {
            const m = memberById.get(uid);
            const name = m?.profile?.name ?? m?.profile?.email ?? "익명";
            const avatar = m?.profile?.avatar_url ?? null;
            return (
              <li key={uid} className="flex items-center gap-3 py-3">
                <Avatar url={avatar} name={name} size="sm" />
                <span className="text-sm truncate">{name}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

function TextAnswerSection({
  agendaId,
  userId,
  closed,
  initialAnswer,
  allAnswers,
  memberById,
  onSaved,
}: {
  agendaId: string;
  userId: string;
  closed: boolean;
  initialAnswer: string;
  allAnswers: Array<{ user_id: string; text_answer: string | null }>;
  memberById: Map<
    string,
    { user_id: string; profile: { name: string | null; email: string | null; avatar_url: string | null } }
  >;
  onSaved: () => void;
}) {
  const [text, setText] = useState(initialAnswer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError("응답을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await castVote(
        { agenda_id: agendaId, choices: [], text_answer: text.trim() },
        userId,
      );
      onSaved();
    } catch (err) {
      setError((err as Error).message || "응답 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="label mb-3">내 응답</h2>
        {closed ? (
          <p className="border border-line px-3 py-3 text-sm whitespace-pre-line">
            {initialAnswer || (
              <span className="text-foreground-faint">응답 없음</span>
            )}
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="이 안건에 대한 의견을 적어주세요."
              className={`${inputClass} min-h-[120px]`}
            />
            {error && <p className={errorBox}>{error}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="border border-accent bg-accent px-5 py-2 text-sm text-accent-foreground hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-60"
              >
                {busy
                  ? "저장 중..."
                  : initialAnswer
                    ? "응답 수정"
                    : "응답하기"}
              </button>
            </div>
          </form>
        )}
      </div>

      <div>
        <h2 className="label mb-3">다른 멤버의 응답 · {allAnswers.length}</h2>
        {allAnswers.length === 0 ? (
          <p className="text-xs text-foreground-faint">
            아직 다른 멤버의 응답이 없습니다.
          </p>
        ) : (
          <ul className="border-y border-line divide-y divide-line">
            {allAnswers.map((a) => {
              const m = memberById.get(a.user_id);
              const display = m?.profile.name ?? m?.profile.email ?? "익명";
              return (
                <li
                  key={a.user_id}
                  className="py-4 flex items-start gap-3"
                >
                  <Avatar
                    url={m?.profile.avatar_url ?? null}
                    name={display}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-foreground-muted">{display}</p>
                    <p className="mt-1 text-sm whitespace-pre-line">
                      {a.text_answer}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function CommentsSection({
  agendaId,
  userId,
  comments,
  canModerate,
  onChanged,
}: {
  agendaId: string;
  userId: string;
  comments: Awaited<ReturnType<typeof listComments>>;
  canModerate: boolean;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesByParent = new Map<string, typeof comments>();
  for (const c of comments) {
    if (!c.parent_id) continue;
    const arr = repliesByParent.get(c.parent_id) ?? [];
    arr.push(c);
    repliesByParent.set(c.parent_id, arr);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await addComment(agendaId, userId, draft.trim());
      setDraft("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    const ok = await deleteComment(id);
    if (ok) onChanged();
  }

  return (
    <section>
      <h2 className="label mb-3">의견 · {comments.length}</h2>
      <ul>
        {topLevel.map((c) => (
          <AgendaCommentThread
            key={c.id}
            comment={c}
            replies={repliesByParent.get(c.id) ?? []}
            agendaId={agendaId}
            userId={userId}
            canModerate={canModerate}
            onRemove={remove}
            onChanged={onChanged}
          />
        ))}
      </ul>
      <form onSubmit={submit} className="mt-4 flex items-start gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="의견을 남겨주세요."
          rows={2}
          className={`${inputClass} flex-1 min-h-0`}
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="border border-accent bg-accent px-4 py-2 text-sm text-accent-foreground hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-60"
        >
          {busy ? "..." : "등록"}
        </button>
      </form>
    </section>
  );
}

type AgendaCommentRow = Awaited<ReturnType<typeof listComments>>[number];

const AGENDA_ACTION_BTN =
  "border border-accent-teal/40 bg-accent-teal/10 px-2.5 py-1 text-[11px] text-accent-teal/90 hover:bg-accent-teal/[0.18] hover:border-accent-teal/60 transition-colors";
const AGENDA_DELETE_BTN =
  "border border-line px-2.5 py-1 text-[11px] text-foreground-faint hover:text-danger hover:border-danger/50 transition-colors";

function AgendaCommentRowBody({
  comment,
  isReply = false,
  action,
}: {
  comment: AgendaCommentRow;
  isReply?: boolean;
  action?: ReactNode;
}) {
  const display = comment.author?.name ?? comment.author?.email ?? "익명";
  return (
    <div className={`flex gap-2.5 ${isReply ? "items-center" : "items-start"}`}>
      {isReply && (
        <ReplyArrow className="w-4 h-4 shrink-0 text-accent-teal" />
      )}
      <Avatar
        url={comment.author?.avatar_url ?? null}
        name={display}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className="text-xs text-foreground-muted">{display}</p>
          <p className="text-xs text-foreground-faint">
            {formatDateTime(comment.created_at)}
          </p>
        </div>
        <p className="mt-1 text-sm whitespace-pre-line">{comment.content}</p>
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

function AgendaCommentThread({
  comment,
  replies,
  agendaId,
  userId,
  canModerate,
  onRemove,
  onChanged,
}: {
  comment: AgendaCommentRow;
  replies: AgendaCommentRow[];
  agendaId: string;
  userId: string;
  canModerate: boolean;
  onRemove: (id: string) => void;
  onChanged: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitReply(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await addComment(agendaId, userId, draft.trim(), comment.id);
      setDraft("");
      setReplying(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const canDelete = comment.user_id === userId || canModerate;

  return (
    <li className="py-4 border-b border-line/40 last:border-b-0 first:pt-0">
      <AgendaCommentRowBody
        comment={comment}
        action={
          <div className="flex items-center gap-1.5">
            {canDelete && (
              <button
                type="button"
                onClick={() => onRemove(comment.id)}
                className={AGENDA_DELETE_BTN}
              >
                삭제
              </button>
            )}
            <button
              type="button"
              onClick={() => setReplying((v) => !v)}
              className={AGENDA_ACTION_BTN}
            >
              {replying ? "취소" : "답글"}
            </button>
          </div>
        }
      />

      {replies.length > 0 && (
        <ul className="mt-3 space-y-2">
          {replies.map((r) => {
            const canDeleteReply = r.user_id === userId || canModerate;
            return (
              <li
                key={r.id}
                className="ml-8 border border-accent-teal/70 bg-accent-teal/[0.05] px-3 py-2"
              >
                <AgendaCommentRowBody
                  comment={r}
                  isReply
                  action={
                    canDeleteReply ? (
                      <button
                        type="button"
                        onClick={() => onRemove(r.id)}
                        className={AGENDA_DELETE_BTN}
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
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="답글을 남겨주세요."
            rows={2}
            autoFocus
            className={`${inputClass} min-h-0`}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="bg-accent-teal text-accent-foreground px-4 py-2 text-sm hover:bg-accent-teal/85 disabled:opacity-60"
            >
              {busy ? "..." : "답글"}
            </button>
          </div>
        </form>
      )}
    </li>
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
