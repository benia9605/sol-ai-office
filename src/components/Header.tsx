/**
 * @file src/components/Header.tsx
 * @description 앱 상단 헤더 컴포넌트
 * - 좌측: 모바일 사이드바 토글 버튼 (lg 이하)
 * - 중앙: Teamie 로고
 * - 우측: 유저 메뉴 (로그아웃) + 설정 버튼
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onToggleSidebar: () => void;
  userName?: string;
  onLogout?: () => void;
}

export function Header({ onToggleSidebar, userName, onLogout }: HeaderProps) {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  return (
    <header className="h-14 px-4 flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-gray-100 flex-shrink-0">
      {/* 좌측: 사이드바 토글 (모바일) */}
      <button
        onClick={onToggleSidebar}
        className="lg:hidden w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200
          flex items-center justify-center text-gray-600 transition-colors"
      >
        ☰
      </button>
      <div className="lg:hidden" />

      {/* 중앙: 로고 (클릭 시 홈) */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 hover:opacity-80 transition-opacity"
      >
        <img src="/images/home.png" alt="Teamie" className="w-6 h-6 object-contain" />
        <span className="text-lg font-bold text-gray-800">Teamie</span>
      </button>

      {/* 우측: 유저 + 설정 */}
      <div className="flex items-center gap-2">
        {userName && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200
                transition-colors text-sm text-gray-700 font-medium"
            >
              <span className="max-w-[80px] truncate">{userName}</span>
              <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[120px] z-50">
                <button
                  onClick={() => { setShowMenu(false); onLogout?.(); }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  로그아웃
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => navigate('/settings')}
          className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200
            flex items-center justify-center text-gray-600 transition-colors"
        >
          ⚙️
        </button>
      </div>
    </header>
  );
}
