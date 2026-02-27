/**
 * @file src/components/Sidebar.tsx
 * @description 대화 히스토리 사이드바 컴포넌트
 * - PC: 좌측에 고정된 사이드바로 과거 대화 목록 표시
 * - 모바일: 슬라이드 인 오버레이로 표시, 닫기 버튼 포함
 * - 각 항목: 캐릭터 이미지 + 방 이름 + 마지막 메시지 미리보기 + 날짜
 * - 항목 클릭 시 해당 방의 ChatModal 열기 (onSelectHistory 콜백)
 * - formatDate(): 오늘/어제/N일 전/날짜 형태로 상대 시간 표시
 */
import { ChatHistory } from '../types';

interface SidebarProps {
  history: ChatHistory[];
  onSelectHistory: (history: ChatHistory) => void;
  onClose?: () => void;
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

export function Sidebar({ history, onSelectHistory, onClose }: SidebarProps) {
  return (
    <aside className="w-full h-full bg-white/95 lg:bg-white/80 backdrop-blur-sm rounded-3xl shadow-soft p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4 px-2">
        <h2 className="text-lg font-bold text-gray-800">
          💬 대화 히스토리
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200
              flex items-center justify-center text-gray-500 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {history.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectHistory(item)}
            className="w-full p-3 rounded-2xl hover:bg-pastel-purple/50
              transition-colors duration-200 text-left group"
          >
            <div className="flex items-center gap-2 mb-1">
              <img
                src={item.roomImage}
                alt={item.roomName}
                className="w-7 h-7 rounded-full object-cover"
              />
              <span className="font-medium text-gray-800 text-sm">
                {item.roomName}
              </span>
              <span className="ml-auto text-xs text-gray-400">
                {formatDate(item.timestamp)}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate pl-9">
              {item.lastMessage}
            </p>
          </button>
        ))}
      </div>
    </aside>
  );
}
