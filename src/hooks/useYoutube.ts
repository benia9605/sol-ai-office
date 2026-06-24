/**
 * @file src/hooks/useYoutube.ts
 * @description 콘텐츠(유튜브) 데이터 관리 훅
 * - Supabase 연동 (youtube_channels / youtube_videos / youtube_comments)
 * - Supabase 미설정/실패 시 더미 데이터 폴백
 * - 답글 초안 저장 / 발행 (낙관적 업데이트)
 */
import { useState, useEffect, useCallback } from 'react';
import { YoutubeChannel, YoutubeVideo, YoutubeComment, YoutubeReplyStatus } from '../types';
import { dummyYoutubeChannels, dummyYoutubeVideos, dummyYoutubeComments } from '../data';
import {
  fetchChannels, fetchVideos, fetchComments, updateComment, publishReply, updateVideoScript,
  insertChannel, insertVideos, insertComments, deleteChannelData,
  YoutubeChannelRow, YoutubeVideoRow, YoutubeCommentRow,
} from '../services/youtube.service';
import { collectChannel, hasYoutubeApiKey, postReply } from '../services/youtubeApi';
import { getYoutubeAccessToken, hasYoutubeOAuth } from '../services/youtubeOAuth';

let _localId = 1;
const localId = (p: string) => `${p}-local-${_localId++}`;

function toChannel(r: YoutubeChannelRow): YoutubeChannel {
  return {
    id: r.id, channelId: r.channel_id, title: r.title, thumbnail: r.thumbnail,
    subscriberCount: r.subscriber_count, videoCount: r.video_count, connectedAt: r.connected_at,
  };
}

function toVideo(r: YoutubeVideoRow): YoutubeVideo {
  return {
    id: r.id, channelId: r.channel_id, videoId: r.video_id, title: r.title,
    thumbnail: r.thumbnail, publishedAt: r.published_at, viewCount: r.view_count,
    likeCount: r.like_count, commentCount: r.comment_count, script: r.script,
  };
}

function toComment(r: YoutubeCommentRow): YoutubeComment {
  return {
    id: r.id, commentId: r.comment_id, videoId: r.video_id, channelId: r.channel_id,
    author: r.author, authorThumbnail: r.author_thumbnail, text: r.text,
    publishedAt: r.published_at, likeCount: r.like_count, replyStatus: r.reply_status,
    replyDraft: r.reply_draft, repliedAt: r.replied_at,
    replies: r.replies ?? undefined, replyCount: r.reply_count ?? undefined,
  };
}

export function useYoutube(workspaceId?: string) {
  const [channels, setChannels] = useState<YoutubeChannel[]>([]);
  const [videos, setVideos] = useState<YoutubeVideo[]>([]);
  const [comments, setComments] = useState<YoutubeComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingDummy, setUsingDummy] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [ch, vd, cm] = await Promise.all([fetchChannels(workspaceId), fetchVideos(workspaceId), fetchComments(workspaceId)]);
      setChannels(ch.map(toChannel));
      setVideos(vd.map(toVideo));
      setComments(cm.map(toComment));
      setUsingDummy(false);
    } catch (e) {
      console.warn('[useYoutube] Supabase 연결 실패, 더미 데이터 사용:', e);
      setChannels(dummyYoutubeChannels);
      setVideos(dummyYoutubeVideos);
      setComments(dummyYoutubeComments);
      setUsingDummy(true);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  /** 답글 초안 저장 (상태도 함께 draft 처리) */
  const saveDraft = useCallback(async (id: string, draft: string, status: YoutubeReplyStatus = 'draft') => {
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, replyDraft: draft, replyStatus: status } : c)));
    if (!usingDummy) {
      try {
        await updateComment(id, { reply_draft: draft, reply_status: status });
      } catch (e) {
        console.error('[useYoutube] 초안 저장 실패:', e);
        load();
      }
    }
  }, [usingDummy, load]);

  /**
   * 답글 발행
   * - OAuth 설정(VITE_GOOGLE_CLIENT_ID) 있으면 실제 YouTube에 발행(comments.insert)
   * - 없으면 상태만 'published'로 (미리보기/복붙 흐름)
   * - 실제 발행 실패 시 throw (UI에서 에러 표시, 상태 변경 안 함)
   */
  const publish = useCallback(async (id: string, replyText: string) => {
    const comment = comments.find((c) => c.id === id);

    if (hasYoutubeOAuth() && comment) {
      const token = await getYoutubeAccessToken();   // 필요 시 동의 팝업
      await postReply(comment.commentId, replyText, token);  // 실패 시 throw → 발행 안 됨
    }

    const repliedAt = new Date().toISOString();
    setComments((prev) => prev.map((c) => (
      c.id === id ? { ...c, replyDraft: replyText, replyStatus: 'published', repliedAt } : c
    )));
    if (!usingDummy) {
      try {
        await publishReply(id, replyText);
      } catch (e) {
        console.error('[useYoutube] 상태 저장 실패:', e);
        load();
      }
    }
  }, [comments, usingDummy, load]);

  /** 채널 직접 등록 (입력: 채널 URL / @핸들 / 채널 ID) — API로 영상·댓글까지 수집 */
  const addChannel = useCallback(async (input: string) => {
    const { channel, videos: vids, comments: cms } = await collectChannel(input);

    if (channels.some((c) => c.channelId === channel.channelId)) {
      throw new Error('이미 등록된 채널이에요.');
    }

    if (usingDummy) {
      // 인메모리(목업)
      setChannels((prev) => [...prev, { ...channel, id: localId('ch') }]);
      setVideos((prev) => [...vids.map((v) => ({ ...v, id: localId('vid') })), ...prev]);
      setComments((prev) => [...cms.map((c) => ({ ...c, id: localId('cm') })), ...prev]);
      return;
    }

    const chRow = await insertChannel(channel, workspaceId);
    const vRows = await insertVideos(channel.channelId, vids, workspaceId);
    const cRows = await insertComments(cms, workspaceId);
    setChannels((prev) => [...prev, toChannel(chRow)]);
    setVideos((prev) => [...vRows.map(toVideo), ...prev]);
    setComments((prev) => [...cRows.map(toComment), ...prev]);
  }, [channels, usingDummy, workspaceId]);

  /** 채널 등록 해제 (채널 + 영상 + 댓글 제거) */
  const removeChannel = useCallback(async (channelId: string) => {
    setChannels((prev) => prev.filter((c) => c.channelId !== channelId));
    setVideos((prev) => prev.filter((v) => v.channelId !== channelId));
    setComments((prev) => prev.filter((c) => c.channelId !== channelId));
    if (!usingDummy) {
      try {
        await deleteChannelData(channelId);
      } catch (e) {
        console.error('[useYoutube] 채널 삭제 실패:', e);
        load();
      }
    }
  }, [usingDummy, load]);

  /**
   * YouTube에서 새 영상/댓글 병합 + 기존 댓글의 답글 상태 재동기화
   * - 새 영상/댓글: 추가
   * - 기존 댓글 중 유튜브엔 내(채널 주인) 답글이 달렸는데 앱에선 아직 '미답글'인 것 → '발행됨'으로 동기화
   *   (예전에 이미 답글 단 댓글이 계속 '미답글'로 뜨는 문제 해결)
   * - 앱에서 직접 단 초안/발행 상태는 보존 (덮어쓰지 않음)
   */
  const refreshFromApi = useCallback(async () => {
    if (!hasYoutubeApiKey() || channels.length === 0) {
      await load();
      return;
    }
    const existingCommentIds = new Set(comments.map((c) => c.commentId));
    const existingVideoIds = new Set(videos.map((v) => v.videoId));
    const byCommentId = new Map(comments.map((c) => [c.commentId, c]));

    for (const ch of channels) {
      const { videos: vids, comments: cms } = await collectChannel(ch.channelId);
      const newVids = vids.filter((v) => !existingVideoIds.has(v.videoId));
      const newCms = cms.filter((c) => !existingCommentIds.has(c.commentId));

      // 기존 댓글 재동기화 대상: 유튜브 답글이 새로 생겼거나(내 것/남의 것), 내 답글이 달려 상태가 바뀐 경우
      const reSync = cms.filter((c) => {
        const ex = byCommentId.get(c.commentId);
        if (!ex) return false;
        const ownerNowReplied = c.replyStatus === 'published' && ex.replyStatus === 'none';
        const repliesChanged = (c.replyCount ?? 0) !== (ex.replyCount ?? 0)
          || (c.replies?.length ?? 0) !== (ex.replies?.length ?? 0);
        return ownerNowReplied || repliesChanged;
      });

      if (newVids.length === 0 && newCms.length === 0 && reSync.length === 0) continue;

      if (usingDummy) {
        setVideos((prev) => [...newVids.map((v) => ({ ...v, id: localId('vid') })), ...prev]);
        setComments((prev) => [...newCms.map((c) => ({ ...c, id: localId('cm') })), ...prev]);
      } else {
        const vRows = await insertVideos(ch.channelId, newVids, workspaceId);
        const cRows = await insertComments(newCms, workspaceId);
        setVideos((prev) => [...vRows.map(toVideo), ...prev]);
        setComments((prev) => [...cRows.map(toComment), ...prev]);
      }

      // 기존 댓글의 답글/상태 동기화 (로컬 + DB)
      if (reSync.length > 0) {
        const reSyncMap = new Map(reSync.map((c) => [c.commentId, c]));
        setComments((prev) => prev.map((pc) => {
          const m = reSyncMap.get(pc.commentId);
          if (!m) return pc;
          // 내가 답글을 단 게 새로 확인되면 발행됨으로, 아니면 기존 상태 유지(앱 초안/발행 보존)
          const status: YoutubeReplyStatus = (m.replyStatus === 'published' && pc.replyStatus === 'none') ? 'published' : pc.replyStatus;
          return {
            ...pc,
            replyStatus: status,
            replyDraft: status === 'published' && pc.replyStatus === 'none' ? (m.replyDraft ?? pc.replyDraft) : pc.replyDraft,
            repliedAt: status === 'published' && pc.replyStatus === 'none' ? (m.repliedAt ?? pc.repliedAt) : pc.repliedAt,
            replies: m.replies ?? pc.replies,
            replyCount: m.replyCount ?? pc.replyCount,
          };
        }));
        if (!usingDummy) {
          for (const c of reSync) {
            const ex = byCommentId.get(c.commentId);
            if (!ex) continue;
            const becomesPublished = c.replyStatus === 'published' && ex.replyStatus === 'none';
            try {
              await updateComment(ex.id, {
                replies: c.replies ?? undefined,
                reply_count: c.replyCount ?? undefined,
                ...(becomesPublished ? { reply_status: 'published', reply_draft: c.replyDraft, replied_at: c.repliedAt } : {}),
              });
            } catch (e) {
              console.error('[useYoutube] 답글 동기화 실패:', e);
            }
          }
        }
      }
    }
  }, [channels, comments, videos, usingDummy, load, workspaceId]);

  /** 영상 스크립트 저장 */
  const saveScript = useCallback(async (videoRowId: string, script: string) => {
    setVideos((prev) => prev.map((v) => (v.id === videoRowId ? { ...v, script } : v)));
    if (!usingDummy) {
      try {
        await updateVideoScript(videoRowId, script);
      } catch (e) {
        console.error('[useYoutube] 스크립트 저장 실패:', e);
        load();
      }
    }
  }, [usingDummy, load]);

  return {
    channels, videos, comments, loading, usingDummy,
    reload: load, refreshFromApi, addChannel, removeChannel,
    saveDraft, publish, saveScript,
    hasApiKey: hasYoutubeApiKey(),
    hasOAuth: hasYoutubeOAuth(),
  };
}
