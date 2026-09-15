/**
 * @file src/components/CategorySelect.tsx
 * @description 공용 카테고리 선택 드롭다운 — 개인+오피스 전 메뉴 통일 (docs/CATEGORY_SYSTEM.md)
 * - 네이티브 <select> 금지: 색상 점 + 라벨 디자인 드롭다운.
 * - 오른쪽 "관리" 링크 → CategoryManager 모달(추가/색변경/삭제). 변경 시 목록 즉시 반영.
 * - 내부에서 useCategories(scope, workspaceId)로 세트 로드(개인=ws 없음 / 오피스=ws id).
 */
import { useState, useRef, useEffect } from 'react';
import { CategoryScope } from '../types';
import { useCategories } from '../hooks/useCategories';
import { CategoryManager } from './CategoryManager';

interface Props {
  scope: CategoryScope;
  workspaceId?: string;
  value?: string;                 // 선택된 카테고리 id
  onChange: (id: string) => void;
  placeholder?: string;
  allowNone?: boolean;            // '미지정' 허용
  className?: string;
}

export function CategorySelect({ scope, workspaceId, value, onChange, placeholder = '카테고리', allowNone = false, className = '' }: Props) {
  const { categories, add, update, remove } = useCategories(scope, workspaceId);
  const [open, setOpen] = useState(false);
  const [mgr, setMgr] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const sel = categories.find((c) => c.id === value);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative flex-1 min-w-0" ref={ref}>
        <button type="button" onClick={() => setOpen((o) => !o)}
          className={`w-full flex items-center gap-2 border bg-surface rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors ${open ? 'border-primary-500' : 'border-line'}`}>
          {sel && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: sel.color }} />}
          <span className="flex-1 min-w-0 truncate text-left">{sel ? sel.label : <span className="text-foreground-faint">{placeholder}</span>}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground-faint ml-2 shrink-0"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-line rounded-lg shadow-lg z-30 p-1 max-h-60 overflow-y-auto">
            {allowNone && (
              <button type="button" onClick={() => { onChange(''); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-foreground-muted hover:bg-surface-muted text-left">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-line" />
                <span className="flex-1">미지정</span>
                {!value && <span className="text-primary-500">✓</span>}
              </button>
            )}
            {categories.map((c) => (
              <button key={c.id} type="button" onClick={() => { onChange(c.id); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm text-foreground hover:bg-surface-muted text-left">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                <span className="flex-1 min-w-0 truncate">{c.label}</span>
                {c.id === value && <span className="text-primary-500">✓</span>}
              </button>
            ))}
            {categories.length === 0 && <p className="text-xs text-foreground-faint px-2.5 py-2">카테고리가 없어요</p>}
          </div>
        )}
      </div>
      <button type="button" onClick={() => setMgr(true)} className="text-xs text-foreground-muted hover:text-primary-500 hover:underline shrink-0 px-1 py-1">관리</button>
      {mgr && <CategoryManager categories={categories} onAdd={add} onUpdate={update} onRemove={remove} onClose={() => setMgr(false)} />}
    </div>
  );
}
