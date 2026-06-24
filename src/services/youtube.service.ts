/**
 * @file src/services/youtube.service.ts
 * @description 콘텐츠(유튜브) 데이터 서비스
 * - Supabase youtube_channels / youtube_videos / youtube_comments 테이블 연동
 * - 댓글 답글 초안 AI 생성 (Claude 프록시 재활용)
 * - 답글 발행(publishReply)은 현재 상태만 변경 (실제 YouTube API 연동은 추후)
 *
 * DB 컬럼 (snake_case):
 *   youtube_channels: id, user_id, channel_id, title, thumbnail,
 *                     subscriber_count, video_count, connected_at
 *   youtube_videos:   id, user_id, channel_id, video_id, title, thumbnail,
 *                     published_at, view_count, like_count, comment_count
 *   youtube_comments: id, user_id, comment_id, video_id, channel_id, author,
 *                     author_thumbnail, text, published_at, like_count,
 *                     reply_status, reply_draft, replied_at
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import type { YoutubeReplyStatus, YoutubeCommentReply } from '../types';

const CLAUDE_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

// ── Row 타입 ──

export interface YoutubeChannelRow {
  id: string;
  channel_id: string;
  title: string;
  thumbnail?: string;
  subscriber_count?: number;
  video_count?: number;
  connected_at?: string;
  workspace_id?: string;
}

export interface YoutubeVideoRow {
  id: string;
  channel_id: string;
  video_id: string;
  title: string;
  thumbnail?: string;
  published_at: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  script?: string;
  workspace_id?: string;
}

export interface YoutubeCommentRow {
  id: string;
  comment_id: string;
  video_id: string;
  channel_id: string;
  author: string;
  author_thumbnail?: string;
  text: string;
  published_at: string;
  like_count?: number;
  reply_status: YoutubeReplyStatus;
  reply_draft?: string;
  replied_at?: string;
  replies?: YoutubeCommentReply[];
  reply_count?: number;
  workspace_id?: string;
}

// ── 채널 ──

export async function fetchChannels(workspaceId?: string): Promise<YoutubeChannelRow[]> {
  const userId = await getCurrentUserId();
  let q = supabase.from('youtube_channels').select('*').eq('user_id', userId);
  q = workspaceId ? q.eq('workspace_id', workspaceId) : q.is('workspace_id', null);
  const { data, error } = await q.order('connected_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function insertChannel(c: {
  channelId: string; title: string; thumbnail?: string; subscriberCount?: number; videoCount?: number;
}, workspaceId?: string): Promise<YoutubeChannelRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('youtube_channels')
    .insert({
      user_id: userId,
      channel_id: c.channelId,
      title: c.title,
      thumbnail: c.thumbnail ?? null,
      subscriber_count: c.subscriberCount ?? null,
      video_count: c.videoCount ?? null,
      connected_at: new Date().toISOString(),
      workspace_id: workspaceId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** 채널 + 영상 + 댓글 전부 삭제 (등록 해제용) */
export async function deleteChannelData(channelId: string): Promise<void> {
  const userId = await getCurrentUserId();
  await supabase.from('youtube_comments').delete().eq('user_id', userId).eq('channel_id', channelId);
  await supabase.from('youtube_videos').delete().eq('user_id', userId).eq('channel_id', channelId);
  await supabase.from('youtube_channels').delete().eq('user_id', userId).eq('channel_id', channelId);
}

// ── 영상 ──

export async function fetchVideos(workspaceId?: string): Promise<YoutubeVideoRow[]> {
  const userId = await getCurrentUserId();
  let q = supabase.from('youtube_videos').select('*').eq('user_id', userId);
  q = workspaceId ? q.eq('workspace_id', workspaceId) : q.is('workspace_id', null);
  const { data, error } = await q.order('published_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function insertVideos(channelId: string, videos: {
  videoId: string; title: string; thumbnail?: string; publishedAt: string;
  viewCount?: number; likeCount?: number; commentCount?: number;
}[], workspaceId?: string): Promise<YoutubeVideoRow[]> {
  if (videos.length === 0) return [];
  const userId = await getCurrentUserId();
  const rows = videos.map((v) => ({
    user_id: userId, channel_id: channelId, video_id: v.videoId, title: v.title,
    thumbnail: v.thumbnail ?? null, published_at: v.publishedAt,
    view_count: v.viewCount ?? null, like_count: v.likeCount ?? null, comment_count: v.commentCount ?? null,
    workspace_id: workspaceId ?? null,
  }));
  const { data, error } = await supabase.from('youtube_videos').insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

export async function insertComments(comments: {
  commentId: string; videoId: string; channelId: string; author: string;
  authorThumbnail?: string; text: string; publishedAt: string; likeCount?: number;
  replyStatus?: YoutubeReplyStatus; replyDraft?: string; repliedAt?: string;
  replies?: YoutubeCommentReply[]; replyCount?: number;
}[], workspaceId?: string): Promise<YoutubeCommentRow[]> {
  if (comments.length === 0) return [];
  const userId = await getCurrentUserId();
  const rows = comments.map((c) => ({
    user_id: userId, comment_id: c.commentId, video_id: c.videoId, channel_id: c.channelId,
    author: c.author, author_thumbnail: c.authorThumbnail ?? null, text: c.text,
    published_at: c.publishedAt, like_count: c.likeCount ?? null,
    // 수집 시 감지된 답글 상태/내용 보존 (예전엔 'none' 하드코딩 → 죄다 미답글 버그)
    reply_status: c.replyStatus ?? 'none',
    reply_draft: c.replyDraft ?? null,
    replied_at: c.repliedAt ?? null,
    replies: c.replies ?? null,
    reply_count: c.replyCount ?? null,
    workspace_id: workspaceId ?? null,
  }));
  const { data, error } = await supabase.from('youtube_comments').insert(rows).select();
  if (error) throw error;
  return data ?? [];
}

export async function updateVideoScript(id: string, script: string): Promise<void> {
  const { error } = await supabase
    .from('youtube_videos')
    .update({ script })
    .eq('id', id);
  if (error) throw error;
}

// ── 댓글 ──

export async function fetchComments(workspaceId?: string): Promise<YoutubeCommentRow[]> {
  const userId = await getCurrentUserId();
  let q = supabase.from('youtube_comments').select('*').eq('user_id', userId);
  q = workspaceId ? q.eq('workspace_id', workspaceId) : q.is('workspace_id', null);
  const { data, error } = await q.order('published_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateComment(id: string, fields: Partial<YoutubeCommentRow>): Promise<void> {
  const { error } = await supabase
    .from('youtube_comments')
    .update(fields)
    .eq('id', id);
  if (error) throw error;
}

/**
 * 답글 발행
 * - 현재: DB 상태만 'published'로 변경 (UI 미리보기/확인 흐름 완성용)
 * - 추후: 여기서 YouTube Data API comments.insert 호출 (Edge Function 경유)
 */
export async function publishReply(id: string, replyText: string): Promise<void> {
  await updateComment(id, {
    reply_status: 'published',
    reply_draft: replyText,
    replied_at: new Date().toISOString(),
  });
}

// ── AI 답글 초안 생성 ──

const REPLY_TONE_RULES = `- 따뜻하고 친근한 말투, 시청자에게 감사를 표현
- 2~3문장 이내로 간결하게
- 이모지는 1개 정도만 자연스럽게
- 답글 본문만 출력 (따옴표나 "답글:" 같은 접두사 없이)`;

/** Claude 단발 호출 */
async function callClaude(prompt: string, maxTokens = 1024): Promise<string> {
  const res = await fetch('/api/claude/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Claude API 호출 실패');
  }
  const data = await res.json();
  return (data.content?.[0]?.text || '').trim();
}

/** Perplexity로 사실 리서치 (인라인 출처 마커 제거, 본문만) */
async function research(query: string): Promise<string> {
  const res = await fetch('/api/perplexity/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_PERPLEXITY_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      max_tokens: 700,
      messages: [
        { role: 'system', content: '질문에 대해 최신 정보 기준으로 사실만 간결하게 정리해줘. 한국 기준이 적절하면 한국 기준으로.' },
        { role: 'user', content: query },
      ],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Perplexity API 호출 실패');
  }
  const data = await res.json();
  const content: string = data.choices?.[0]?.message?.content || '';
  return content.replace(/\[(\d+)\]/g, '').replace(/ {2,}/g, ' ').trim();
}

export interface ReplyDraftResult {
  text: string;
  usedResearch: boolean;
}

/**
 * 댓글 답글 초안 생성 (스크립트 기반 + 필요 시 자동 리서치)
 * 1) 영상 스크립트 + 댓글을 Claude에 주고, 스크립트/상식으로 답 가능하면 바로 답글 작성
 * 2) 최신 사실·정책·법률 등 외부 확인이 필요하면 Claude가 NEEDS_RESEARCH 신호 → Perplexity 리서치 → 그 결과로 재작성
 */
export async function generateReplyDraft(
  commentText: string,
  videoTitle: string,
  channelTitle: string,
  opts?: { script?: string },
): Promise<ReplyDraftResult> {
  const script = opts?.script?.trim();
  const scriptBlock = script
    ? `영상 스크립트(자막):\n"""\n${script}\n"""`
    : '영상 스크립트: (없음)';

  // 1단계: 답변 or 리서치 판단
  const decisionPrompt = `너는 유튜브 채널 "${channelTitle}"의 운영자야. 시청자 댓글에 직접 답글을 다는 상황이야.

영상 제목: ${videoTitle}
${scriptBlock}
시청자 댓글: "${commentText}"

판단 규칙:
- 댓글 내용이 위 스크립트 내용이나 일반 상식으로 충분히 답할 수 있으면, 바로 답글 본문을 작성해.
- 댓글이 최신 사실/정책/법률/제도/"아직도 ~인가요?" 처럼 시점에 따라 달라지고 네가 확신할 수 없는 내용을 묻는다면, 추측하지 말고 정확히 아래 형식 한 줄만 출력해:
NEEDS_RESEARCH: <검색에 쓸 질의문>

답글 작성 규칙:
${REPLY_TONE_RULES}`;

  const first = await callClaude(decisionPrompt);

  if (first.startsWith('NEEDS_RESEARCH:')) {
    const query = first.slice('NEEDS_RESEARCH:'.length).trim() || commentText;
    const findings = await research(query);

    const composePrompt = `너는 유튜브 채널 "${channelTitle}"의 운영자야. 아래 리서치 결과를 사실 근거로 삼아 시청자 댓글에 답글을 작성해.

영상 제목: ${videoTitle}
시청자 댓글: "${commentText}"

리서치 결과(사실 근거):
"""
${findings}
"""

답글 작성 규칙:
- 위 리서치 결과의 사실만 사용하고, 없는 내용을 지어내지 마
- 단정하기 애매하면 "최근 기준으로는 ~" 처럼 표현
${REPLY_TONE_RULES}`;

    const final = await callClaude(composePrompt);
    return { text: final, usedResearch: true };
  }

  return { text: first, usedResearch: false };
}
