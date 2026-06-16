/**
 * @file src/components/WorkspaceSettingsCard.tsx
 * @description 설정 페이지용 — 개인 공간(워크스페이스) 이름·이미지 수정 카드
 * - useWorkspaceContext의 personal 워크스페이스를 수정 (없으면 숨김)
 */
import { useState } from 'react';
import { useWorkspaceContext } from '../contexts/WorkspaceContext';
import { WorkspaceSettingsModal } from './WorkspaceSettingsModal';

export function WorkspaceSettingsCard() {
  const { personal, reload } = useWorkspaceContext();
  const [open, setOpen] = useState(false);
  if (!personal) return null;

  return (
    <div className="bg-white rounded-2xl shadow-soft p-4 sm:p-5">
      <h2 className="text-sm font-bold text-gray-700 mb-3">내 공간</h2>
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl overflow-hidden flex items-center justify-center text-2xl bg-gray-50 flex-shrink-0">
          {personal.imageUrl
            ? <img src={personal.imageUrl} alt={personal.name} className="w-full h-full object-cover rounded-2xl" />
            : <span>{personal.emoji || '🧸'}</span>}
        </span>
        <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{personal.name}</span>
        <button
          onClick={() => setOpen(true)}
          className="text-xs font-medium px-3 py-2 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 transition-all flex-shrink-0"
        >
          이름·이미지 수정
        </button>
      </div>
      {open && (
        <WorkspaceSettingsModal workspace={personal} onClose={() => setOpen(false)} onSaved={reload} />
      )}
    </div>
  );
}
