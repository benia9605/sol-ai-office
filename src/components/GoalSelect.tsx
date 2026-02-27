/**
 * @file src/components/GoalSelect.tsx
 * @description 상위 목표 선택 드롭다운
 * - 프로젝트 > 목표 계층 구조로 표시
 * - 각 목표 옆에 진행률(%) 표시
 * - 검색 기능으로 목표 필터링
 * - goalId 기반 선택/해제
 * - 할일 추가/편집 시 사용
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useProjects } from '../hooks/useProjects';
import { fetchAllGoals, GoalRow } from '../services/goals.service';
import { Project } from '../types';

interface GoalSelectProps {
  value?: string;           // goalId
  onChange: (goalId: string | undefined, projectName?: string) => void;
  className?: string;
}

interface GoalOption {
  id: string;
  title: string;
  projectId: string;
  progress: number;
  status: string;
}

export function GoalSelect({ value, onChange, className = '' }: GoalSelectProps) {
  const { projects } = useProjects();
  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const loadGoals = useCallback(async () => {
    try {
      const rows = await fetchAllGoals();
      setGoals(rows.map((r: GoalRow) => ({
        id: r.id,
        title: r.title,
        projectId: r.project_id,
        progress: r.progress ?? 0,
        status: r.status ?? 'pending',
      })));
    } catch {
      setGoals([]);
    }
  }, []);

  useEffect(() => { loadGoals(); }, [loadGoals]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const closeDropdown = () => {
    setOpen(false);
    setSearch('');
  };

  const selectedGoal = goals.find((g) => g.id === value);
  const selectedProject = selectedGoal ? projects.find((p) => p.id === selectedGoal.projectId) : null;

  const statusLabel: Record<string, string> = {
    pending: '대기', in_progress: '진행 중', completed: '완료', on_hold: '보류',
  };

  const displayText = selectedGoal
    ? `${selectedGoal.title} (${statusLabel[selectedGoal.status] || '대기'})`
    : '목표 없음';

  // Filter goals by search, then group by project
  const filteredGoals = search.trim()
    ? goals.filter((g) => g.title.toLowerCase().includes(search.trim().toLowerCase()))
    : goals;

  const grouped = projects
    .map((p: Project) => ({
      project: p,
      goals: filteredGoals.filter((g) => g.projectId === p.id),
    }))
    .filter((g) => g.goals.length > 0);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-left focus:outline-none focus:ring-2 focus:ring-green-200 flex items-center gap-2"
      >
        {selectedProject && (
          selectedProject.image
            ? <img src={selectedProject.image} alt={selectedProject.name} className="w-4 h-4 object-contain flex-shrink-0" />
            : <span className="text-sm flex-shrink-0">{selectedProject.emoji}</span>
        )}
        <span className={`flex-1 truncate ${value ? 'text-gray-800' : 'text-gray-400'}`}>{displayText}</span>
        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 z-30 max-h-60 overflow-y-auto">
          {/* 검색 */}
          <div className="px-3 pt-2 pb-1 sticky top-0 bg-white z-10">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="목표 검색..."
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-200"
              autoFocus
            />
          </div>

          {/* 목표 없음 */}
          <button
            onClick={() => { onChange(undefined, undefined); closeDropdown(); }}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
              !value ? 'text-green-600 bg-green-50 font-medium' : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            목표 없음
          </button>

          {grouped.length > 0 && (
            <div className="border-t border-gray-100 mt-1 pt-1">
              {grouped.map(({ project: p, goals: pGoals }) => (
                <div key={p.id}>
                  {/* 프로젝트 헤더 */}
                  <div className="px-4 py-1.5 text-xs text-gray-400 font-medium flex items-center gap-1.5">
                    {p.image
                      ? <img src={p.image} alt={p.name} className="w-3.5 h-3.5 object-contain" />
                      : <span>{p.emoji}</span>}
                    {p.name}
                  </div>
                  {/* 목표들 */}
                  {pGoals.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => { onChange(g.id, p.name); closeDropdown(); }}
                      className={`w-full text-left pl-8 pr-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                        value === g.id ? 'text-green-600 bg-green-50 font-medium' : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="flex-1 truncate">{g.title}</span>
                      <span className={`text-[10px] font-medium flex-shrink-0 px-1.5 py-0.5 rounded-full ${
                        g.status === 'completed' ? 'bg-green-100 text-green-600'
                          : g.status === 'in_progress' ? 'bg-blue-100 text-blue-600'
                          : g.status === 'on_hold' ? 'bg-amber-100 text-amber-600'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {statusLabel[g.status] || '대기'}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          {grouped.length === 0 && !search.trim() && (
            <p className="px-4 py-2 text-xs text-gray-400">프로젝트에 목표를 먼저 추가하세요</p>
          )}
          {grouped.length === 0 && search.trim() && (
            <p className="px-4 py-2 text-xs text-gray-400">검색 결과가 없습니다</p>
          )}
        </div>
      )}
    </div>
  );
}
