import { useState } from 'react';
import { Room, ChatMessage } from '../types';
import { getDummyResponse } from '../data';

interface ChatModalProps {
  room: Room;
  onClose: () => void;
}

export function ChatModal({ room, onClose }: ChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      roomId: room.id,
      sender: 'ai',
      content: getDummyResponse(room.aiName),
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      roomId: room.id,
      sender: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    // 더미 AI 응답
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        roomId: room.id,
        sender: 'ai',
        content: `네, 말씀하신 "${input}"에 대해 생각해볼게요.\n\n${room.aiName}로서 ${room.personality} 관점에서 답변드리자면...\n\n(아직 API가 연동되지 않아 더미 응답입니다!)`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-hover w-full max-w-2xl h-[600px] flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className={`${room.color} px-6 py-4 flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{room.emoji}</span>
            <div>
              <h3 className="font-bold text-gray-800">{room.name}</h3>
              <p className="text-sm text-gray-600">
                {room.aiName} · {room.aiModel}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/60 hover:bg-white
              transition-colors flex items-center justify-center text-gray-600 hover:text-gray-800"
          >
            ✕
          </button>
        </div>

        {/* 채팅 영역 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl whitespace-pre-wrap ${
                  msg.sender === 'user'
                    ? 'bg-primary-500 text-white rounded-br-md'
                    : 'bg-white shadow-soft rounded-bl-md'
                }`}
              >
                {msg.sender === 'ai' && (
                  <p className="text-xs text-primary-500 font-medium mb-1">
                    {room.aiName}
                  </p>
                )}
                <p className={`text-sm ${msg.sender === 'user' ? 'text-white' : 'text-gray-700'}`}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* 입력 영역 */}
        <div className="p-4 bg-white border-t border-gray-100">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`${room.aiName}에게 메시지 보내기...`}
              className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl text-sm
                focus:outline-none focus:ring-2 focus:ring-primary-300 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-6 py-3 bg-primary-500 text-white rounded-2xl font-medium
                hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors"
            >
              전송
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
