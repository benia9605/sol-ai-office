/**
 * @file src/components/WorkspaceSettingsModal.tsx
 * @description 워크스페이스(오피스/개인) 설정 모달 — 이름·이모지·이미지·(오피스)사업정보 수정
 * - 화면 중앙 Portal, 저장 시 updateWorkspace + 컨텍스트 reload
 */
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Workspace } from '../types';
import { updateWorkspace } from '../services/workspaces.service';
import { uploadImage } from '../services/storage.service';

const EMOJIS = ['🏢', '🧸', '👤', '🚀', '💼', '🌱', '⭐', '🔥', '🎯', '🛒', '🎨', '💡', '📚', '🏠', '☕', '🐰'];

interface Props {
  workspace: Workspace;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function WorkspaceSettingsModal({ workspace, onClose, onSaved }: Props) {
  const [name, setName] = useState(workspace.name);
  const [emoji, setEmoji] = useState(workspace.emoji || (workspace.type === 'office' ? '🏢' : '🧸'));
  const [image, setImage] = useState<string | null>(workspace.imageUrl ?? null); // 표시용(기존 URL 또는 새 미리보기)
  const [imageFile, setImageFile] = useState<File | null>(null); // 새로 고른 파일만
  const [bizInfo, setBizInfo] = useState(workspace.bizInfo ?? '');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isOffice = workspace.type === 'office';

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('이미지는 2MB 이하로 올려주세요.'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string); // 미리보기용만
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      // 새 파일이면 Storage 업로드 → URL, 아니면 기존 image(URL) 유지, 제거했으면 undefined
      const imageUrl = imageFile ? await uploadImage(imageFile, 'workspaces') : (image || undefined);
      await updateWorkspace(workspace.id, {
        name,
        emoji,
        imageUrl,
        bizInfo: isOffice ? bizInfo.trim() : undefined,
      });
      await onSaved();
      onClose();
    } catch (err) {
      alert('저장에 실패했어요: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="bg-white rounded-[28px] shadow-2xl w-[440px] max-w-[92vw] p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-extrabold text-gray-800">{isOffice ? '오피스 설정' : '개인 공간 설정'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 text-gray-400 flex items-center justify-center transition-colors active:scale-90">✕</button>
        </div>

        {/* 프로필 이미지 */}
        <div className="flex flex-col items-center gap-2 mb-4">
          <button onClick={() => fileRef.current?.click()}
            className="w-20 h-20 rounded-[22px] bg-gray-50 border border-gray-100 hover:bg-primary-50/50 overflow-hidden flex items-center justify-center text-3xl text-gray-300 transition-all active:scale-95">
            {image ? <img src={image} alt="프로필" className="w-full h-full object-cover" /> : <span>{emoji}</span>}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400">{image ? '이미지 변경 · 클릭' : '이미지 (선택)'}</span>
            {image && <button onClick={() => setImage(null)} className="text-[11px] text-rose-400 hover:text-rose-600">제거</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
        </div>

        {/* 이모지 (이미지 없을 때 사용) */}
        {!image && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">이모지</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all active:scale-90 ${emoji === e ? 'bg-primary-100 ring-2 ring-primary-300' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 이름 */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">이름</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            placeholder={isOffice ? '예: 운명랩' : '예: 내 공간'}
            className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:bg-white focus:border-primary-300 transition-colors" />
        </div>

        {/* 사업 정보 (오피스만) */}
        {isOffice && (
          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">사업 정보 <span className="text-gray-300 font-normal">(헤더에 표시)</span></label>
            <input value={bizInfo} onChange={(e) => setBizInfo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
              placeholder="예: 원목 가구/소품 · 스마트스토어·자사몰"
              className="w-full px-4 py-3 rounded-2xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:bg-white focus:border-primary-300 transition-colors" />
          </div>
        )}

        <div className="flex gap-2.5">
          <button onClick={onClose} className="px-5 py-3 rounded-2xl text-sm text-gray-500 hover:bg-gray-100 transition-colors active:scale-95">취소</button>
          <button onClick={save} disabled={!name.trim() || busy}
            className="flex-1 px-5 py-3 rounded-2xl text-sm font-bold bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 transition-all active:scale-[0.97] shadow-sm">
            {busy ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
