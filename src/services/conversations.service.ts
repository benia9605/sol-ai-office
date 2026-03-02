/**
 * @file src/services/conversations.service.ts
 * @description 대화(conversations) + 메시지(messages) 서비스
 * - AI 채팅에서 할일/인사이트 저장 시 대화 컨텍스트 보존
 * - conversation 생성 → message 삽입 → conversation_id 반환
 */
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';

export interface ConversationRow {
  id: string;
  room_id: string;
  title?: string;
  created_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  role: string;       // 'user' | 'assistant'
  content: string;
  ai_name?: string;
  ai_model?: string;
  is_starred?: boolean;
  created_at: string;
}

/** AI 이름 → 모델명 자동 매핑 */
const AI_MODEL_MAP: Record<string, string> = {
  '플래니': 'claude-sonnet-4-20250514',
  '데비':   'claude-opus-4-20250514',
  '모디':   'claude-sonnet-4-20250514',
  '마키':   'gpt-4o',
  '서치':   'sonar-pro',
};

/** 대화 생성 */
export async function createConversation(roomId: string, title?: string): Promise<ConversationRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('conversations')
    .insert({ room_id: roomId, title: title || null, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** 메시지 추가 */
export async function addMessage(
  conversationId: string,
  role: string,
  content: string,
  aiName?: string,
): Promise<MessageRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      role,
      content,
      ai_name: aiName || null,
      ai_model: aiName ? (AI_MODEL_MAP[aiName] || null) : null,
      user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** 최근 대화 목록 (마지막 메시지 포함) */
export interface RecentConversation {
  id: string;
  room_id: string;
  created_at: string;
  last_message: string;
  last_role: string;
}

export async function fetchRecentConversations(limit = 5): Promise<RecentConversation[]> {
  const userId = await getCurrentUserId();

  const { data: conversations, error } = await supabase
    .from('conversations')
    .select('id, room_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !conversations?.length) return [];

  const results = await Promise.all(
    conversations.map(async (conv) => {
      const { data: messages } = await supabase
        .from('messages')
        .select('content, role')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1);

      return {
        id: conv.id,
        room_id: conv.room_id,
        created_at: conv.created_at,
        last_message: messages?.[0]?.content || '',
        last_role: messages?.[0]?.role || 'user',
      };
    })
  );

  return results.filter(r => r.last_message);
}

/** 특정 방의 최근 대화 ID 조회 */
export async function fetchLatestConversationForRoom(roomId: string): Promise<ConversationRow | null> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from('conversations')
    .select('id, room_id, title, created_at')
    .eq('user_id', userId)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return data;
}

/** 대화 ID로 메시지 조회 */
export async function fetchMessagesByConversation(conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}
