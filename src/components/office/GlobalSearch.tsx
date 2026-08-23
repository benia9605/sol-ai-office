/**
 * @file src/components/office/GlobalSearch.tsx
 * @description 오피스 전체 검색 오버레이 — 상단바 검색 아이콘으로 열림
 * - 입력하면 할일·인사이트·기록·회의·콘텐츠를 통합 검색, 종류별 hairline 리스트로.
 * - 결과 클릭 → 해당 상세 화면으로 이동(onNavigate) + 닫힘.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Workspace } from '../../types';
import { searchWorkspace, SearchResult, SearchType, SEARCH_BASE, SEARCH_LABEL } from '../../services/search.service';
import { NavIcon } from './NavIcons';

const ICON_OF: Record<SearchType, string> = { task: 'todos', insight: 'insights', record: 'log', meeting: 'meetings', content: 'contents' };

export function GlobalSearch({ workspace, onNavigate, onClose }: {
  workspace: Workspace; onNavigate: (v: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // 디바운스 검색
  useEffect(() => {
    const term = q.trim();
    if (!term) { setResults([]); setSearched(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      searchWorkspace(workspace.id, term)
        .then(r => setResults(r))
        .catch(() => setResults([]))
        .finally(() => { setLoading(false); setSearched(true); });
    }, 250);
    return () => clearTimeout(t);
  }, [q, workspace.id]);

  const go = (r: SearchResult) => { onNavigate(`${SEARCH_BASE[r.type]}/${r.id}`); onClose(); };

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-[2px] flex items-start justify-center pt-[10vh] px-4" onMouseDown={onClose}>
      <div className="bg-surface rounded-2xl border border-line w-full max-w-xl max-h-[75vh] overflow-hidden flex flex-col shadow-2xl" onMouseDown={e => e.stopPropagation()}>
        {/* 검색 입력 */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-foreground-faint flex-shrink-0"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="오피스 전체 검색 — 할일·인사이트·기록·회의·콘텐츠"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-faint focus:outline-none" />
          <button onClick={onClose} className="text-xs text-foreground-faint hover:text-foreground flex-shrink-0">ESC</button>
        </div>

        {/* 결과 */}
        <div className="overflow-y-auto">
          {!q.trim() ? (
            <p className="text-sm text-foreground-faint py-12 text-center">검색어를 입력하세요.</p>
          ) : loading ? (
            <p className="text-sm text-foreground-faint py-12 text-center">검색 중…</p>
          ) : results.length === 0 ? (
            searched ? <p className="text-sm text-foreground-faint py-12 text-center">‘{q.trim()}’ 결과가 없어요.</p> : null
          ) : (
            <ul className="divide-y divide-line">
              {results.map(r => (
                <li key={`${r.type}-${r.id}`}>
                  <button onClick={() => go(r)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-muted transition-colors text-left">
                    <NavIcon id={ICON_OF[r.type]} size={16} className="text-foreground-faint flex-shrink-0" />
                    <span className="text-sm text-foreground truncate flex-1">{r.title}</span>
                    <span className="text-[11px] text-foreground-faint flex-shrink-0">{SEARCH_LABEL[r.type]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
