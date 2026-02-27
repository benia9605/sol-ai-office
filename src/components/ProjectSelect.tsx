/**
 * @file src/components/ProjectSelect.tsx
 * @description 프로젝트 선택 커스텀 드롭다운
 * - 프로젝트 이미지 + 이름 표시
 * - 네이티브 select 대체
 */
import { useState, useRef, useEffect } from 'react';
import { useProjects } from '../hooks/useProjects';

interface ProjectSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function ProjectSelect({ value, onChange, placeholder = '프로젝트 선택', className = '' }: ProjectSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { projects } = useProjects();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = projects.find((p) => p.name === value);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left focus:outline-none focus:ring-2 focus:ring-purple-200"
      >
        {selected ? (
          <>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selected.color }} />
            {selected.image
              ? <img src={selected.image} alt={selected.name} className="w-4 h-4 object-contain flex-shrink-0" />
              : <span className="text-sm flex-shrink-0">{selected.emoji}</span>}
            <span className="text-gray-700 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-gray-400">{placeholder}</span>
        )}
        <svg className="w-3.5 h-3.5 text-gray-400 ml-auto flex-shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-48 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${!value ? 'bg-gray-50 font-medium' : ''}`}
          >
            <span className="text-gray-400">{placeholder}</span>
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange(p.name); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 ${value === p.name ? 'bg-gray-50 font-medium' : ''}`}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
              {p.image
                ? <img src={p.image} alt={p.name} className="w-4 h-4 object-contain flex-shrink-0" />
                : <span className="text-sm flex-shrink-0">{p.emoji}</span>}
              <span className="text-gray-700">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
