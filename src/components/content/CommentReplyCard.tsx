/**
 * @file src/components/content/CommentReplyCard.tsx
 * @description 댓글 + 답글 카드 (콘텐츠 페이지 / 영상 모달 공용)
 * - AI 답글 생성(스크립트 기반 + 필요 시 자동 리서치) → 수동 수정 → 발행
 * - 영상 스크립트 보기/편집
 * - 색/모서리/그림자는 테마 글로벌 오버라이드로 모디·모던 자동 대응
 */
import { useState } from 'react';
import { YoutubeComment, YoutubeVideo } from '../../types';
import { generateReplyDraft } from '../../services/youtube.service';
import { VideoIcon, DocIcon, LikeIcon, SparkleIcon, SearchIcon, CommentIcon } from './icons';

function relTime(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days <= 0) {
    const h = Math.floor(diff / 3600000);
    return h <= 0 ? '방금' : `${h}시간 전`;
  }
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  none: { label: '미답글', cls: 'bg-gray-100 text-gray-500' },
  draft: { label: '초안', cls: 'bg-amber-100 text-amber-700' },
  published: { label: '발행됨', cls: 'bg-green-100 text-green-700' },
};

export interface CommentReplyCardProps {
  comment: YoutubeComment;
  video?: YoutubeVideo;
  channelTitle: string;
  onSaveDraft: (id: string, draft: string, status?: 'none' | 'draft' | 'published') => void;
  onPublish: (id: string, replyText: string) => void | Promise<void>;
  showVideoTitle?: boolean;
  canPublish?: boolean;   // OAuth 연동 시 실제 발행, 아니면 수동(완료 표시)
}

export function CommentReplyCard({
  comment, video, channelTitle, onSaveDraft, onPublish, showVideoTitle = true, canPublish = false,
}: CommentReplyCardProps) {
  const [draft, setDraft] = useState(comment.replyDraft ?? '');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(comment.replyStatus !== 'published');
  const [usedResearch, setUsedResearch] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);

  const existingReplies = comment.replies ?? [];
  const totalReplies = comment.replyCount ?? existingReplies.length;

  const videoTitle = video?.title || '(삭제된 영상)';
  const badge = STATUS_BADGE[comment.replyStatus];
  const published = comment.replyStatus === 'published';

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { text, usedResearch: ur } = await generateReplyDraft(
        comment.text, videoTitle, channelTitle, { script: video?.script },
      );
      setDraft(text);
      setUsedResearch(ur);
      onSaveDraft(comment.id, text, 'none'); // 생성 단계는 미답글 유지
    } catch (e: any) {
      setError(e?.message || '생성 실패 — API 키를 확인해주세요');
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    const msg = canPublish
      ? '이 답글을 유튜브에 발행할까요?'
      : '유튜브에 직접 달았다면 완료로 표시할까요? (앱에서 자동 발행되지는 않아요)';
    if (!window.confirm(msg)) return;
    setPublishing(true);
    setError(null);
    try {
      await onPublish(comment.id, draft);
    } catch (e: any) {
      setError(e?.message || '발행 실패 — YouTube 연동/권한을 확인해주세요');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow-soft">
      {/* 댓글 헤더 */}
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-400 flex-shrink-0 overflow-hidden">
          {comment.authorThumbnail ? <img src={comment.authorThumbnail} alt={comment.author} className="w-full h-full object-cover" /> : comment.author.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-700">{comment.author}</span>
            <span className="text-xs text-gray-400">{relTime(comment.publishedAt)}</span>
            {!!comment.likeCount && <span className="inline-flex items-center gap-1 text-xs text-gray-400"><LikeIcon size={11} /> {comment.likeCount}</span>}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.cls}`}>{badge.label}</span>
          </div>
          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{comment.text}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {showVideoTitle && (
              <span className="inline-flex items-center gap-1 max-w-[220px] text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                <VideoIcon size={11} className="flex-shrink-0" />
                <span className="truncate">{videoTitle}</span>
              </span>
            )}
            {video && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${
                  video.script ? 'bg-primary-50 text-primary-500' : 'bg-gray-100 text-gray-400'
                }`}
                title={video.script ? '이 영상 스크립트가 AI 답글에 반영돼요' : '영상을 열어 스크립트를 추가할 수 있어요'}
              >
                <DocIcon size={10} className="flex-shrink-0" />
                {video.script ? '스크립트 반영' : '스크립트 없음'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 유튜브에 이미 달린 답글 (내 답글 + 다른 사람 답글) */}
      {existingReplies.length > 0 && (
        <div className="mt-3 pl-10">
          <button
            onClick={() => setRepliesOpen((v) => !v)}
            className="text-[11px] font-medium text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 transition-colors"
          >
            <CommentIcon size={11} />
            기존 답글 {totalReplies}개
            <span className="text-gray-400">{repliesOpen ? '▲' : '▼'}</span>
          </button>
          {repliesOpen && (
            <ul className="mt-2 space-y-2.5 border-l-2 border-gray-100 pl-3">
              {existingReplies.map((r) => (
                <li key={r.commentId} className="text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`font-semibold ${r.isOwner ? 'text-primary-600' : 'text-gray-600'}`}>{r.author}</span>
                    {r.isOwner && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-600 font-medium">내 답글</span>}
                    <span className="text-gray-400">{relTime(r.publishedAt)}</span>
                    {!!r.likeCount && <span className="inline-flex items-center gap-0.5 text-gray-400"><LikeIcon size={9} /> {r.likeCount}</span>}
                  </div>
                  <p className="text-gray-600 mt-0.5 whitespace-pre-wrap break-words leading-relaxed">{r.text}</p>
                </li>
              ))}
              {totalReplies > existingReplies.length && (
                <li className="text-[10px] text-gray-400">+ {totalReplies - existingReplies.length}개 더 있어요</li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* 발행됨 접힘 */}
      {published && !open ? (
        <div className="mt-3 pl-10">
          <button onClick={() => setOpen(true)} className="text-xs text-green-600 hover:underline">발행한 답글 보기 →</button>
        </div>
      ) : (
        <div className="mt-3 pl-10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              답글
              {usedResearch && <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 font-medium"><SearchIcon size={10} /> 리서치 반영</span>}
            </span>
            {!published && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-2.5 py-1 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-all disabled:opacity-50 flex items-center gap-1"
              >
                {generating ? (
                  <>
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin"><path d="M8 1.5v3M8 11.5v3M14.5 8h-3M4.5 8h-3" /></svg>
                    생성 중…
                  </>
                ) : (
                  <><SparkleIcon size={11} /> {draft ? '다시 생성' : 'AI 답글 생성'}</>
                )}
              </button>
            )}
          </div>

          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={published}
            placeholder="AI로 답글을 생성하거나 직접 작성하세요"
            rows={3}
            className={`w-full px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-200 ${
              published ? 'bg-green-50 border-green-100 text-gray-600' : 'bg-gray-50 border-gray-200'
            }`}
          />

          {error && <p className="text-xs text-red-500">{error}</p>}

          {published ? (
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-green-600">발행됨 · {comment.repliedAt ? relTime(comment.repliedAt) : ''}</span>
              <button onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">접기</button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => navigator.clipboard?.writeText(draft)}
                disabled={!draft.trim()}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all disabled:opacity-40"
              >복사</button>
              <button
                onClick={() => onSaveDraft(comment.id, draft, draft.trim() ? 'draft' : 'none')}
                disabled={!draft.trim()}
                className="px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-all disabled:opacity-40"
              >초안 저장</button>
              <button
                onClick={handlePublish}
                disabled={!draft.trim() || publishing}
                className={`px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-all disabled:opacity-40 ${canPublish ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
              >{publishing ? '처리 중…' : (canPublish ? '발행' : '완료 표시')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
