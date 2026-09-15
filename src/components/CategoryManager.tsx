/**
 * @file src/components/CategoryManager.tsx
 * @description 공용 카테고리 관리 모달 — 색변경·삭제·추가 (docs/CATEGORY_SYSTEM.md)
 * - 상위(CategorySelect)의 useCategories 상태를 받아 조작 → 선택 드롭다운과 즉시 동기화.
 * - 색은 12색 스와치. 색점 클릭 → 해당 카테고리 색 변경.
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Category } from '../types';

export const CATEGORY_PALETTE = [
  '#4ade80', '#2dd4bf', '#60a5fa', '#818cf8', '#c084fc', '#f472b6',
  '#fb7185', '#fb923c', '#fbbf24', '#a3e635', '#9ca3af', '#b08968',
];

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
  const [editId, setEditId] = useState<string | null>(null);

  const swatch = (p: string, selected: boolean, onClick: () => void) => (
    <button key={p} type="button" onClick={onClick} aria-label={p}
      className="w-6 h-6 rounded-full transition-transform active:scale-90"
      style={{ background: p, outline: selected ? '2px solid var(--color-foreground)' : '2px solid transparent', outlineOffset: '2px' }} />
  );

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40" onMouseDown={onClose}>
      <div className="bg-surface rounded-2xl w-full max-w-md p-5 max-h-[85vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-base font-semibold text-foreground">카테고리 관리</h3>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-full bg-surface-muted text-foreground-muted hover:text-foreground text-sm">✕</button>
        </div>
        <p className="text-xs text-foreground-faint mb-3">색점을 눌러 색 변경 · ✕로 삭제</p>

        <div className="divide-y divide-line">
          {categories.map((c) => (
            <div key={c.id}>
              <div className="flex items-center gap-3 py-2.5">
                <button type="button" onClick={() => setEditId(editId === c.id ? null : c.id)} className="p-1 rounded hover:bg-surface-muted" aria-label="색 변경">
                  <span className="w-3 h-3 rounded-full block" style={{ background: c.color }} />
                </button>
                <span className="flex-1 text-sm text-foreground truncate">{c.label}</span>
                <button type="button" onClick={() => onRemove(c.id)} className="w-6 h-6 rounded-full text-foreground-faint hover:text-rose-500 text-xs" aria-label="삭제">✕</button>
              </div>
              {editId === c.id && (
                <div className="flex flex-wrap gap-2 pb-3 pl-1">
                  {CATEGORY_PALETTE.map((p) => swatch(p, p === c.color, () => { onUpdate(c.id, { color: p }); setEditId(null); }))}
                </div>
              )}
            </div>
          ))}
          {categories.length === 0 && <p className="text-xs text-foreground-faint py-3">아직 카테고리가 없어요.</p>}
        </div>

        <div className="border-t border-line mt-2 pt-4">
          <p className="text-xs font-semibold text-foreground-muted mb-2">새 카테고리</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="카테고리 이름"
            className="w-full border border-line bg-surface rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-faint focus:border-primary-500 focus:outline-none transition-colors" />
          <div className="flex flex-wrap gap-2 mt-2.5">
            {CATEGORY_PALETTE.map((p) => swatch(p, p === color, () => setColor(p)))}
          </div>
          <div className="flex justify-end mt-4">
            <button type="button"
              onClick={() => { const n = name.trim(); if (!n) return; if (!categories.some((c) => c.label === n)) onAdd(n, color); setName(''); }}
              className="bg-primary-500 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">＋ 추가</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
