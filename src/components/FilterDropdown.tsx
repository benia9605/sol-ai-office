/**
 * @file src/components/FilterDropdown.tsx
 * @description 디자인 드롭다운 (네이티브 select 대신) — 필터/정렬용
 * - 버튼: 라벨(선택값) + 셰브론. 클릭 시 아래 팝오버 목록.
 * - 옵션에 dotColor 있으면 색 점 표시(카테고리용). 선택 항목엔 체크.
 * - 바깥 클릭/ESC로 닫힘. 모던 톤(각진 라인 + 소프트 그림자).
 */
import { useState, useRef, useEffect } from 'react';

export interface DropdownOption {
  key: string;
  label: string;
  dotColor?: string;
}

interface Props {
  value: string;
  options: DropdownOption[];
  onChange: (key: string) => void;
  /** 버튼 앞에 붙는 라벨(예: '상태'). 없으면 선택된 옵션 라벨만 */
  label?: string;
  className?: string;
}

export function FilterDropdown({ value, options, onChange, label, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 border px-3 py-2.5 text-sm bg-surface transition-colors ${
          open ? 'border-foreground' : 'border-line hover:border-foreground'
        }`}
      >
        {selected?.dotColor && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selected.dotColor }} aria-hidden />}
        {label && <span className="text-foreground-faint shrink-0">{label}</span>}
        <span className="flex-1 text-left truncate text-foreground">{selected?.label}</span>
        <svg className={`w-3.5 h-3.5 text-foreground-faint shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 min-w-max bg-surface border border-line shadow-[0_6px_24px_-8px_rgba(0,0,0,0.18)] rounded-md py-1 z-50 max-h-72 overflow-y-auto">
          {options.map((o) => {
            const on = o.key === value;
            return (
              <button
                key={o.key}
                type="button"
                onClick={() => { onChange(o.key); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  on ? 'bg-surface-muted text-foreground font-medium' : 'text-foreground-muted hover:bg-surface-muted'
                }`}
              >
                {o.dotColor
                  ? <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: o.dotColor }} aria-hidden />
                  : <span className="w-2 shrink-0" />}
                <span className="flex-1 truncate">{o.label}</span>
                {on && (
                  <svg viewBox="0 0 12 12" className="w-3 h-3 text-primary-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
