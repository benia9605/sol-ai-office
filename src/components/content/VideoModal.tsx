/**
 * @file src/components/content/VideoModal.tsx
 * @description 영상 상세 모달 — 유튜브 임베드 플레이어 + 해당 영상의 댓글/답글
 */
import { useState } from 'react';
import { YoutubeVideo, YoutubeComment } from '../../types';
import { CommentReplyCard } from './CommentReplyCard';
import { EyeIcon, LikeIcon, CommentIcon, DocIcon } from './icons';

interface VideoModalProps {
  video: YoutubeVideo;
  comments: YoutubeComment[];
  channelTitle: string;
  onClose: () => void;
  onSaveDraft: (id: string, draft: string, status?: 'none' | 'draft' | 'published') => void;
  onPublish: (id: string, replyText: string) => void | Promise<void>;
  onSaveScript: (videoRowId: string, script: string) => void;
  canPublish?: boolean;
}

export function VideoModal({
  video, comments, channelTitle, onClose, onSaveDraft, onPublish, onSaveScript, canPublish = false,
}: VideoModalProps) {
  const pending = comments.filter((c) => c.replyStatus === 'none').length;

  // ── 영상 단위 스크립트 ──
  const [scriptEditing, setScriptEditing] = useState(false);
  const [scriptText, setScriptText] = useState(video.script ?? '');
  const hasScript = !!video.script?.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-0 sm:p-6 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-3xl my-0 sm:my-6 overflow-hidden shadow-hover"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-bold text-gray-800 truncate pr-3">{video.title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 flex-shrink-0"
          >✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* 임베드 플레이어 */}
          <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingTop: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${video.videoId}`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          {/* 통계 */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1"><EyeIcon size={12} /> {(video.viewCount ?? 0).toLocaleString()}</span>
            <span className="inline-flex items-center gap-1"><LikeIcon size={12} /> {(video.likeCount ?? 0).toLocaleString()}</span>
            <span className="inline-flex items-center gap-1"><CommentIcon size={12} /> {(video.commentCount ?? 0).toLocaleString()}</span>
            <a
              href={`https://www.youtube.com/watch?v=${video.videoId}`}
              target="_blank" rel="noopener noreferrer"
              className="ml-auto text-red-500 hover:underline"
            >유튜브에서 열기 →</a>
          </div>

          {/* ── 영상 스크립트 (영상 단위로 1개) ── */}
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
                <DocIcon size={13} /> 영상 스크립트
                {hasScript
                  ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-50 text-primary-600 font-medium">저장됨</span>
                  : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">없음</span>}
              </h3>
              {!scriptEditing && (
                <button
                  onClick={() => { setScriptText(video.script ?? ''); setScriptEditing(true); }}
                  className="px-2.5 py-1 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors flex-shrink-0"
                >{hasScript ? '편집' : '+ 스크립트 추가'}</button>
              )}
            </div>

            {scriptEditing ? (
              <div className="space-y-2">
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  💡 유튜브는 남의 영상 자막을 자동으로 못 가져와요. <b>영상 더보기 → 스크립트 표시 → 전체 복사</b> 후 아래에 붙여넣고 저장하세요. 이 스크립트는 이 영상 댓글의 AI 답글 생성에 활용돼요.
                </p>
                <textarea
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  placeholder="유튜브에서 복사한 자막/스크립트를 여기에 붙여넣기"
                  rows={6}
                  className="w-full px-3 py-2 bg-white border border-primary-100 rounded-lg text-xs resize-y focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => { setScriptText(video.script ?? ''); setScriptEditing(false); }}
                    className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  >취소</button>
                  <button
                    onClick={() => { onSaveScript(video.id, scriptText.trim()); setScriptEditing(false); }}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
                  >저장</button>
                </div>
              </div>
            ) : hasScript ? (
              <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto pr-1">{video.script}</p>
            ) : (
              <p className="text-xs text-gray-400">아직 스크립트가 없어요. 추가하면 이 영상 댓글의 AI 답글이 영상 내용을 반영해 더 정확해져요.</p>
            )}
          </div>

          {/* 댓글 */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
              댓글 {comments.length}개
              {pending > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">미답글 {pending}</span>}
            </h3>
            {comments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">댓글이 없어요</p>
            ) : (
              comments
                .slice()
                .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
                .map((c) => (
                  <CommentReplyCard
                    key={c.id}
                    comment={c}
                    video={video}
                    channelTitle={channelTitle}
                    onSaveDraft={onSaveDraft}
                    onPublish={onPublish}
                    showVideoTitle={false}
                    canPublish={canPublish}
                  />
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
