/**
 * @file src/services/youtubeApi.ts
 * @description YouTube Data API v3 클라이언트 (API 키 기반, 공개 데이터 읽기 전용)
 * - 채널/영상/댓글은 공개 데이터라 OAuth 없이 API 키만으로 조회 가능
 * - 브라우저에서 googleapis로 직접 호출 (CORS 허용됨)
 * - 답글 "발행"(쓰기)은 OAuth(youtube.force-ssl)가 필요 → 별도 단계
 *
 * 필요 환경변수: VITE_YOUTUBE_API_KEY
 *   (Google Cloud → YouTube Data API v3 사용 설정 → API 키 발급)
 */
import type { YoutubeChannel, YoutubeVideo, YoutubeComment } from '../types';

const KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
const BASE = 'https://www.googleapis.com/youtube/v3';

export function hasYoutubeApiKey(): boolean {
  return !!KEY;
}

async function api(path: string, params: Record<string, string>): Promise<any> {
  if (!KEY) throw new Error('VITE_YOUTUBE_API_KEY가 설정되지 않았어요 (Google Cloud에서 YouTube Data API 키 발급 필요)');
  const qs = new URLSearchParams({ ...params, key: KEY }).toString();
  const res = await fetch(`${BASE}/${path}?${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `YouTube API 실패 (${res.status})`);
  }
  return res.json();
}

/** 입력값(채널 ID / @핸들 / URL)에서 핸들 또는 채널 ID 추출 */
function parseChannelInput(input: string): { type: 'id' | 'handle' | 'search'; value: string } {
  const s = input.trim();
  // URL이면 경로 파싱
  const m = s.match(/youtube\.com\/(channel\/(UC[\w-]+)|(@[\w.-]+)|(c\/|user\/)?([\w.-]+))/i);
  if (m) {
    if (m[2]) return { type: 'id', value: m[2] };          // /channel/UC...
    if (m[3]) return { type: 'handle', value: m[3] };       // /@handle
    if (m[5]) return { type: 'search', value: m[5] };       // /c/name, /user/name
  }
  if (/^UC[\w-]{20,}$/.test(s)) return { type: 'id', value: s };
  if (s.startsWith('@')) return { type: 'handle', value: s };
  return { type: 'search', value: s };
}

interface ResolvedChannel extends YoutubeChannel {
  uploadsPlaylistId: string;
}

/** 채널 정보 조회 (업로드 플레이리스트 ID 포함) */
export async function resolveChannel(input: string): Promise<ResolvedChannel> {
  const parsed = parseChannelInput(input);
  let channelId = '';

  if (parsed.type === 'id') {
    channelId = parsed.value;
  } else if (parsed.type === 'handle') {
    const data = await api('channels', { part: 'id', forHandle: parsed.value });
    channelId = data.items?.[0]?.id;
  } else {
    const data = await api('search', { part: 'snippet', type: 'channel', q: parsed.value, maxResults: '1' });
    channelId = data.items?.[0]?.snippet?.channelId || data.items?.[0]?.id?.channelId;
  }

  if (!channelId) throw new Error('채널을 찾지 못했어요. 채널 URL이나 @핸들을 확인해주세요.');

  const data = await api('channels', {
    part: 'snippet,statistics,contentDetails',
    id: channelId,
  });
  const ch = data.items?.[0];
  if (!ch) throw new Error('채널 정보를 불러오지 못했어요.');

  return {
    id: '', // 저장 시 부여
    channelId,
    title: ch.snippet?.title || channelId,
    thumbnail: ch.snippet?.thumbnails?.default?.url,
    subscriberCount: Number(ch.statistics?.subscriberCount) || undefined,
    videoCount: Number(ch.statistics?.videoCount) || undefined,
    uploadsPlaylistId: ch.contentDetails?.relatedPlaylists?.uploads || '',
  };
}

/** 채널의 최근 영상 조회 */
export async function fetchChannelVideos(channelId: string, uploadsPlaylistId: string, max = 10): Promise<YoutubeVideo[]> {
  if (!uploadsPlaylistId) return [];
  const list = await api('playlistItems', {
    part: 'contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: String(max),
  });
  const videoIds: string[] = (list.items || []).map((it: any) => it.contentDetails?.videoId).filter(Boolean);
  if (videoIds.length === 0) return [];

  const detail = await api('videos', {
    part: 'snippet,statistics',
    id: videoIds.join(','),
  });

  return (detail.items || []).map((v: any): YoutubeVideo => ({
    id: '',
    channelId,
    videoId: v.id,
    title: v.snippet?.title || '',
    thumbnail: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url,
    publishedAt: v.snippet?.publishedAt,
    viewCount: Number(v.statistics?.viewCount) || 0,
    likeCount: Number(v.statistics?.likeCount) || 0,
    commentCount: Number(v.statistics?.commentCount) || 0,
  }));
}

/** 영상의 최상위 댓글 조회 (최신순) — 채널 주인이 이미 답글 단 건 'published'로 표시 */
export async function fetchVideoComments(channelId: string, videoId: string, max = 20): Promise<YoutubeComment[]> {
  let data: any;
  try {
    data = await api('commentThreads', {
      part: 'snippet,replies',   // replies까지 받아 기존 답글 감지
      videoId,
      order: 'time',
      maxResults: String(max),
      textFormat: 'plainText',
    });
  } catch {
    // 댓글 비활성화 등은 무시
    return [];
  }

  return (data.items || []).map((it: any): YoutubeComment => {
    const top = it.snippet?.topLevelComment?.snippet || {};
    // 채널 주인(우리)이 단 답글이 이미 있으면 '답변완료'로 인식
    const replies: any[] = it.replies?.comments || [];
    const ownerReply = replies.find((r) => r.snippet?.authorChannelId?.value === channelId);

    return {
      id: '',
      commentId: it.snippet?.topLevelComment?.id || it.id,
      videoId,
      channelId,
      author: top.authorDisplayName || '익명',
      authorThumbnail: top.authorProfileImageUrl,
      text: top.textDisplay || top.textOriginal || '',
      publishedAt: top.publishedAt,
      likeCount: Number(top.likeCount) || 0,
      replyStatus: ownerReply ? 'published' : 'none',
      replyDraft: ownerReply ? (ownerReply.snippet?.textOriginal || ownerReply.snippet?.textDisplay || '') : undefined,
      repliedAt: ownerReply ? ownerReply.snippet?.publishedAt : undefined,
    };
  });
}

/**
 * 댓글에 답글 발행 (comments.insert)
 * - OAuth access token 필요 (youtube.force-ssl). API 키론 불가.
 * - parentCommentId = 최상위 댓글 ID
 */
export async function postReply(parentCommentId: string, text: string, accessToken: string): Promise<void> {
  const res = await fetch(`${BASE}/comments?part=snippet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      snippet: { parentId: parentCommentId, textOriginal: text },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `답글 발행 실패 (${res.status})`);
  }
}

/** 채널 1개 등록용: 채널 + 영상 + (영상별)댓글 한 번에 수집 */
export async function collectChannel(input: string, opts?: { videoLimit?: number; commentLimit?: number }): Promise<{
  channel: ResolvedChannel;
  videos: YoutubeVideo[];
  comments: YoutubeComment[];
}> {
  const channel = await resolveChannel(input);
  const videos = await fetchChannelVideos(channel.channelId, channel.uploadsPlaylistId, opts?.videoLimit ?? 10);

  const comments: YoutubeComment[] = [];
  for (const v of videos) {
    const cs = await fetchVideoComments(channel.channelId, v.videoId, opts?.commentLimit ?? 20);
    comments.push(...cs);
  }

  return { channel, videos, comments };
}
