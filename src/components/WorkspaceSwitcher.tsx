/**
 * @file src/components/WorkspaceSwitcher.tsx
 * @description 워크스페이스 전환 (사이드바 상단) — 현재 공간 표시 → 클릭 → 런처(A안)
 * - 런처: 🧸 개인 공간 / 🏢 회사 오피스 → (회사) 어느 오피스로? 목록 → 이동
 * - "+ 추가하기 · 코드로 합류" → WorkspaceCreateModal
 */
import { useState } from 'react';
import { useWorkspaceContext } from '../contexts/WorkspaceContext';
import { WorkspaceCreateModal } from './WorkspaceCreateModal';
import { WorkspaceLauncher } from './WorkspaceLauncher';
import { Workspace } from '../types';

export function WorkspaceSwitcher() {
  const { personal, offices, activeWorkspaceId, activeWorkspace, setActiveWorkspace, reload } = useWorkspaceContext();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState<'choose' | 'join'>('choose');

  // 워크스페이스 로드 전(또는 마이그레이션 전)엔 숨김
  if (!personal && offices.length === 0) return null;

  const cur = activeWorkspace ?? personal;
  const current = { emoji: cur?.emoji || '🏢', name: cur?.name || '워크스페이스', img: cur?.imageUrl };

  const onCreated = async (ws: Workspace) => { await reload(); setActiveWorkspace(ws.id); };

  return (
    <div className="px-3 pt-3">
      <button
        onClick={() => setLauncherOpen(true)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-2xl bg-gray-50 hover:bg-gray-100 border border-gray-100 transition-colors"
        title="워크스페이스 전환"
      >
        {current.img
          ? <img src={current.img} alt={current.name} className="w-6 h-6 rounded-lg object-cover flex-shrink-0" />
          : <span className="text-base">{current.emoji}</span>}
        <span className="text-sm font-semibold text-gray-800 truncate">{current.name}</span>
        <svg className="ml-auto w-3.5 h-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      <WorkspaceLauncher
        open={launcherOpen}
        onClose={() => setLauncherOpen(false)}
        personal={personal}
        offices={offices}
        activeId={activeWorkspaceId}
        onPick={(id) => setActiveWorkspace(id)}
        onCreate={() => { setCreateStep('choose'); setShowCreate(true); }}
      />
      <WorkspaceCreateModal open={showCreate} initialStep={createStep} onClose={() => setShowCreate(false)} onCreated={onCreated} />
    </div>
  );
}
