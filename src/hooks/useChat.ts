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
import { extractActionItems } from '../utils/actionExtractor';
import {
  MEETING_PARTICIPANTS,
  MODI_INFO,
  buildModiOpeningPrompt,
  buildParticipantPrompt,
  buildModiClosingPrompt,
  buildModiRouterPrompt,
  buildFollowUpParticipantPrompt,
  parseRoutedParticipants,
} from '../services/meeting.service';

/** AI 이름 → 프로필 이미지 매핑 (DB 복원용) */
const AI_IMAGE_MAP: Record<string, string> = {
  '플래니': '/images/plani.png',
  '마키':   '/images/maki.png',
  '데비':   '/images/devi.png',
  '서치':   '/images/searchi.png',
  '모디':   '/images/modi.png',
};

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
  const meetingRoundDone = useRef(false);
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
          // 회의실: 이전 대화가 있으면 후속 모드로 전환
          if (roomId === 'meeting' && rows.some(r => r.ai_name)) {
            meetingRoundDone.current = true;
          }
          setMessages(rows.map((r) => ({
            id: r.id,
            roomId,
            sender: r.role === 'assistant' ? 'ai' : 'user',
            content: r.content,
            timestamp: new Date(r.created_at),
            isStarred: r.is_starred || false,
            isSystem: r.ai_name === '__system__',
            aiName: r.ai_name === '__system__' ? undefined : (r.ai_name || undefined),
            aiImage: r.ai_name === '__system__' ? undefined : (r.ai_name ? AI_IMAGE_MAP[r.ai_name] : undefined),
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
    const actions = extractActionItems(content);
    const msg: ChatMessage = {
      id: (Date.now() + Math.random()).toString(),
      roomId,
      sender: 'ai',
      content,
      timestamp: new Date(),
      aiName: name,
      aiImage: image,
      extractedActions: actions.length > 0 ? actions : undefined,
    };
    setMessages(prev => [...prev, msg]);
    await addMessage(convId, 'assistant', content, name);
    return msg;
  }, [roomId]);

  /** 회의실 멀티 AI 토론 */
  const sendMeetingMessage = useCallback(async (content: string, convId: string, selectedParticipants?: string[]) => {
    // 선택된 참가자만 필터 (미선택 시 전원 참가)
    const participants = selectedParticipants
      ? MEETING_PARTICIPANTS.filter(p => selectedParticipants.includes(p.roomId))
      : MEETING_PARTICIPANTS;

    // 이전 발언 누적용
    const responses: { name: string; content: string }[] = [];

    // 1. 모디 시작 멘트
    setMeetingPhase({ name: MODI_INFO.name, image: MODI_INFO.image, emoji: MODI_INFO.emoji });
    const openingPrompt = await buildModiOpeningPrompt(content);
    const opening = await sendChatMessage(openingPrompt, [{ role: 'user', content }], 'meeting', 100);
    await addAIMessage(convId, opening, MODI_INFO.name, MODI_INFO.image);

    // 2. 선택된 AI 순차 발언 (한 AI 실패해도 나머지 계속 진행)
    for (const participant of participants) {
      setMeetingPhase({ name: participant.name, image: participant.image, emoji: participant.emoji });

      try {
        const prompt = await buildParticipantPrompt(participant, content, responses);

        const apiMessages: ApiMessage[] = [
          { role: 'user', content },
          ...(responses.length > 0 ? [
            {
              role: 'assistant' as const,
              content: responses.map(r => `[${r.name}의 의견]\n${r.content}`).join('\n\n'),
            },
            {
              role: 'user' as const,
              content: `위 팀원들의 의견을 참고하여, ${participant.name}의 관점에서 의견을 주세요.`,
            },
          ] : []),
        ];

        const response = await sendChatMessage(prompt, apiMessages, participant.roomId, 600);
        await addAIMessage(convId, response, participant.name, participant.image);
        responses.push({ name: participant.name, content: response });
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'API 호출 실패';
        console.warn(`[meeting] ${participant.name} 응답 실패:`, errMsg);
        const fallbackMsg = `⚠️ ${participant.name}의 의견을 가져오지 못했어요. (${errMsg})\n\n다음 팀원에게 넘어갈게요.`;
        await addAIMessage(convId, fallbackMsg, participant.name, participant.image);
      }
    }

    // 3. 모디 정리
    setMeetingPhase({ name: MODI_INFO.name, image: MODI_INFO.image, emoji: MODI_INFO.emoji });
    const closingPrompt = await buildModiClosingPrompt(content, responses);
    const apiMessagesForClosing: ApiMessage[] = [
      { role: 'user', content },
      ...(responses.length > 0 ? [
        {
          role: 'assistant' as const,
          content: responses.map(r => `[${r.name}의 의견]\n${r.content}`).join('\n\n'),
        },
        {
          role: 'user' as const,
          content: '전체 의견을 종합하여 회의를 정리해주세요.',
        },
      ] : []),
    ];
    const closing = await sendChatMessage(closingPrompt, apiMessagesForClosing, 'meeting', 2048);
    await addAIMessage(convId, closing, MODI_INFO.name, MODI_INFO.image);

    setMeetingPhase(null);
  }, [addAIMessage]);

  /** 회의실 후속 질문 (모디 라우터 → 관련 AI만 답변) */
  const sendMeetingFollowUp = useCallback(async (content: string, convId: string, selectedParticipants?: string[]) => {
    // 이전 대화 히스토리 빌드
    const history = messages
      .slice(-20)
      .map(m => m.sender === 'user' ? `[Sol님] ${m.content}` : `[${m.aiName || 'AI'}] ${m.content}`)
      .join('\n\n');

    // 1. 모디 라우팅
    setMeetingPhase({ name: MODI_INFO.name, image: MODI_INFO.image, emoji: MODI_INFO.emoji });
    const routerPrompt = await buildModiRouterPrompt(content, history);
    const routerResponse = await sendChatMessage(routerPrompt, [{ role: 'user', content }], 'meeting', 150);
    await addAIMessage(convId, routerResponse, MODI_INFO.name, MODI_INFO.image);

    // 2. 라우팅된 AI 파싱 + 선택된 참가자와 교집합
    let routed = parseRoutedParticipants(routerResponse);
    if (selectedParticipants) {
      routed = routed.filter(p => selectedParticipants.includes(p.roomId));
      if (routed.length === 0) routed = parseRoutedParticipants(routerResponse);
    }

    // 3. 관련 AI만 답변
    for (const participant of routed) {
      setMeetingPhase({ name: participant.name, image: participant.image, emoji: participant.emoji });

      try {
        const prompt = await buildFollowUpParticipantPrompt(participant, content, history);
        const response = await sendChatMessage(prompt, [{ role: 'user', content }], participant.roomId, 600);
        await addAIMessage(convId, response, participant.name, participant.image);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'API 호출 실패';
        console.warn(`[meeting-followup] ${participant.name} 응답 실패:`, errMsg);
        const fallbackMsg = `⚠️ ${participant.name}의 의견을 가져오지 못했어요. (${errMsg})`;
        await addAIMessage(convId, fallbackMsg, participant.name, participant.image);
      }
    }

    setMeetingPhase(null);
  }, [messages, addAIMessage]);

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
    const actions = extractActionItems(response);

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      roomId,
      sender: 'ai',
      content: response,
      timestamp: new Date(),
      extractedActions: actions.length > 0 ? actions : undefined,
    };
    setMessages(prev => [...prev, aiMsg]);
    await addMessage(convId, 'assistant', response, aiName);
  }, [roomId, aiName, messages]);

  /** 메시지 전송 (일반/회의 자동 분기) */
  const sendMessage = useCallback(async (content: string, selectedParticipants?: string[]) => {
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
        if (meetingRoundDone.current) {
          await sendMeetingFollowUp(content, convId, selectedParticipants);
        } else {
          await sendMeetingMessage(content, convId, selectedParticipants);
          meetingRoundDone.current = true;
        }
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
  }, [roomId, loading, ensureConversation, sendMeetingMessage, sendMeetingFollowUp, sendNormalMessage]);

  /** 새 회의 시작 (대화 내용 유지, 다음 메시지부터 풀 회의) */
  const startNewMeeting = useCallback(async () => {
    // 기존 대화에 구분선 저장
    if (conversationIdRef.current) {
      await addMessage(conversationIdRef.current, 'assistant', '새 회의', '__system__');
    }
    meetingRoundDone.current = false;
    conversationIdRef.current = null;
    // 구분선 시스템 메시지 삽입
    const separator: ChatMessage = {
      id: `sep-${Date.now()}`,
      roomId,
      sender: 'ai',
      content: '새 회의',
      timestamp: new Date(),
      isSystem: true,
    };
    setMessages(prev => [...prev, separator]);
  }, [roomId]);

  /** 메시지 초기화 (새 대화) */
  const resetChat = useCallback(() => {
    setMessages([]);
    conversationIdRef.current = null;
    meetingRoundDone.current = false;
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
    startNewMeeting,
    conversationId: conversationIdRef.current,
    meetingPhase,
  };
}
