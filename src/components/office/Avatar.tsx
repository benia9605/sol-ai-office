/**
 * @file src/components/office/Avatar.tsx
 * @description 프로필 아바타 + 아바타 드롭다운(MemberSelect)
 * - Avatar: 이미지가 있으면 이미지, 없으면 이름 첫 글자 원형 (모노톤)
 * - MemberSelect: 네이티브 select 대신 아바타+이름이 보이는 커스텀 담당자 선택
 */
import { useEffect, useRef, useState, ReactNode } from 'react';
import { WorkspaceMember } from '../../types';

type Size = 'xs' | 'sm' | 'md' | 'lg';
const DIMS: Record<Size, string> = { xs: 'w-5 h-5 text-[10px]', sm: 'w-6 h-6 text-[11px]', md: 'w-8 h-8 text-sm', lg: 'w-14 h-14 text-xl' };

export function Avatar({ name, url, size = 'xs' }: { name?: string | null; url?: string | null; size?: Size }) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  const base = `${DIMS[size]} shrink-0 rounded-full overflow-hidden border border-line bg-surface-muted flex items-center justify-center`;
  if (url) return <span className={base}><img src={url} alt="" className="w-full h-full object-cover" /></span>;
  return <span className={base}><span className="text-foreground-muted font-medium leading-none">{initial}</span></span>;
}

/**
 * 담당자 선택 — 아바타 + 이름이 보이는 커스텀 드롭다운.
 * value='' 는 미지정. members가 1명 이하면 굳이 안 써도 되지만 호출부에서 판단.
 */
export function MemberSelect({
  value, members, onChange, memberName, avatarUrl, placeholder = '담당자 없음', className = '',
}: {
  value: string;
  members: WorkspaceMember[];
  onChange: (userId: string) => void;
  memberName: (uid?: string) => string;
  avatarUrl?: (uid?: string) => string | null | undefined;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const Row = (uid: string, label: string): ReactNode => (
    <span className="flex items-center gap-2 min-w-0">
      {uid ? <Avatar name={label} url={avatarUrl?.(uid)} size="xs" /> : <span className="w-5 h-5 shrink-0 rounded-full border border-dashed border-line" />}
      <span className="truncate text-foreground">{label}</span>
    </span>
  );

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-surface-muted border border-line text-sm hover:border-foreground transition-colors">
        {value ? Row(value, memberName(value)) : <span className="text-foreground-faint">{placeholder}</span>}
        <svg className="w-3.5 h-3.5 text-foreground-faint shrink-0" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 left-0 right-0 max-h-64 overflow-y-auto rounded-lg bg-surface border border-line shadow-lg py-1">
          <button type="button" onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-muted flex items-center gap-2 ${!value ? 'bg-surface-muted' : ''}`}>
            <span className="w-5 h-5 shrink-0 rounded-full border border-dashed border-line" />
            <span className="text-foreground-muted">{placeholder}</span>
          </button>
          {members.map(m => (
            <button key={m.userId} type="button" onClick={() => { onChange(m.userId); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-muted ${value === m.userId ? 'bg-surface-muted' : ''}`}>
              {Row(m.userId, memberName(m.userId))}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
