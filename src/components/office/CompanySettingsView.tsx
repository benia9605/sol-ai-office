/**
 * @file src/components/office/CompanySettingsView.tsx
 * @description 회사 설정 — 흩어져 있던 설정 화면을 한 페이지로 통합
 * - ① 회사 정보(이름·이모지·이미지·사업정보) ② 회사 브레인 ③ 초대코드·멤버
 * - 기존 BrandView / MembersView를 섹션으로 그대로 재사용, 회사 정보 편집만 인라인으로 신규.
 */
import { useEffect, useRef, useState } from 'react';
import { Workspace } from '../../types';
import { updateWorkspace } from '../../services/workspaces.service';
import { uploadImage } from '../../services/storage.service';
import { ViewHead, Card, fieldCls } from './ui';
import { BrandView } from './BrandView';
import { MembersView } from './views';

const EMOJIS = ['🏢', '🧸', '👤', '🚀', '💼', '🌱', '⭐', '🔥', '🎯', '🛒', '🎨', '💡', '📚', '🏠', '☕', '🐰'];

/** 회사 정보(이름·이모지·이미지·사업정보) 인라인 편집 카드 */
function CompanyInfoCard({ workspace, onSaved }: { workspace: Workspace; onSaved: () => void | Promise<void> }) {
  const isOffice = workspace.type === 'office';
  const [name, setName] = useState(workspace.name);
  const [emoji, setEmoji] = useState(workspace.emoji || (isOffice ? '🏢' : '🧸'));
  const [image, setImage] = useState<string | null>(workspace.imageUrl ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [bizInfo, setBizInfo] = useState(workspace.bizInfo ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 워크스페이스 전환 시 폼 동기화
  useEffect(() => {
    setName(workspace.name);
    setEmoji(workspace.emoji || (isOffice ? '🏢' : '🧸'));
    setImage(workspace.imageUrl ?? null);
    setImageFile(null);
    setBizInfo(workspace.bizInfo ?? '');
    setSaved(false);
  }, [workspace.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('이미지는 2MB 이하로 올려주세요.'); return; }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
    setSaved(false);
  };

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const imageUrl = imageFile ? await uploadImage(imageFile, 'workspaces') : (image || undefined);
      await updateWorkspace(workspace.id, {
        name, emoji, imageUrl,
        bizInfo: isOffice ? bizInfo.trim() : undefined,
      });
      await onSaved();
      setSaved(true);
    } catch (err) {
      alert('저장에 실패했어요: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">회사 정보</div>

      {/* 이미지 + 이모지 */}
      <div className="flex items-center gap-4">
        <button onClick={() => fileRef.current?.click()}
          className="w-16 h-16 rounded-2xl bg-surface-muted border border-line hover:border-foreground overflow-hidden flex items-center justify-center text-2xl text-gray-300 transition-all active:scale-95 flex-shrink-0">
          {image ? <img src={image} alt="회사" className="w-full h-full object-cover" /> : <span>{emoji}</span>}
        </button>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-gray-400">{image ? '이미지 변경 · 클릭' : '이미지 (선택) · 클릭'}</span>
          {image && <button onClick={() => { setImage(null); setImageFile(null); setSaved(false); }} className="text-[11px] text-rose-400 hover:text-rose-600 text-left">이미지 제거</button>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      </div>

      {/* 이모지 선택 (이미지 없을 때) */}
      {!image && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">이모지</label>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => { setEmoji(e); setSaved(false); }}
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all active:scale-90 ${emoji === e ? 'bg-foreground text-white' : 'bg-surface-muted hover:bg-gray-100'}`}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 이름 */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1.5">이름</label>
        <input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          placeholder={isOffice ? '예: 시목' : '예: 내 공간'} className={fieldCls} />
      </div>

      {/* 사업 정보 (오피스만) */}
      {isOffice && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">사업 정보 <span className="text-gray-300 font-normal">(헤더에 표시)</span></label>
          <input value={bizInfo} onChange={(e) => { setBizInfo(e.target.value); setSaved(false); }}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            placeholder="예: 원목 가구/소품 · 스마트스토어·자사몰" className={fieldCls} />
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button onClick={save} disabled={!name.trim() || busy}
          className="px-5 py-2.5 rounded-2xl bg-foreground text-white text-sm font-bold hover:opacity-85 transition-all active:scale-95 disabled:opacity-40">
          {busy ? '저장 중…' : '회사 정보 저장'}
        </button>
        {saved && <span className="text-sm text-emerald-500 font-medium">✓ 저장됐어요</span>}
      </div>
    </Card>
  );
}

export function CompanySettingsView({ workspace, onSaved }: { workspace: Workspace; onSaved: () => void | Promise<void> }) {
  return (
    <>
      <ViewHead eyebrow="SETTINGS" title="회사 설정" sub="회사 정보 · 브레인 · 초대코드 · 멤버를 한 곳에서 관리해요" />
      <div className="space-y-10">
        <CompanyInfoCard workspace={workspace} onSaved={onSaved} />
        <div><BrandView workspace={workspace} /></div>
        <div><MembersView workspace={workspace} /></div>
      </div>
    </>
  );
}
