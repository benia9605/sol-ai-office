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
    <section className="space-y-5">
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <div className="flex items-baseline gap-3">
          <p className="label">Space</p>
          <h2 className="text-base font-normal text-foreground-muted">내 공간</h2>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border border-line-strong px-3 py-1.5 text-xs text-foreground hover:border-foreground transition-colors"
        >
          이름·이미지 수정
        </button>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 border border-line bg-surface-muted overflow-hidden flex items-center justify-center text-2xl shrink-0">
          {personal.imageUrl
            ? <img src={personal.imageUrl} alt="" className="w-full h-full object-cover" />
            : <span>🧸</span>}
        </span>
        <p className="text-base">개인 공간</p>
      </div>
      {open && (
        <WorkspaceSettingsModal workspace={personal} onClose={() => setOpen(false)} onSaved={reload} />
      )}
    </section>
  );
}
