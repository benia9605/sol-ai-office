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
  is_starred?: boolean;
  created_at: string;
}

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
      user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
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
