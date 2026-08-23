/**
 * @file src/components/office/LikeCommentBlock.tsx
 * @description 좋아요 + 댓글(+답글) 통합 블록 — 할일·콘텐츠 상세 공용 (알림 Phase 2)
 * - 자체적으로 좋아요 상태·댓글 로드 + 토글/등록/삭제. 좋아요는 낙관적 업데이트.
 * - 작성자 이름은 members(nickname)에서 해석. 개인 워크스페이스면 알림은 안 감(서버 처리).
 */
import { useEffect, useRef, useState } from 'react';
import { WorkspaceMember, SocialComment } from '../../types';
import { SocialResource, getLikeState, toggleLike, fetchComments, addComment, deleteComment } from '../../services/social.service';
import { getCurrentUserId } from '../../services/auth';

export function LikeCommentBlock({ resource, resId, members }: {
  resource: SocialResource; resId: string; members: WorkspaceMember[];
}) {
  const [currentUserId, setCurrentUserId] = useState('');
  useEffect(() => { getCurrentUserId().then(setCurrentUserId).catch(() => {}); }, []);
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const likePending = useRef(false);

  const nameOf = (uid: string) => {
    if (uid === currentUserId) return '나';
    const m = members.find((x) => x.userId === uid);
    return m?.nickname || '멤버';
  };
  const load = () => Promise.all([
    getLikeState(resource, resId, currentUserId).then((s) => { setCount(s.count); setLiked(s.liked); }).catch(() => {}),
    fetchComments(resource, resId).then(setComments).catch(() => setComments([])),
  ]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [resource, resId, currentUserId]);

  const onLike = async () => {
    if (likePending.current) return;
    likePending.current = true;
    const next = !liked;
    setLiked(next); setCount((c) => Math.max(0, c + (next ? 1 : -1)));  // 낙관적
    try { await toggleLike(resource, resId, currentUserId); }
    catch { setLiked(!next); setCount((c) => Math.max(0, c + (next ? -1 : 1))); }
    finally { likePending.current = false; }
  };
  const submit = async (content: string, parentId?: string | null) => {
    if (!content.trim() || busy) return;
    setBusy(true);
    try { await addComment(resource, resId, content.trim(), parentId ?? null); await fetchComments(resource, resId).then(setComments); }
    catch (e) { console.error('[social] 댓글 실패:', e); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => { await deleteComment(resource, id).catch(() => {}); await fetchComments(resource, resId).then(setComments); };

  const top = comments.filter((c) => !c.parentId);
  const repliesOf = (pid: string) => comments.filter((c) => c.parentId === pid);
  const fmt = (iso: string) => { try { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } catch { return ''; } };

  // ⚠️ 컴포넌트(<Comment/>)로 두면 렌더마다 새 타입이 되어 입력 시 서브트리가 리마운트→포커스 유실.
  //    함수 호출 렌더로 두면 일반 재조정이라 입력 포커스가 유지된다.
  const renderComment = (c: SocialComment, isReply = false): React.ReactNode => (
    <div key={c.id} className={`${isReply ? 'ml-6 border-l-2 border-line pl-3' : ''} py-1.5`}>
      <div className="flex items-baseline gap-2">
        <span className="text-[12px] font-semibold text-foreground">{isReply ? '↳ ' : ''}{nameOf(c.userId)}</span>
        <span className="text-[10px] text-foreground-faint">{fmt(c.createdAt)}</span>
        {c.userId === currentUserId && <button onClick={() => remove(c.id)} className="ml-auto text-[10px] text-foreground-faint hover:text-rose-500">삭제</button>}
      </div>
      <p className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed mt-0.5">{c.content}</p>
      {!isReply && (
        <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyDraft(''); }} className="text-[10px] text-foreground hover:underline mt-0.5">
          {replyTo === c.id ? '취소' : '답글'}
        </button>
      )}
      {replyTo === c.id && (
        <div className="flex gap-1.5 mt-1.5">
          <input autoFocus value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { submit(replyDraft, c.id).then(() => { setReplyDraft(''); setReplyTo(null); }); } }}
            placeholder="답글…" className="flex-1 rounded-lg border border-line px-2.5 py-1 text-[13px] focus:outline-none focus:border-foreground" />
          <button onClick={() => submit(replyDraft, c.id).then(() => { setReplyDraft(''); setReplyTo(null); })} disabled={busy || !replyDraft.trim()}
            className="text-[11px] px-2 py-1 rounded-lg bg-foreground text-white disabled:opacity-40">등록</button>
        </div>
      )}
      {repliesOf(c.id).map((r) => renderComment(r, true))}
    </div>
  );

  return (
    <div className="border-t border-line pt-3 mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <button onClick={onLike} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-sm transition-colors ${liked ? 'border-rose-300 text-rose-500 bg-rose-50' : 'border-line text-foreground-muted hover:border-line-strong'}`}>
          <span>{liked ? '♥' : '♡'}</span><span className="tabular-nums">{count}</span>
        </button>
        <span className="text-[11px] text-foreground-faint">댓글 {comments.length}</span>
      </div>

      {top.length > 0 && <div className="divide-y divide-line">{top.map((c) => renderComment(c))}</div>}

      <div className="flex gap-1.5">
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(draft).then(() => setDraft('')); }}
          placeholder={top.length === 0 ? '첫 댓글을 남겨보세요' : '댓글 남기기…'}
          className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm focus:outline-none focus:border-foreground" />
        <button onClick={() => submit(draft).then(() => setDraft(''))} disabled={busy || !draft.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-foreground text-white hover:opacity-85 disabled:opacity-40">등록</button>
      </div>
    </div>
  );
}
