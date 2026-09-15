/**
 * @file src/components/WorkspaceLauncher.tsx
 * @description 워크스페이스 런처 (A안 · 2단계 카드)
 * - 1단계: 🧸 개인 공간 / 🏢 회사 오피스 정방형 두 카드
 * - 회사 오피스 → 2단계: "어느 오피스로 이동할까요?" 목록 → 고르면 그 오피스로 이동
 * - 하단: ＋ 새로 만들기 · 코드로 합류 (기존 WorkspaceCreateModal 열기)
 * - '마지막 곳으로 바로 진입'은 useWorkspace(localStorage)가 이미 처리 → 이 런처는 '전환' 용도.
 * - 만들기 팝업(WorkspaceCreateModal)과 같은 디자인 언어(rounded-[32px]·정방형 카드).
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Workspace, ActiveWorkspace } from '../types';

const ANIM = `
@keyframes wlPop { from { opacity:0; transform: translateY(10px) scale(.97);} to {opacity:1; transform:none;} }
@keyframes wlFade { from {opacity:0;} to {opacity:1;} }`;

interface Props {
  open: boolean;
  onClose: () => void;
  personal: Workspace | null;
  offices: Workspace[];
  activeId: ActiveWorkspace;
  /** 워크스페이스 선택 → 이동 (부모에서 setActiveWorkspace + navigate 처리) */
  onPick: (id: string) => void;
  /** ＋ 새로 만들기 / 코드로 합류 (WorkspaceCreateModal 열기) */
  onCreate: () => void;
  /** 열 때 시작 단계 — 'office'면 바로 "어느 오피스로?" 목록(오피스 없으면 choose로 폴백) */
  initialStep?: 'choose' | 'office';
}

export function WorkspaceLauncher({ open, onClose, personal, offices, activeId, onPick, onCreate, initialStep = 'choose' }: Props) {
  const [step, setStep] = useState<'choose' | 'office'>('choose');
  // 열릴 때마다 시작 단계로 초기화 ('office' 요청인데 오피스가 없으면 choose)
  useEffect(() => { if (open) setStep(initialStep === 'office' && offices.length > 0 ? 'office' : 'choose'); }, [open, initialStep, offices.length]);
  if (!open) return null;

  const pick = (id: string) => { onPick(id); onClose(); };
  const chooseOffice = () => {
    if (offices.length === 0) { onClose(); onCreate(); return; }  // 오피스 없으면 만들기로
    setStep('office');
  };

  const wsAvatar = (ws: Workspace, fallback: string) =>
    ws.imageUrl
      ? <img src={ws.imageUrl} alt="" className="w-full h-full object-cover" />
      : <span>{ws.emoji || fallback}</span>;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      style={{ animation: 'wlFade .15s ease-out' }} onMouseDown={onClose}>
      <style>{ANIM}</style>
      <div className="bg-white rounded-[32px] shadow-2xl w-[460px] max-w-[92vw] p-7"
        style={{ animation: 'wlPop .22s cubic-bezier(.2,.9,.25,1)' }} onMouseDown={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[17px] font-extrabold text-gray-800">
            {step === 'choose' ? '어디로 갈까요?' : '어느 오피스로 이동할까요?'}
          </h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center transition-colors active:scale-90">✕</button>
        </div>

        {/* 1단계 — 개인 / 회사 카드 */}
        {step === 'choose' && (
          <>
            <div className="grid grid-cols-2 gap-3.5">
              {/* 개인 공간 */}
              <button onClick={() => personal && pick(personal.id)} disabled={!personal}
                className="rounded-[26px] border border-gray-100 bg-white hover:bg-primary-50/50 hover:border-primary-200 p-5 flex flex-col items-center gap-3 transition-all active:scale-[0.97] shadow-sm disabled:opacity-40 relative">
                {personal && activeId === personal.id && <span className="absolute top-3 right-3 text-primary-500 text-sm">✓</span>}
                <span className="w-16 h-16 rounded-[20px] bg-primary-50 overflow-hidden flex items-center justify-center text-4xl">{personal ? wsAvatar(personal, '🧸') : '🧸'}</span>
                <span className="text-center">
                  <span className="block text-[15px] font-bold text-gray-800">개인 공간</span>
                  <span className="block text-[11px] text-gray-400 mt-1">기록 · 성장</span>
                </span>
              </button>
              {/* 회사 오피스 */}
              <button onClick={chooseOffice}
                className="rounded-[26px] border border-gray-100 bg-white hover:bg-primary-50/50 hover:border-primary-200 p-5 flex flex-col items-center gap-3 transition-all active:scale-[0.97] shadow-sm">
                <span className="w-16 h-16 rounded-[20px] bg-primary-50 flex items-center justify-center text-4xl">🏢</span>
                <span className="text-center">
                  <span className="block text-[15px] font-bold text-gray-800">회사 오피스</span>
                  <span className="block text-[11px] text-gray-400 mt-1">{offices.length > 0 ? `${offices.length}개 · AI 직원 · 팀` : 'AI 직원 · 팀'}</span>
                </span>
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-center gap-4">
              <button onClick={() => { onClose(); onCreate(); }} className="text-sm text-primary-500 hover:text-primary-600 transition-colors active:scale-95 font-medium">＋ 새로 만들기</button>
              <span className="text-gray-200">·</span>
              <button onClick={() => { onClose(); onCreate(); }} className="text-sm text-gray-500 hover:text-gray-700 transition-colors active:scale-95">코드로 합류</button>
            </div>
          </>
        )}

        {/* 2단계 — 오피스 목록 */}
        {step === 'office' && (
          <>
            <button onClick={() => setStep('choose')} className="text-[13px] text-primary-500 hover:text-primary-600 font-semibold mb-3 active:scale-95">← 뒤로</button>
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
              {offices.map(o => (
                <button key={o.id} onClick={() => pick(o.id)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-primary-50/60 transition-colors text-left active:scale-[0.98]">
                  <span className="w-11 h-11 rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center text-xl flex-shrink-0">{wsAvatar(o, '🏢')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-gray-800 truncate">{o.name}</span>
                    <span className="block text-[11px] text-gray-400">회사 오피스</span>
                  </span>
                  {activeId === o.id
                    ? <span className="text-primary-500 text-sm flex-shrink-0">✓ 현재</span>
                    : <span className="text-gray-300 flex-shrink-0">›</span>}
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <button onClick={() => { onClose(); onCreate(); }} className="text-sm text-primary-500 hover:text-primary-600 transition-colors active:scale-95 font-medium">＋ 새 오피스 만들기</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
