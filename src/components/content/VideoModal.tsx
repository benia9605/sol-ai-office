/**
 * @file src/components/content/VideoModal.tsx
 * @description 영상 상세 모달 — 유튜브 임베드 플레이어 + 해당 영상의 댓글/답글
 */
import { YoutubeVideo, YoutubeComment } from '../../types';
import { CommentReplyCard } from './CommentReplyCard';
import { EyeIcon, LikeIcon, CommentIcon } from './icons';

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
                    onSaveScript={onSaveScript}
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
