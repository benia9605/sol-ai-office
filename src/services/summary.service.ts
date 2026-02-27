/**
 * @file src/services/summary.service.ts
 * @description 대화 요약 서비스
 * - 모디방에서 오늘 전체 방 대화를 한번에 요약
 * - conversation_summaries 테이블에 upsert
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import { sendChatMessage, ChatMessage } from './chatApi';

/** 요약 행 타입 */
export interface SummaryRow {
  id: string;
  room_id: string;
  date: string;
  summary: string;
  created_at: string;
}

/** 요약 대상 방 목록 (room_id) */
const SUMMARY_ROOMS = ['strategy', 'marketing', 'dev', 'research', 'secretary'];

/** 방별 라벨 */
export const ROOM_LABELS: Record<string, string> = {
  strategy: '플래니 (전략실)',
  marketing: '마키 (마케팅룸)',
  dev: '데비 (개발실)',
  research: '서치 (리서치랩)',
  secretary: '모디 (비서실)',
};

/** 방별 아이콘 */
export const ROOM_ICONS: Record<string, { emoji: string; color: string; image: string }> = {
  strategy:  { emoji: '💜', color: '#9333ea', image: '/images/plani.png' },
  marketing: { emoji: '💗', color: '#ec4899', image: '/images/maki.png' },
  dev:       { emoji: '🤎', color: '#65a30d', image: '/images/devi.png' },
  research:  { emoji: '💚', color: '#b07a4b', image: '/images/searchi.png' },
  secretary: { emoji: '💛', color: '#ca8a04', image: '/images/modi.png' },
};

/** 저장된 요약 조회 (최근 N일) */
export async function fetchSummaries(days = 30): Promise<SummaryRow[]> {
  const userId = await getCurrentUserId();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('conversation_summaries')
    .select('*')
    .eq('user_id', userId)
    .gte('date', sinceStr)
    .order('date', { ascending: false });

  if (error) {
    console.error('[summary] 요약 조회 실패:', error);
    return [];
  }
  return (data ?? []) as SummaryRow[];
}

export interface SummaryResult {
  roomId: string;
  label: string;
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
  messageCount?: number;
}

/** 1. 특정 방의 오늘 대화 메시지 가져오기 */
async function getTodayMessages(roomId: string) {
  const userId = await getCurrentUserId();
  const today = new Date().toISOString().split('T')[0];

  // 오늘 생성된 대화 세션
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('room_id', roomId)
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`);

  if (!conversations?.length) return [];

  const conversationIds = conversations.map(c => c.id);

  // 해당 대화들의 메시지
  const { data: messages } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .in('conversation_id', conversationIds)
    .order('created_at');

  return messages || [];
}

/** 2. AI에게 요약 요청 (Claude Sonnet - secretary 방 설정 사용) */
async function generateSummary(messages: { role: string; content: string }[]): Promise<string> {
  const conversationText = messages
    .map(m => `${m.role === 'user' ? '유저' : 'AI'}: ${m.content}`)
    .join('\n');

  const systemPrompt = '대화 내용을 요약하는 역할입니다. 간결하고 핵심만 정리해주세요.';

  const apiMessages: ChatMessage[] = [{
    role: 'user',
    content: `다음은 오늘 하루 동안의 대화 내용입니다.
핵심 내용을 3-5문장으로 요약해주세요.
결정된 사항, 논의된 주제, 다음 할 일 위주로 정리해주세요.

대화 내용:
${conversationText}`,
  }];

  return sendChatMessage(systemPrompt, apiMessages, 'secretary', 1024);
}

/** 3. 요약 저장 (upsert - 오늘 날짜 기준) */
async function saveSummary(roomId: string, summary: string) {
  const userId = await getCurrentUserId();
  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('conversation_summaries')
    .select('id')
    .eq('user_id', userId)
    .eq('room_id', roomId)
    .eq('date', today)
    .single();

  if (existing) {
    await supabase
      .from('conversation_summaries')
      .update({ summary, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('conversation_summaries')
      .insert({ room_id: roomId, date: today, summary, user_id: userId });
  }
}

/** 4. 전체 방 요약 실행 */
export async function summarizeAllRooms(): Promise<SummaryResult[]> {
  const results: SummaryResult[] = [];

  for (const roomId of SUMMARY_ROOMS) {
    const label = ROOM_LABELS[roomId] || roomId;

    try {
      // 오늘 대화 가져오기
      const messages = await getTodayMessages(roomId);

      if (messages.length === 0) {
        results.push({ roomId, label, status: 'skipped', reason: '오늘 대화 없음' });
        continue;
      }

      // 요약 생성
      const summary = await generateSummary(messages);

      if (!summary) {
        results.push({ roomId, label, status: 'failed', reason: '요약 생성 실패' });
        continue;
      }

      // 저장
      await saveSummary(roomId, summary);
      results.push({ roomId, label, status: 'success', messageCount: messages.length });
    } catch (e) {
      console.error(`[summary] ${roomId} 요약 실패:`, e);
      results.push({ roomId, label, status: 'failed', reason: '오류 발생' });
    }
  }

  return results;
}
