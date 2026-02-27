/**
 * @file src/hooks/useChat.ts
 * @description AI 채팅 훅
 * - 시스템 프롬프트 빌드 (기본 프롬프트 + 동적 컨텍스트)
 * - Claude API 호출
 * - 메시지 DB 저장
 * - 대화 히스토리 관리
 */
import { useState, useCallback, useRef } from 'react';
import { ChatMessage } from '../types';
import { buildSystemPrompt, getAIName } from '../services/context';
import { sendChatMessage, ChatMessage as ApiMessage } from '../services/chatApi';
import { createConversation, addMessage } from '../services/conversations.service';

interface UseChatOptions {
  roomId: string;
}

export function useChat({ roomId }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const aiName = getAIName(roomId);

  /** 대화 세션 생성 (필요시) */
  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    const conv = await createConversation(roomId, `${aiName} 대화`);
    conversationIdRef.current = conv.id;
    return conv.id;
  }, [roomId, aiName]);

  /** 메시지 전송 */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || loading) return;

    setLoading(true);
    setError(null);

    // 1. 유저 메시지 추가
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      roomId,
      sender: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      // 2. DB에 유저 메시지 저장
      const convId = await ensureConversation();
      await addMessage(convId, 'user', content);

      // 3. 시스템 프롬프트 빌드
      const systemPrompt = await buildSystemPrompt(roomId);

      // 4. API용 메시지 히스토리 변환 (최근 20개)
      const apiMessages: ApiMessage[] = [...messages, userMsg]
        .slice(-20)
        .map(m => ({
          role: (m.sender === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: m.content,
        }));

      // 5. AI API 호출 (roomId에 따라 모델 자동 분기)
      const response = await sendChatMessage(systemPrompt, apiMessages, roomId);

      // 6. AI 응답 추가
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        roomId,
        sender: 'ai',
        content: response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);

      // 7. DB에 AI 응답 저장
      await addMessage(convId, 'assistant', response, aiName);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'AI 응답 생성 실패';
      setError(errMsg);
      console.error('[useChat] 오류:', e);

      // 에러 메시지를 AI 응답으로 표시
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        roomId,
        sender: 'ai',
        content: `⚠️ 오류가 발생했어요: ${errMsg}\n\n다시 시도해주세요.`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [roomId, aiName, messages, loading, ensureConversation]);

  /** 메시지 초기화 (새 대화) */
  const resetChat = useCallback(() => {
    setMessages([]);
    conversationIdRef.current = null;
    setError(null);
  }, []);

  return {
    messages,
    setMessages,
    loading,
    error,
    sendMessage,
    resetChat,
    conversationId: conversationIdRef.current,
  };
}
