/**
 * @file src/components/BottomNav.tsx
 * @description 모바일 하단 네비게이션 바
 * - 홈, 일정, 할일, 인사이트 + 더보기(사이드바 토글)
 * - 뽀모도로 타이머 실행 중이면 왼쪽에 미니 타이머 표시
 * - lg 이상에서 숨김
 */
import { NavLink } from 'react-router-dom';
import { menuItems } from '../data';
import { TaskItem } from '../types';

interface BottomNavProps {
  onMoreClick: () => void;
  pomodoroTask?: TaskItem | null;
  pomodoroTimeStr?: string;
  pomodoroMode?: 'work' | 'break';
  pomodoroRunning?: boolean;
  onPomodoroToggle?: () => void;
  onPomodoroExpand?: () => void;
}

/** 하단 네비에 표시할 메뉴 4개 */
const bottomItems = menuItems.slice(0, 4);

export function BottomNav({ onMoreClick, pomodoroTask, pomodoroTimeStr, pomodoroMode, pomodoroRunning, onPomodoroToggle, onPomodoroExpand }: BottomNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center h-14">
        {/* 뽀모도로 미니 타이머 */}
        {pomodoroTask && pomodoroTimeStr && (
          <button
            onClick={onPomodoroExpand}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl mr-1 flex-shrink-0 transition-colors ${
              pomodoroMode === 'work' ? 'bg-red-50' : 'bg-green-50'
            }`}
          >
            <span className="text-xs">{pomodoroMode === 'work' ? '\uD83C\uDF45' : '\u2615'}</span>
            <span className="font-mono text-xs font-bold text-gray-800">{pomodoroTimeStr}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onPomodoroToggle?.(); }}
              className="text-[10px] px-1 py-0.5 rounded bg-white/80 text-gray-600 hover:bg-white"
            >
              {pomodoroRunning ? 'II' : '\u25B6'}
            </button>
          </button>
        )}

        {/* 메뉴 아이템들 */}
        <div className="flex items-center justify-around flex-1">
          {bottomItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors ${
                  isActive ? 'text-primary-600' : 'text-gray-400'
                }`
              }
            >
              <img
                src={item.image}
                alt={item.label}
                className="w-5 h-5 object-contain"
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}
          {/* 더보기 — 사이드바 열기 */}
          <button
            onClick={onMoreClick}
            className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-gray-400"
          >
            <span className="text-lg leading-5">≡</span>
            <span className="text-[10px] font-medium">더보기</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
