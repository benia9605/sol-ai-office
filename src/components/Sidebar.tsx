import { ChatHistory } from '../types';

interface SidebarProps {
  history: ChatHistory[];
  onSelectHistory: (history: ChatHistory) => void;
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

export function Sidebar({ history, onSelectHistory }: SidebarProps) {
  return (
    <aside className="w-72 bg-white/80 backdrop-blur-sm rounded-3xl shadow-soft p-4 flex flex-col h-full">
      <h2 className="text-lg font-bold text-gray-800 mb-4 px-2">
        💬 대화 히스토리
      </h2>
      <div className="flex-1 overflow-y-auto space-y-2">
        {history.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectHistory(item)}
            className="w-full p-3 rounded-2xl hover:bg-pastel-purple/50
              transition-colors duration-200 text-left group"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{item.roomEmoji}</span>
              <span className="font-medium text-gray-800 text-sm">
                {item.roomName}
              </span>
              <span className="ml-auto text-xs text-gray-400">
                {formatDate(item.timestamp)}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate pl-7">
              {item.lastMessage}
            </p>
          </button>
        ))}
      </div>
    </aside>
  );
}
