/**
 * @file src/components/WorkspaceSwitcher.tsx
 * @description 워크스페이스 전환 (사이드바 상단 드롭다운)
 * - 현재 워크스페이스 표시 → 클릭 → 목록(전체/개인/회사들) → 선택 전환
 * - "+ 추가하기" → 화면 중앙 생성 모달(WorkspaceCreateModal)
 * - null = 🌐 전체(모든 워크스페이스 모아보기)
 */
import { useState, useRef, useEffect } from 'react';
import { useWorkspaceContext } from '../contexts/WorkspaceContext';
import { WorkspaceCreateModal } from './WorkspaceCreateModal';
import { ActiveWorkspace, Workspace } from '../types';

export function WorkspaceSwitcher() {
  const { personal, offices, activeWorkspaceId, activeWorkspace, setActiveWorkspace, reload } = useWorkspaceContext();
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // 워크스페이스 로드 전(또는 마이그레이션 전)엔 숨김
  if (!personal && offices.length === 0) return null;

  const cur = activeWorkspace ?? personal;
  const current = { emoji: cur?.emoji || '🏢', name: cur?.name || '워크스페이스', img: cur?.imageUrl };

  const select = (id: ActiveWorkspace) => { setActiveWorkspace(id); setOpen(false); };

  const onCreated = async (ws: Workspace) => {
    await reload();
    setActiveWorkspace(ws.id);
  };

  const Row = ({ emoji, name, id, img }: { emoji: string; name: string; id: ActiveWorkspace; img?: string }) => {
    const active = activeWorkspaceId === id;
    return (
      <button
        onClick={() => select(id)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm hover:bg-gray-100 transition-colors text-left"
      >
        {img
          ? <img src={img} alt={name} className="w-5 h-5 rounded object-cover flex-shrink-0" />
          : <span className="text-base">{emoji}</span>}
        <span className={active ? 'font-semibold text-gray-800' : 'text-gray-600'}>{name}</span>
        {active && <span className="ml-auto text-primary-500 text-xs">✓</span>}
      </button>
    );
  };

  return (
    <div className="relative px-3 pt-3" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-colors"
      >
        {current.img
          ? <img src={current.img} alt={current.name} className="w-6 h-6 rounded-lg object-cover flex-shrink-0" />
          : <span className="text-base">{current.emoji}</span>}
        <span className="text-sm font-semibold text-gray-800 truncate">{current.name}</span>
        <svg
          className={`ml-auto w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-white rounded-2xl shadow-lg border border-gray-100 p-1.5 z-50">
          {/* 오피스 (먼저) */}
          {offices.length > 0 && (
            <>
              <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">오피스</p>
              {offices.map(o => <Row key={o.id} emoji={o.emoji || '🏢'} name={o.name} id={o.id} img={o.imageUrl} />)}
            </>
          )}

          {/* 개인 공간 */}
          {personal && (
            <>
              {offices.length > 0 && <div className="my-1 border-t border-gray-100" />}
              <p className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">개인 공간</p>
              <Row emoji={personal.emoji || '🧸'} name={personal.name} id={personal.id} img={personal.imageUrl} />
            </>
          )}

          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={() => { setOpen(false); setShowCreate(true); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors text-left"
          >
            <span className="text-base leading-none">＋</span> 추가하기
          </button>
        </div>
      )}

      <WorkspaceCreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreated={onCreated} />
    </div>
  );
}
