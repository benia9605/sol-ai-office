/**
 * @file src/components/ChatModal.tsx
 * @description AI 채팅 모달 컴포넌트
 * - 모바일: 전체 화면 (풀스크린) / PC: 중앙 오버레이
 * - 헤더: 캐릭터 이미지 + 방 이름 + AI 이름/모델 + 📝 요약 저장 버튼
 * - 채팅 영역: MessageBubble 사용 (hover ⋯ 메뉴 포함)
 * - 입력 영역: 텍스트 입력 + Enter 전송
 * - 저장 메뉴 선택 시 SaveModal 표시 → Supabase에 실제 저장
 */
import { useState, useRef, useEffect } from 'react';
import { Room, ChatMessage, SaveType, SaveModalConfig, SaveData } from '../types';
import { MessageBubble, formatDateSeparator, isSameDay } from './MessageBubble';
import { SaveModal } from './SaveModal';
import { useInsights } from '../hooks/useInsights';
import { useTasks } from '../hooks/useTasks';
import { useChat } from '../hooks/useChat';
import { createConversation, addMessage } from '../services/conversations.service';
import { summarizeAllRooms, SummaryResult } from '../services/summary.service';
import { MEETING_PARTICIPANTS } from '../services/meeting.service';

/** 방별 아이콘 컬러 (각 방 파스텔 톤의 진한 버전) */
const roomIconColor: Record<string, string> = {
  strategy: '#9333ea',   // purple
  marketing: '#ec4899',  // pink
  dev: '#65a30d',        // lime
  research: '#b07a4b',   // brown
  meeting: '#ca8a04',    // yellow
  secretary: '#ca8a04',  // yellow
};

/** AI 이름 → 출처 ID 매핑 */
const aiNameToSourceId: Record<string, string> = {
  '플래니': 'plani', '마키': 'maki', '데비': 'devi', '서치': 'searchi', '모디': 'modi',
};

interface ChatModalProps {
  room: Room;
  onClose: () => void;
}

export function ChatModal({ room, onClose }: ChatModalProps) {
  const { messages, setMessages, loading, sendMessage: sendChatMsg, meetingPhase } = useChat({ roomId: room.id });
  const isMeeting = room.id === 'meeting';
  const [input, setInput] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    MEETING_PARTICIPANTS.map(p => p.roomId)
  );
  const [saveModal, setSaveModal] = useState<SaveModalConfig | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { add: addInsight } = useInsights();
  const { add: addTask } = useTasks();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 저장 성공 메시지 자동 숨김
  useEffect(() => {
    if (saveSuccess) {
      const timer = setTimeout(() => setSaveSuccess(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [saveSuccess]);

  const toggleParticipant = (roomId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const text = input;
    setInput('');
    sendChatMsg(text, isMeeting ? selectedParticipants : undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveRequest = (type: SaveType, message: ChatMessage) => {
    setSaveModal({ type, message, room });
  };

  /** AI 대화 컨텍스트를 DB에 저장하고 conversation_id 반환 */
  const saveConversationContext = async (sourceMessage: ChatMessage): Promise<string | undefined> => {
    try {
      const conv = await createConversation(room.id, `${room.aiName} 대화`);
      // 저장 대상 메시지의 앞뒤 컨텍스트 포함 (최대 5개)
      const msgIdx = messages.findIndex((m) => m.id === sourceMessage.id);
      const start = Math.max(0, msgIdx - 2);
      const end = Math.min(messages.length, msgIdx + 3);
      const contextMsgs = messages.slice(start, end);
      for (const m of contextMsgs) {
        await addMessage(
          conv.id,
          m.sender === 'ai' ? 'assistant' : 'user',
          m.content,
          m.sender === 'ai' ? room.aiName : undefined,
        );
      }
      return conv.id;
    } catch (e) {
      console.warn('[ChatModal] 대화 컨텍스트 저장 실패:', e);
      return undefined;
    }
  };

  const handleSaveConfirm = async (data: SaveData) => {
    try {
      if (saveModal?.type === 'task') {
        const conversationId = await saveConversationContext(saveModal.message);
        await addTask({
          title: data.title,
          project: data.project || undefined,
          priority: data.priority || 'medium',
          date: data.date,
          category: data.category,
          notes: data.notes,
          repeat: data.repeat,
          tags: data.tags.length > 0 ? data.tags : undefined,
          conversation_id: conversationId,
          goalId: data.goalId,
        });
        setSaveSuccess('할일이 저장되었습니다');
      } else if (saveModal?.type === 'insight') {
        await addInsight({
          title: data.title,
          content: data.content,
          source: data.source || aiNameToSourceId[room.aiName] || 'thought',
          link: data.link,
          tags: data.tags,
          createdAt: data.date || new Date().toISOString().slice(0, 10),
          time: data.time || new Date().toTimeString().slice(0, 5),
          project: data.project || undefined,
          priority: data.priority,
        });
        setSaveSuccess('인사이트가 저장되었습니다');
      }
    } catch (e) {
      console.error('[ChatModal] 저장 실패:', e);
      setSaveSuccess('저장에 실패했습니다');
    }
    setSaveModal(null);
  };

  const handleStar = (message: ChatMessage) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id ? { ...m, isStarred: !m.isStarred } : m
      )
    );
  };

  // 모디방 전체 요약 상태
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryResult, setSummaryResult] = useState<string | null>(null);

  const handleSaveSummary = async () => {
    if (room.id !== 'secretary') return;

    setIsSummarizing(true);
    setSummaryResult(null);

    try {
      const results: SummaryResult[] = await summarizeAllRooms();
      const successCount = results.filter(r => r.status === 'success').length;
      const skippedCount = results.filter(r => r.status === 'skipped').length;

      if (successCount > 0) {
        setSummaryResult(`${successCount}개 방 요약 완료, ${skippedCount}개 방 대화 없음`);
      } else {
        setSummaryResult('오늘 대화가 없습니다');
      }
    } catch {
      setSummaryResult('요약 저장 실패');
    } finally {
      setIsSummarizing(false);
    }
  };

  // 요약 결과 자동 숨김
  useEffect(() => {
    if (summaryResult) {
      const timer = setTimeout(() => setSummaryResult(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [summaryResult]);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white sm:rounded-3xl shadow-hover w-full h-full sm:max-w-2xl sm:h-[600px] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className={`${room.color} px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-3">
            <img
              src={room.image}
              alt={room.aiName}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover"
            />
            <div>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">{room.name}</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                {isMeeting ? '💜 플래니 · 💗 마키 · 🤎 데비 · 💚 서치 · 💛 모디' : `${room.aiName} · ${room.aiModel}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {room.id === 'secretary' && (
              <button
                onClick={handleSaveSummary}
                disabled={isSummarizing}
                className="px-3 py-1.5 text-xs sm:text-sm bg-white/60 hover:bg-white
                  rounded-xl transition-colors text-gray-600 hover:text-gray-800 font-medium
                  flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg className="w-4 h-4" style={{ color: roomIconColor[room.id] || '#a855f7' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                {isSummarizing ? '요약 중...' : '오늘 요약'}
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/60 hover:bg-white
                transition-colors flex items-center justify-center text-gray-600 hover:text-gray-800"
            >
              ✕
            </button>
          </div>
        </div>

        {/* 참가자 선택 (회의실만) */}
        {isMeeting && (
          <div className="px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
            <p className="text-[11px] text-gray-400 mb-2 font-medium">회의 참가자 선택</p>
            <div className="flex flex-wrap gap-1.5">
              {MEETING_PARTICIPANTS.map(p => {
                const isSelected = selectedParticipants.includes(p.roomId);
                return (
                  <button
                    key={p.roomId}
                    onClick={() => toggleParticipant(p.roomId)}
                    disabled={loading}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs transition-all
                      ${isSelected
                        ? 'bg-gray-800 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                      } disabled:opacity-50`}
                  >
                    <img src={p.image} alt={p.name} className="w-4 h-4 rounded-full object-cover" />
                    <span className="font-medium">{p.name}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>
                      {p.focus.split(',')[0]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 채팅 영역 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50 relative">
          {messages.map((msg, idx) => {
            const prev = idx > 0 ? messages[idx - 1] : null;
            const showDateSep = !prev || !isSameDay(prev.timestamp, msg.timestamp);
            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 border-t border-gray-200" />
                    <span className="text-[11px] text-gray-300 whitespace-nowrap">
                      {formatDateSeparator(msg.timestamp)}
                    </span>
                    <div className="flex-1 border-t border-gray-200" />
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  room={room}
                  onSave={handleSaveRequest}
                  onStar={handleStar}
                />
              </div>
            );
          })}
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2">
              <img
                src={meetingPhase?.image || room.image}
                alt={meetingPhase?.name || room.aiName}
                className="w-7 h-7 rounded-full object-cover"
              />
              {meetingPhase ? (
                <span className="text-xs text-gray-500 animate-pulse">
                  {meetingPhase.emoji} {meetingPhase.name}가 의견을 정리하고 있어요...
                </span>
              ) : (
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          )}
          <div ref={chatEndRef} />

          {/* 토스트 메시지 */}
          {(saveSuccess || summaryResult) && (
            <div className="sticky bottom-2 flex justify-center pointer-events-none">
              <div className="bg-gray-800 text-white text-xs px-4 py-2 rounded-full shadow-lg animate-in fade-in">
                {saveSuccess || summaryResult}
              </div>
            </div>
          )}
        </div>

        {/* 입력 영역 */}
        <div className="p-3 sm:p-4 bg-white border-t border-gray-100 flex-shrink-0">
          <div className="flex gap-2 sm:gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isMeeting ? '회의 주제를 입력해주세요...' : `${room.aiName}에게 메시지 보내기...`}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-100 rounded-2xl text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="px-4 sm:px-6 py-2.5 sm:py-3 bg-primary-500 text-white rounded-2xl font-medium text-sm
                hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors"
            >
              {loading ? '...' : '전송'}
            </button>
          </div>
        </div>
      </div>

      {/* 저장 모달 */}
      {saveModal && (
        <SaveModal
          config={saveModal}
          onSave={handleSaveConfirm}
          onClose={() => setSaveModal(null)}
        />
      )}
    </div>
  );
}
