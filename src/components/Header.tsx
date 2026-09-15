/**
 * @file src/components/Header.tsx
 * @description 앱 상단 헤더 컴포넌트 (개인 공간)
 * - 중앙: Teamie 로고
 * - 우측: 프로필 메뉴 (설정 · 오피스 이동 · 로그아웃)
 * - 모바일은 하단 네비가 있어 좌측 사이드바 토글(햄버거) 없음. 설정 기어 아이콘도 제거.
 * - 오피스 이동 → 워크스페이스 런처(A안)로 "어느 오피스로?" 팝업.
 */
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceContext } from '../contexts/WorkspaceContext';
import { WorkspaceLauncher } from './WorkspaceLauncher';
import { WorkspaceCreateModal } from './WorkspaceCreateModal';
import { Workspace } from '../types';

interface HeaderProps {
  userName?: string;
  onLogout?: () => void;
}

export function Header({ userName, onLogout }: HeaderProps) {
  const navigate = useNavigate();
  const { personal, offices, activeWorkspaceId, setActiveWorkspace, reload } = useWorkspaceContext();
  const [showMenu, setShowMenu] = useState(false);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭 시 메뉴 닫기
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const MenuItem = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={() => { setShowMenu(false); onClick(); }}
      className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2.5"
    >
      {children}
    </button>
  );

  return (
    <header className="h-14 px-4 flex items-center justify-between bg-white/80 backdrop-blur-sm border-b border-gray-100 flex-shrink-0">
      {/* 좌측 여백 (모바일 햄버거 제거 — 하단 네비로 대체) */}
      <div className="w-9" />

      {/* 중앙: 로고 (클릭 시 홈) */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 hover:opacity-80 transition-opacity"
      >
        <img src="/images/home.png" alt="Teamie" className="w-6 h-6 object-contain" />
        <span className="text-lg font-bold text-gray-800">Teamie</span>
      </button>

      {/* 우측: 프로필 메뉴 */}
      <div className="flex items-center">
        {userName && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors text-sm text-gray-700 font-medium"
            >
              <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                {userName.slice(0, 1)}
              </span>
              <span className="max-w-[80px] truncate">{userName}</span>
              <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-2xl shadow-lg border border-gray-100 py-1.5 min-w-[172px] z-50">
                <MenuItem onClick={() => navigate('/settings')}>
                  <span className="text-base leading-none">⚙️</span> 설정
                </MenuItem>
                <MenuItem onClick={() => setLauncherOpen(true)}>
                  <span className="text-base leading-none">🏢</span> 오피스 이동
                </MenuItem>
                <div className="my-1 border-t border-gray-100" />
                <MenuItem onClick={() => onLogout?.()}>
                  <span className="text-base leading-none">↩</span> 로그아웃
                </MenuItem>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 오피스 이동 런처 — 바로 "어느 오피스로?" 목록 */}
      <WorkspaceLauncher
        open={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        personal={personal}
        offices={offices}
        activeId={activeWorkspaceId}
        onPick={(id) => setActiveWorkspace(id)}
        onCreate={() => setShowCreate(true)}
        initialStep="office"
      />
      <WorkspaceCreateModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={async (ws: Workspace) => { await reload(); setActiveWorkspace(ws.id); }}
      />
    </header>
  );
}
