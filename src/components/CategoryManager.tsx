/**
 * @file src/components/CategoryManager.tsx
 * @description 공용 카테고리 관리 모달 — 색변경·이름수정·삭제·추가 (docs/CATEGORY_SYSTEM.md)
 * - 상위(CategorySelect)의 useCategories 상태를 받아 조작 → 선택 드롭다운과 즉시 동기화.
 * - 색은 이름 오른쪽 "색 네모"를 눌러 HTML 컬러 피커(<input type="color">)로 직접 선택.
 * - 이름은 인라인 편집(blur 시 저장). ✕로 삭제.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Category } from '../types';

/** 새 카테고리 기본 색 후보(첫 추가 시 시작색) */
export const CATEGORY_PALETTE = [
  '#4ade80', '#2dd4bf', '#60a5fa', '#818cf8', '#c084fc', '#f472b6',
  '#fb7185', '#fb923c', '#fbbf24', '#a3e635', '#9ca3af', '#b08968',
];

/** 유효한 #rrggbb 인지 — color input의 value로 안전하게 쓰기 위한 가드 */
const safeHex = (c?: string) => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : '#9ca3af');

/** 색 네모 — 누르면 OS 컬러 피커가 뜬다(투명한 color input을 겹쳐 둠) */
function ColorSquare({ value, onChange }: { value?: string; onChange: (hex: string) => void }) {
  return (
    <label
      className="relative w-7 h-7 rounded-lg border border-line shrink-0 cursor-pointer overflow-hidden"
      style={{ background: safeHex(value) }}
      title="색 선택"
    >
      <input
        type="color"
        value={safeHex(value)}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </label>
  );
}

interface Props {
  categories: Category[];
  onAdd: (label: string, color: string) => void;
  onUpdate: (id: string, fields: { label?: string; color?: string }) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

export function CategoryManager({ categories, onAdd, onUpdate, onRemove, onClose }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_PALETTE[0]);

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    if (!categories.some((c) => c.label === n)) onAdd(n, color);
    setName('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40" onMouseDown={onClose}>
      <div className="bg-surface rounded-2xl w-full max-w-md p-5 max-h-[85vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-foreground">카테고리 관리</h3>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-full bg-surface-muted text-foreground-muted hover:text-foreground text-sm">✕</button>
        </div>
        <p className="text-xs text-foreground-faint mb-3">이름을 눌러 수정 · 오른쪽 색 네모를 눌러 색 직접 선택 · ✕로 삭제</p>

        <div className="divide-y divide-line">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2.5 py-2.5">
              <input
                defaultValue={c.label}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.label) onUpdate(c.id, { label: v }); }}
                className="flex-1 min-w-0 bg-transparent text-sm text-foreground focus:outline-none border-b border-transparent focus:border-line py-0.5"
              />
              <ColorSquare value={c.color} onChange={(hex) => onUpdate(c.id, { color: hex })} />
              <button type="button" onClick={() => onRemove(c.id)} className="w-6 h-6 rounded-full text-foreground-faint hover:text-rose-500 text-xs shrink-0" aria-label="삭제">✕</button>
            </div>
          ))}
          {categories.length === 0 && <p className="text-xs text-foreground-faint py-3">아직 카테고리가 없어요.</p>}
        </div>

        <div className="border-t border-line mt-2 pt-4">
          <p className="text-xs font-semibold text-foreground-muted mb-2">새 카테고리</p>
          <div className="flex items-center gap-2.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(); }}
              placeholder="카테고리 이름"
              className="flex-1 min-w-0 border border-line bg-surface rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-faint focus:border-primary-500 focus:outline-none transition-colors"
            />
            <ColorSquare value={color} onChange={setColor} />
            <button type="button" onClick={submit}
              className="shrink-0 bg-primary-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity">＋ 추가</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
