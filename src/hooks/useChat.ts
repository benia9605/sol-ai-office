/**
 * @file src/hooks/useChat.ts
 * @description AI 채팅 훅
 * - 시스템 프롬프트 빌드 (기본 프롬프트 + 동적 컨텍스트)
 * - Claude API 호출
 * - 메시지 DB 저장
 * - 대화 히스토리 관리
 * - 회의실 멀티 AI 순차 토론 지원
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { buildSystemPrompt, getAIName } from '../services/context';
import { sendChatMessage, ChatMessage as ApiMessage } from '../services/chatApi';
import { createConversation, addMessage, fetchLatestConversationForRoom, fetchMessagesByConversation } from '../services/conversations.service';
import {
  MEETING_PARTICIPANTS,
  MODI_INFO,
  buildModiOpeningPrompt,
  buildParticipantPrompt,
  buildModiClosingPrompt,
} from '../services/meeting.service';

/** 회의 진행 단계 */
export interface MeetingPhase {
  name: string;
  image: string;
  emoji: string;
}

interface UseChatOptions {
  roomId: string;
}

export function useChat({ roomId }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [meetingPhase, setMeetingPhase] = useState<MeetingPhase | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const aiName = getAIName(roomId);

  /** 방 입장 시 이전 대화 불러오기 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const conv = await fetchLatestConversationForRoom(roomId);
        if (cancelled || !conv) { setHistoryLoaded(true); return; }
        const rows = await fetchMessagesByConversation(conv.id);
        if (cancelled) return;
        if (rows.length > 0) {
          conversationIdRef.current = conv.id;
          setMessages(rows.map((r) => ({
            id: r.id,
            roomId,
            sender: r.role === 'assistant' ? 'ai' : 'user',
            content: r.content,
            timestamp: new Date(r.created_at),
            isStarred: r.is_starred || false,
            aiName: r.ai_name || undefined,
          })));
        }
      } catch (e) {
        console.warn('[useChat] 이전 대화 로드 실패:', e);
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [roomId]);

  /** 대화 세션 생성 (필요시) */
  const ensureConversation = useCallback(async (): Promise<string> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    const title = roomId === 'meeting' ? '회의실 토론' : `${aiName} 대화`;
    const conv = await createConversation(roomId, title);
    conversationIdRef.current = conv.id;
    return conv.id;
  }, [roomId, aiName]);

  /** AI 메시지를 state + DB에 추가하는 헬퍼 */
  const addAIMessage = useCallback(async (
    convId: string,
    content: string,
    name: string,
    image?: string,
  ) => {
    const msg: ChatMessage = {
      id: (Date.now() + Math.random()).toString(),
      roomId,
      sender: 'ai',
      content,
      timestamp: new Date(),
      aiName: name,
      aiImage: image,
    };
    setMessages(prev => [...prev, msg]);
    await addMessage(convId, 'assistant', content, name);
    return msg;
  }, [roomId]);

  /** 회의실 멀티 AI 토론 */
  const sendMeetingMessage = useCallback(async (content: string, convId: string) => {
    // 이전 발언 누적용
    const responses: { name: string; content: string }[] = [];

    // 1. 모디 시작 멘트
    setMeetingPhase({ name: MODI_INFO.name, image: MODI_INFO.image, emoji: MODI_INFO.emoji });
    const openingPrompt = await buildModiOpeningPrompt(content);
    const opening = await sendChatMessage(openingPrompt, [{ role: 'user', content }], 'meeting', 300);
    await addAIMessage(convId, opening, MODI_INFO.name, MODI_INFO.image);

    // 2. 4명 AI 순차 발언
    for (const participant of MEETING_PARTICIPANTS) {
      setMeetingPhase({ name: participant.name, image: participant.image, emoji: participant.emoji });

      const prompt = await buildParticipantPrompt(participant, content, responses);

      // 이전 발언을 API messages로 구성
      const apiMessages: ApiMessage[] = [
        { role: 'user', content },
        ...responses.map(r => ({
          role: 'assistant' as const,
          content: `[${r.name}의 의견]\n${r.content}`,
        })),
      ];

      const response = await sendChatMessage(prompt, apiMessages, participant.roomId, 600);
      await addAIMessage(convId, response, participant.name, participant.image);
      responses.push({ name: participant.name, content: response });
    }

    // 3. 모디 정리
    setMeetingPhase({ name: MODI_INFO.name, image: MODI_INFO.image, emoji: MODI_INFO.emoji });
    const closingPrompt = await buildModiClosingPrompt(content, responses);
    const apiMessagesForClosing: ApiMessage[] = [
      { role: 'user', content },
      ...responses.map(r => ({
        role: 'assistant' as const,
        content: `[${r.name}의 의견]\n${r.content}`,
      })),
    ];
    const closing = await sendChatMessage(closingPrompt, apiMessagesForClosing, 'meeting', 1000);
    await addAIMessage(convId, closing, MODI_INFO.name, MODI_INFO.image);

    setMeetingPhase(null);
  }, [addAIMessage]);

  /** 일반 1:1 채팅 */
  const sendNormalMessage = useCallback(async (_content: string, convId: string, userMsg: ChatMessage) => {
    const systemPrompt = await buildSystemPrompt(roomId);

    const apiMessages: ApiMessage[] = [...messages, userMsg]
      .slice(-20)
      .map(m => ({
        role: (m.sender === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await sendChatMessage(systemPrompt, apiMessages, roomId);

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      roomId,
      sender: 'ai',
      content: response,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, aiMsg]);
    await addMessage(convId, 'assistant', response, aiName);
  }, [roomId, aiName, messages]);

  /** 메시지 전송 (일반/회의 자동 분기) */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || loading) return;

    setLoading(true);
    setError(null);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      roomId,
      sender: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      const convId = await ensureConversation();
      await addMessage(convId, 'user', content);

      if (roomId === 'meeting') {
        await sendMeetingMessage(content, convId);
      } else {
        await sendNormalMessage(content, convId, userMsg);
      }

      window.dispatchEvent(new CustomEvent('conversation-updated'));
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : 'AI 응답 생성 실패';
      setError(errMsg);
      console.error('[useChat] 오류:', e);

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        roomId,
        sender: 'ai',
        content: `⚠️ 오류가 발생했어요: ${errMsg}\n\n다시 시도해주세요.`,
        timestamp: new Date(),
        aiName: roomId === 'meeting' ? '모디' : undefined,
        aiImage: roomId === 'meeting' ? MODI_INFO.image : undefined,
      }]);
    } finally {
      setLoading(false);
      setMeetingPhase(null);
    }
  }, [roomId, loading, ensureConversation, sendMeetingMessage, sendNormalMessage]);

  /** 메시지 초기화 (새 대화) */
  const resetChat = useCallback(() => {
    setMessages([]);
    conversationIdRef.current = null;
    setError(null);
    setMeetingPhase(null);
  }, []);

  return {
    messages,
    setMessages,
    loading,
    error,
    historyLoaded,
    sendMessage,
    resetChat,
    conversationId: conversationIdRef.current,
    meetingPhase,
  };
}
