/**
 * @file src/components/office/HireStaffModal.tsx
 * @description AI 직원 채용 모달 (몽글 · portal)
 * - 1단계: 타입 카탈로그 그리드 → 선택
 * - 2단계: 이름·모델·일과·프롬프트 입력 → 채용
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { STAFF_TYPES } from '../../data/staffCatalog';
import { hireStaff } from '../../services/staff.service';
import { Staff, StaffTypeDef, StaffModel, Workspace } from '../../types';

/** 모델 선택 옵션 (라벨 + 한 줄 설명) */
export const MODEL_OPTIONS: { key: StaffModel; label: string; desc: string }[] = [
  { key: 'sonnet', label: 'Claude Sonnet', desc: '균형·한국어 카피·구조 안정' },
  { key: 'haiku', label: 'Claude Haiku', desc: '빠르고 저렴 · 집계/요약' },
  { key: 'opus', label: 'Claude Opus', desc: '고급 추론 · 복잡한 판단' },
  { key: 'gpt', label: 'GPT-4o', desc: '마케팅 카피 강점' },
  { key: 'research', label: 'Perplexity → Claude', desc: '실시간 검색 + 구조화 (2단계)' },
];

const ANIM = `
@keyframes hsPop { from { opacity:0; transform: translateY(12px) scale(.96);} to {opacity:1; transform:none;} }
@keyframes hsFade { from {opacity:0;} to {opacity:1;} }`;

interface Props {
  open: boolean;
  workspace: Workspace;
  onClose: () => void;
  onHired: (s: Staff) => void;
}

export function HireStaffModal({ open, workspace, onClose, onHired }: Props) {
  const [type, setType] = useState<StaffTypeDef | null>(null);
  const [name, setName] = useState('');
  const [model, setModel] = useState<StaffModel>('sonnet');
  const [prompt, setPrompt] = useState('');
  const [routines, setRoutines] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const reset = () => { setType(null); setName(''); setModel('sonnet'); setPrompt(''); setRoutines([]); };
  const close = () => { reset(); onClose(); };

  const choose = (t: StaffTypeDef) => {
    setType(t); setName(t.label); setRoutines([...t.defaultRoutines]);
    setModel(t.defaultModel); // 타입별 기본 모델 자동 적용 (변경 가능)
    setPrompt(t.defaultPrompt); // 기본 프롬프트 미리 채움 (편집 가능)
  };
  const toggleRoutine = (r: string) =>
    setRoutines(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  const submit = async () => {
    if (!type || !name.trim() || busy) return;
    setBusy(true);
    try {
      const s = await hireStaff({ workspaceId: workspace.id, typeKey: type.key, name, prompt, model, routines });
      onHired(s); close();
    } catch (e) { console.error(e); alert('채용에 실패했어요.'); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      style={{ animation: 'hsFade .15s ease-out' }} onMouseDown={close}>
      <style>{ANIM}</style>
      <div className="bg-white rounded-[32px] shadow-2xl w-[520px] max-w-[94vw] max-h-[88vh] overflow-y-auto p-7"
        style={{ animation: 'hsPop .22s cubic-bezier(.2,.9,.25,1)' }} onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[17px] font-extrabold text-gray-800">{type ? `${type.emoji} ${type.label} 채용` : 'AI 직원 채용'}</h2>
          <button onClick={close} className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center active:scale-90">✕</button>
        </div>

        {/* 1단계: 타입 카탈로그 */}
        {!type && (
          <div className="grid grid-cols-2 gap-3">
            {STAFF_TYPES.map(t => (
              <button key={t.key} onClick={() => choose(t)}
                className="rounded-[22px] border border-gray-100 bg-white hover:bg-primary-50/50 hover:border-primary-200
                  p-4 text-left transition-all active:scale-[0.97] shadow-sm hover:shadow-md">
                <span className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center text-2xl mb-2">{t.emoji}</span>
                <div className="text-sm font-bold text-gray-800">{t.label}</div>
                <div className="text-[11px] text-gray-400 mt-0.5">{t.roleLine}</div>
              </button>
            ))}
          </div>
        )}

        {/* 2단계: 설정 */}
        {type && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">이름</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:bg-white focus:border-primary-300" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">모델 <span className="font-normal text-gray-400">· 직원 타입 추천값 자동 선택 (변경 가능)</span></label>
              <div className="grid grid-cols-2 gap-2">
                {MODEL_OPTIONS.map(o => (
                  <button key={o.key} onClick={() => setModel(o.key)}
                    className={`px-3 py-2 rounded-2xl text-left transition-all active:scale-[0.97] border
                      ${model === o.key ? 'bg-primary-500 text-white border-primary-500' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                    <div className="text-[13px] font-semibold">{o.label}</div>
                    <div className={`text-[10px] ${model === o.key ? 'text-white/80' : 'text-gray-400'}`}>{o.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">매일 하는 일</label>
              <div className="space-y-1.5">
                {type.defaultRoutines.map(r => (
                  <button key={r} onClick={() => toggleRoutine(r)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-left transition-colors">
                    <span className={`w-4 h-4 rounded-md flex items-center justify-center text-[10px] text-white ${routines.includes(r) ? 'bg-primary-500' : 'bg-gray-300'}`}>✓</span>
                    <span className="text-sm text-gray-700">{r}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">프롬프트 <span className="text-gray-300 font-normal">(이 직원의 성격·지시)</span></label>
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
                placeholder={type.promptPlaceholder}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:bg-white focus:border-primary-300 resize-none" />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button onClick={() => setType(null)} className="px-5 py-3 rounded-2xl text-sm text-gray-500 hover:bg-gray-100 transition-colors active:scale-95">← 뒤로</button>
              <button onClick={submit} disabled={!name.trim() || busy}
                className="flex-1 px-5 py-3 rounded-2xl text-sm font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 transition-all active:scale-[0.97]">
                {busy ? '채용 중…' : '채용하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
