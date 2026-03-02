/**
 * @file src/components/NewSidebar.tsx
 * @description 3-섹션 사이드바 (메뉴 + 프로젝트 + 히스토리)
 * - 메뉴 섹션: NavLink로 페이지 이동, active 하이라이트
 * - 프로젝트 섹션: 프로젝트 목록 표시
 * - 히스토리 섹션: 최근 대화 3개
 * - 모바일: 오버레이 / PC: 좌측 고정 w-64
 */
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ChatHistory } from '../types';
import { menuItems, rooms, modiSecretary } from '../data';
import { useProjects } from '../hooks/useProjects';
import { fetchRecentConversations, RecentConversation } from '../services/conversations.service';

interface NewSidebarProps {
  isOpen: boolean;
  onClose: () => void;
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

/** room_id → Room 정보 매핑 */
const allRooms = [...rooms, modiSecretary];
function getRoomInfo(roomId: string) {
  const room = allRooms.find(r => r.id === roomId);
  return {
    name: room?.name || roomId,
    image: room?.image || '/images/modi.png',
    emoji: room?.emoji || '💬',
  };
}

export function NewSidebar({ isOpen, onClose, onSelectHistory }: NewSidebarProps) {
  const navigate = useNavigate();
  const { projects } = useProjects();
  const [recentConversations, setRecentConversations] = useState<RecentConversation[]>([]);

  const loadRecent = () => {
    fetchRecentConversations(5)
      .then(setRecentConversations)
      .catch((e) => console.warn('[Sidebar] 최근 대화 로드 실패:', e));
  };

  // 마운트 시 + 대화 발생 시 리프레시
  useEffect(() => {
    loadRecent();
    const handler = () => loadRecent();
    window.addEventListener('conversation-updated', handler);
    return () => window.removeEventListener('conversation-updated', handler);
  }, []);

  return (
    <>
      {/* 모바일 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-white/95 backdrop-blur-sm z-50
          flex flex-col border-r border-gray-100 transition-transform duration-300
          lg:static lg:translate-x-0 lg:z-auto lg:bg-white/80
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* 모바일 닫기 */}
        <div className="flex items-center justify-between p-4 lg:hidden">
          <span className="font-bold text-gray-800">메뉴</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200
              flex items-center justify-center text-gray-500 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 메뉴 섹션 */}
        <nav className="px-3 pt-4 lg:pt-4">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">메뉴</p>
          <ul className="space-y-1">
            {menuItems.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-2xl text-sm transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-primary-600 font-semibold'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <img src={item.image} alt={item.label} className="w-5 h-5 object-contain" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* 프로젝트 섹션 */}
        <div className="px-3 mt-6">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">프로젝트</p>
          <ul className="space-y-1">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => { navigate(`/project/${p.id}`); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-sm text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer text-left"
                >
                  {p.image
                    ? <img src={p.image} alt={p.name} className="w-5 h-5 object-contain" />
                    : <span className="text-base">{p.emoji}</span>}
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* 히스토리 섹션 — 실제 DB 대화 */}
        <div className="px-3 mt-6 flex-1 overflow-y-auto">
          <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">최근 대화</p>
          <ul className="space-y-1">
            {recentConversations.map((conv) => {
              const room = getRoomInfo(conv.room_id);
              return (
                <li key={conv.id}>
                  <button
                    onClick={() => {
                      onSelectHistory({
                        id: conv.id,
                        roomId: conv.room_id,
                        roomName: room.name,
                        roomEmoji: room.emoji,
                        roomImage: room.image,
                        lastMessage: conv.last_message,
                        timestamp: new Date(conv.created_at),
                      });
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2 rounded-2xl hover:bg-pastel-purple/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={room.image}
                        alt={room.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                      <span className="text-sm font-medium text-gray-700 truncate">{room.name}</span>
                      <span className="ml-auto text-xs text-gray-400 flex-shrink-0">{formatDate(new Date(conv.created_at))}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5 pl-8">{conv.last_message}</p>
                  </button>
                </li>
              );
            })}
            {recentConversations.length === 0 && (
              <li className="px-3 py-2 text-xs text-gray-400">아직 대화가 없어요</li>
            )}
          </ul>
        </div>

        {/* 하단 여백 */}
        <div className="p-4" />
      </aside>
    </>
  );
}
