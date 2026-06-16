/**
 * @file src/components/WorkspaceCreateModal.tsx
 * @description 워크스페이스 생성 모달 (화면 정중앙 · Portal)
 * - body로 Portal → 사이드바 transform 영향 없이 화면 중앙에 뜸
 * - 토스앱st 몽글몽글: 둥근 카드 + 팝 애니메이션 + 소프트 톤
 * - 1단계: 정방형 버튼 2개(개인/회사, 이모지) → 2단계: 이미지+이름+(회사)사업정보
 */
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createWorkspace, joinByInviteCode } from '../services/workspaces.service';
import { Workspace, WorkspaceType } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (ws: Workspace) => void;
}

const ANIM = `
@keyframes wsPop { from { opacity: 0; transform: translateY(12px) scale(.95); } to { opacity: 1; transform: none; } }
@keyframes wsFade { from { opacity: 0; } to { opacity: 1; } }
`;

export function WorkspaceCreateModal({ open, onClose, onCreated }: Props) {
  const [step, setStep] = useState<'choose' | 'form' | 'join'>('choose');
  const [type, setType] = useState<WorkspaceType>('office');
  const [name, setName] = useState('');
  const [bizInfo, setBizInfo] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [joinErr, setJoinErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => { setStep('choose'); setType('office'); setName(''); setBizInfo(''); setImage(null); setCode(''); setJoinErr(''); };

  const join = async () => {
    if (!code.trim() || busy) return;
    setBusy(true); setJoinErr('');
    try {
      const ws = await joinByInviteCode(code);
      onCreated(ws); handleClose();
    } catch {
      setJoinErr('초대 코드를 찾을 수 없어요. 다시 확인해주세요.');
    } finally { setBusy(false); }
  };
  const handleClose = () => { reset(); onClose(); };
  const pick = (t: WorkspaceType) => { setType(t); setStep('form'); };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('이미지는 2MB 이하로 올려주세요.'); return; }
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const ws = await createWorkspace(type, name, {
        imageUrl: image || undefined,
        bizInfo: type === 'office' ? bizInfo.trim() || undefined : undefined,
      });
      onCreated(ws);
      handleClose();
    } catch (err) {
      console.error('[WorkspaceCreateModal] 생성 실패:', err);
      alert('생성에 실패했어요. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const TypeButton = ({ t, emoji, label, desc }: { t: WorkspaceType; emoji: string; label: string; desc: string }) => (
    <button
      onClick={() => pick(t)}
      className="rounded-[26px] border border-gray-100 bg-white hover:bg-primary-50/50 hover:border-primary-200
        flex flex-col items-center justify-center gap-3 py-8 transition-all active:scale-[0.96] shadow-sm hover:shadow-md"
    >
      <span className="w-16 h-16 rounded-[20px] bg-primary-50 flex items-center justify-center text-4xl">{emoji}</span>
      <span className="text-center">
        <span className="block text-[15px] font-bold text-gray-800">{label}</span>
        <span className="block text-[11px] text-gray-400 mt-1">{desc}</span>
      </span>
    </button>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      style={{ animation: 'wsFade .15s ease-out' }}
      onMouseDown={handleClose}
    >
      <style>{ANIM}</style>
      <div
        className="bg-white rounded-[32px] shadow-2xl w-[460px] max-w-[92vw] p-7"
        style={{ animation: 'wsPop .22s cubic-bezier(.2,.9,.25,1)' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[17px] font-extrabold text-gray-800">
            {step === 'choose' ? '새로 만들기' : step === 'join' ? '코드로 합류' : type === 'office' ? '회사 오피스' : '개인 공간'}
          </h2>
          <button onClick={handleClose} className="w-9 h-9 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center transition-colors active:scale-90">✕</button>
        </div>

        {/* 1단계: 타입 선택 */}
        {step === 'choose' && (
          <>
            <div className="grid grid-cols-2 gap-3.5">
              <TypeButton t="personal" emoji="🧸" label="개인 공간" desc="자기계발 · 기록장" />
              <TypeButton t="office" emoji="🏢" label="회사 오피스" desc="AI 직원 · 리포트" />
            </div>
            <button onClick={() => setStep('join')}
              className="w-full mt-4 text-center text-sm text-primary-500 hover:text-primary-600 transition-colors active:scale-95">
              초대 코드가 있나요? <b>코드로 합류 →</b>
            </button>
          </>
        )}

        {/* 코드로 합류 */}
        {step === 'join' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">초대 코드</label>
              <input autoFocus value={code}
                onChange={(e) => { setCode(e.target.value.toUpperCase()); setJoinErr(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') join(); }}
                placeholder="예: SIMOK1" maxLength={8}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm tracking-[0.2em] text-center font-bold focus:outline-none focus:bg-white focus:border-primary-300 transition-colors" />
              {joinErr && <p className="text-[11px] text-rose-500 mt-1.5">{joinErr}</p>}
              <p className="text-[11px] text-gray-400 mt-2">오피스 오너에게 받은 6자리 코드를 입력하세요.</p>
            </div>
            <div className="flex gap-2.5">
              <button onClick={() => setStep('choose')} className="px-5 py-3 rounded-2xl text-sm text-gray-500 hover:bg-gray-100 transition-colors active:scale-95">← 뒤로</button>
              <button onClick={join} disabled={!code.trim() || busy}
                className="flex-1 px-5 py-3 rounded-2xl text-sm font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 transition-all active:scale-[0.97] shadow-sm">
                {busy ? '합류 중…' : '합류하기'}
              </button>
            </div>
          </div>
        )}

        {/* 2단계: 입력 폼 */}
        {step === 'form' && (
          <div className="space-y-5">
            {/* 프로필 이미지 */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-24 h-24 rounded-[26px] bg-gray-50 border border-gray-100 hover:bg-primary-50/50
                  overflow-hidden flex items-center justify-center text-3xl text-gray-300 transition-all active:scale-95 shadow-sm"
              >
                {image
                  ? <img src={image} alt="프로필" className="w-full h-full object-cover" />
                  : <span>{type === 'office' ? '🏢' : '🧸'}</span>}
              </button>
              <span className="text-[11px] text-gray-400">프로필 이미지 {image ? '· 변경하려면 클릭' : '(선택)'}</span>
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
            </div>

            {/* 이름 */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">이름</label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                placeholder={type === 'office' ? '예: 운명랩' : '예: 내 오피스'}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:bg-white focus:border-primary-300 transition-colors"
              />
            </div>

            {/* 사업 정보 (회사만) */}
            {type === 'office' && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">사업 정보 <span className="text-gray-300 font-normal">(어디서 하는 사업인지)</span></label>
                <input
                  value={bizInfo}
                  onChange={(e) => setBizInfo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                  placeholder="예: 원목 가구/소품 · 스마트스토어·자사몰"
                  className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:bg-white focus:border-primary-300 transition-colors"
                />
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-2.5 pt-1">
              <button onClick={() => setStep('choose')} className="px-5 py-3 rounded-2xl text-sm text-gray-500 hover:bg-gray-100 transition-colors active:scale-95">← 뒤로</button>
              <button
                onClick={submit}
                disabled={!name.trim() || busy}
                className="flex-1 px-5 py-3 rounded-2xl text-sm font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 transition-all active:scale-[0.97] shadow-sm"
              >
                {busy ? '만드는 중…' : '만들기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
