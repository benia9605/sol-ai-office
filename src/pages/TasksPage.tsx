/**
 * @file src/pages/TasksPage.tsx
 * @description 할일 페이지
 * - 상단: [+ 추가] [정렬 ▼] [필터 ▼]
 * - 날짜 기준 그룹핑 리스트 뷰
 * - 추가 폼, ItemDetailPopup
 */
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TaskItem, TaskStatus, RepeatType, ScheduleCategory } from '../types';
import { useTasks } from '../hooks/useTasks';
import { defaultTaskCategories, categoryColorPresets } from '../data';
import { ItemDetailPopup } from '../components/ItemDetailPopup';
import { GoalSelect } from '../components/GoalSelect';
import { TaskListView } from '../components/tasks/TaskListView';
import { TaskKanbanView } from '../components/tasks/TaskKanbanView';
import { DailyRoutineSection } from '../components/tasks/DailyRoutineSection';
import { useDailyCompletions } from '../hooks/useDailyCompletions';
import { useProjects } from '../hooks/useProjects';
import { fetchAllGoals, GoalRow } from '../services/goals.service';

interface TasksLayoutContext {
  openRoom?: (room: unknown) => void;
  startPomodoro?: (task: TaskItem, workMin?: number, breakMin?: number) => void;
}

type ViewMode = 'list' | 'kanban';
type SortMode = 'deadline' | 'priority' | 'created' | 'name';

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <line x1="5" y1="3" x2="14" y2="3" /><line x1="5" y1="8" x2="14" y2="8" /><line x1="5" y1="13" x2="14" y2="13" />
    <circle cx="2" cy="3" r="1" fill="currentColor" stroke="none" /><circle cx="2" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="2" cy="13" r="1" fill="currentColor" stroke="none" />
  </svg>
);

const KanbanIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="2" width="4" height="12" rx="1" /><rect x="6" y="2" width="4" height="8" rx="1" /><rect x="11" y="2" width="4" height="10" rx="1" />
  </svg>
);

const viewTabs: { key: ViewMode; label: string; Icon: () => JSX.Element }[] = [
  { key: 'list',   label: '리스트', Icon: ListIcon },
  { key: 'kanban', label: '칸반',   Icon: KanbanIcon },
];

const repeatLabels: Record<RepeatType, string> = {
  none: '없음', daily: '매일', weekly: '매주', monthly: '매월', yearly: '매년',
};

const sortOptions: { key: SortMode; label: string }[] = [
  { key: 'deadline', label: '마감일순' },
  { key: 'priority', label: '우선순위순' },
  { key: 'created',  label: '생성일순' },
  { key: 'name',     label: '이름순' },
];

const statusFilterOptions: { key: string; label: string }[] = [
  { key: 'all',         label: '전체' },
  { key: 'pending',     label: '대기' },
  { key: 'in_progress', label: '진행중' },
  { key: 'completed',   label: '완료' },
];

const priorityWeight: Record<TaskItem['priority'], number> = { high: 0, medium: 1, low: 2 };

export function TasksPage() {
  const { tasks, loading, cycleStatus, updateStatus, toggleStar, add, remove, updateTask } = useTasks();
  const { toggleCompletion, isCompletedToday, completedCount: getDailyCompletedCount } = useDailyCompletions();
  const context = useOutletContext<TasksLayoutContext>() ?? {};
  const { projects } = useProjects();

  // 목표별 그룹핑용 전체 목표 데이터
  const [allGoals, setAllGoals] = useState<GoalRow[]>([]);
  useEffect(() => {
    fetchAllGoals().then(setAllGoals).catch(() => setAllGoals([]));
  }, []);

  // View / filter / sort state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('deadline');

  // Dropdown visibility
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    title: '', project: '', priority: 'medium' as TaskItem['priority'], date: '',
    category: '', notes: '', repeat: 'none' as RepeatType, goalId: undefined as string | undefined,
  });

  // Detail popup
  const [selectedItem, setSelectedItem] = useState<TaskItem | null>(null);

  // 선택 모드 + 일괄 편집
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkForm, setBulkForm] = useState<{
    goalId?: string; project?: string; priority?: TaskItem['priority'];
    date?: string; category?: string; status?: TaskStatus;
  }>({});
  const bulkEditRef = useRef<HTMLDivElement>(null);

  // Category management
  const [taskCategories, setTaskCategories] = useState(defaultTaskCategories);
  const [showFormCatManager, setShowFormCatManager] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatColor, setNewCatColor] = useState(categoryColorPresets[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const formColorInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSortDropdown(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilterDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAddCategory = () => {
    if (!newCatLabel.trim()) return;
    const newCat: ScheduleCategory = {
      id: `tcat-${Date.now()}`,
      label: newCatLabel.trim(),
      color: newCatColor,
    };
    setTaskCategories((prev) => [...prev, newCat]);
    setNewCatLabel('');
    setNewCatColor(categoryColorPresets[0]);
  };

  const handleRemoveCategory = (catId: string) => {
    setTaskCategories((prev) => prev.filter((c) => c.id !== catId));
  };

  // 매일 루틴 / 일반 태스크 분리
  const { dailyTasks, nonDailyTasks } = useMemo(() => {
    const daily: TaskItem[] = [];
    const nonDaily: TaskItem[] = [];
    tasks.forEach((t) => {
      if (t.repeat === 'daily') daily.push(t);
      else nonDaily.push(t);
    });
    return { dailyTasks: daily, nonDailyTasks: nonDaily };
  }, [tasks]);

  const dailyTaskIds = useMemo(() => dailyTasks.map((t) => t.id), [dailyTasks]);

  // Filter + sort pipeline (daily 제외)
  const filteredAndSortedTasks = useMemo(() => {
    let result = [...nonDailyTasks];

    // 1. Project filter
    if (projectFilter !== 'all') {
      result = result.filter((t) => t.project === projectFilter);
    }

    // 2. Status filter
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }

    // 3. Sort
    result.sort((a, b) => {
      if (sortMode === 'deadline') {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortMode === 'priority') {
        return priorityWeight[a.priority] - priorityWeight[b.priority];
      }
      if (sortMode === 'name') {
        return a.title.localeCompare(b.title, 'ko', { numeric: true });
      }
      // created - id 기반 역순 (최신 먼저)
      return b.id.localeCompare(a.id);
    });

    return result;
  }, [nonDailyTasks, projectFilter, statusFilter, sortMode]);

  const handleAdd = () => {
    if (!form.title.trim()) return;
    add({
      title: form.title,
      project: form.project,
      goalId: form.goalId,
      priority: form.priority,
      date: form.date || undefined,
      category: form.category || undefined,
      notes: form.notes || undefined,
      repeat: form.repeat !== 'none' ? form.repeat : undefined,
    });
    setForm({ title: '', project: '', priority: 'medium', date: '', category: '', notes: '', repeat: 'none', goalId: undefined });
    setShowForm(false);
    setShowAdvanced(false);
  };

  const handlePopupSave = (updated: TaskItem) => {
    updateTask(updated.id, updated);
    setSelectedItem(null);
  };

  const handlePopupDelete = (id: string) => {
    remove(id);
    setSelectedItem(null);
  };

  // Unique project names from tasks
  const projectNames = useMemo(() => {
    const names = new Set(tasks.map((t) => t.project).filter(Boolean));
    return Array.from(names);
  }, [tasks]);

  const hasActiveFilter = projectFilter !== 'all' || statusFilter !== 'all';

  // 선택 모드 토글
  const toggleSelectMode = useCallback(() => {
    setSelectMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
        setShowBulkEdit(false);
        setBulkForm({});
      }
      return !prev;
    });
  }, []);

  // 아이템 선택 토글
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // 전체 선택/해제
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredAndSortedTasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedTasks.map((t) => t.id)));
    }
  }, [selectedIds.size, filteredAndSortedTasks]);

  // 일괄 편집 적용
  const handleBulkApply = useCallback(async () => {
    const patch: Partial<TaskItem> = {};
    if (bulkForm.goalId !== undefined) { patch.goalId = bulkForm.goalId; patch.project = bulkForm.project || ''; }
    if (bulkForm.priority !== undefined) patch.priority = bulkForm.priority;
    if (bulkForm.date !== undefined) patch.date = bulkForm.date || undefined;
    if (bulkForm.category !== undefined) patch.category = bulkForm.category || undefined;
    if (bulkForm.status !== undefined) patch.status = bulkForm.status;

    if (Object.keys(patch).length === 0) return;

    for (const id of selectedIds) {
      await updateTask(id, patch);
    }

    setSelectMode(false);
    setSelectedIds(new Set());
    setShowBulkEdit(false);
    setBulkForm({});
  }, [bulkForm, selectedIds, updateTask]);

  // 일괄 편집 외부 클릭 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (bulkEditRef.current && !bulkEditRef.current.contains(e.target as Node)) {
        setShowBulkEdit(false);
      }
    };
    if (showBulkEdit) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showBulkEdit]);

  return (
    <div className="min-h-full bg-[#f1f9f1] p-4 sm:p-6 lg:p-8">
      <div className={viewMode === 'kanban' ? 'max-w-5xl mx-auto space-y-5' : 'max-w-3xl mx-auto space-y-5'}>

        {/* 상단: 타이틀 + 버튼들 */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <img src="/images/todo.png" alt="할일" className="w-6 h-6 object-contain" />
            할일
          </h1>
          <div className="flex items-center gap-2">
            {/* + 추가 */}
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-3 py-1.5 text-sm font-medium text-green-600 bg-white rounded-xl shadow-soft hover:shadow-hover transition-all"
            >
              + 추가
            </button>

            {/* 선택 */}
            <button
              onClick={toggleSelectMode}
              className={`px-3 py-1.5 text-sm rounded-xl shadow-soft hover:shadow-hover transition-all ${
                selectMode ? 'text-white bg-green-500 font-medium' : 'text-gray-600 bg-white'
              }`}
            >
              {selectMode ? '선택 해제' : '선택'}
            </button>

            {/* 정렬 ▼ */}
            <div ref={sortRef} className="relative">
              <button
                onClick={() => { setShowSortDropdown(!showSortDropdown); setShowFilterDropdown(false); }}
                className="px-3 py-1.5 text-sm text-gray-600 bg-white rounded-xl shadow-soft hover:shadow-hover transition-all"
              >
                정렬 ▼
              </button>
              {showSortDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 min-w-[120px]">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortMode(opt.key); setShowSortDropdown(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        sortMode === opt.key ? 'text-green-600 bg-green-50 font-medium' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 필터 ▼ */}
            <div ref={filterRef} className="relative">
              <button
                onClick={() => { setShowFilterDropdown(!showFilterDropdown); setShowSortDropdown(false); }}
                className={`px-3 py-1.5 text-sm rounded-xl shadow-soft hover:shadow-hover transition-all ${
                  hasActiveFilter ? 'text-green-600 bg-green-50 font-medium' : 'text-gray-600 bg-white'
                }`}
              >
                필터 ▼
              </button>
              {showFilterDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 p-4 z-20 min-w-[220px] space-y-3">
                  {/* 프로젝트별 */}
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1.5 block">프로젝트별</label>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setProjectFilter('all')}
                        className={`px-2.5 py-1 text-xs rounded-full transition-all ${
                          projectFilter === 'all' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        전체
                      </button>
                      {projectNames.map((name) => (
                        <button
                          key={name}
                          onClick={() => setProjectFilter(projectFilter === name ? 'all' : name)}
                          className={`px-2.5 py-1 text-xs rounded-full transition-all ${
                            projectFilter === name ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* 상태별 */}
                  <div>
                    <label className="text-xs text-gray-500 font-medium mb-1.5 block">상태별</label>
                    <div className="flex flex-wrap gap-1.5">
                      {statusFilterOptions.map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => setStatusFilter(statusFilter === opt.key ? 'all' : opt.key)}
                          className={`px-2.5 py-1 text-xs rounded-full transition-all ${
                            statusFilter === opt.key ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* 필터 초기화 */}
                  {hasActiveFilter && (
                    <button
                      onClick={() => { setProjectFilter('all'); setStatusFilter('all'); }}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      필터 초기화
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 추가 폼 */}
        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-soft space-y-5">
            {/* 제목 */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">제목</label>
              <input
                type="text" placeholder="할일 제목" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
              />
            </div>

            {/* 상위 목표 & 중요도 */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_7rem] gap-2 sm:gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">상위 목표</label>
                <GoalSelect value={form.goalId} onChange={(goalId, projectName) => setForm({ ...form, goalId, project: projectName || '' })} />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">중요도</label>
                <select
                  value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as TaskItem['priority'] })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                >
                  <option value="high">높음</option>
                  <option value="medium">보통</option>
                  <option value="low">낮음</option>
                </select>
              </div>
            </div>

            {/* 카테고리 칩 */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">종류</label>
                <button onClick={() => setShowFormCatManager(!showFormCatManager)}
                  className="text-xs text-green-500 hover:text-green-600">
                  {showFormCatManager ? '닫기' : '관리'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {taskCategories.map((cat) => (
                  <button key={cat.id}
                    onClick={() => setForm({ ...form, category: form.category === cat.id ? '' : cat.id })}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      form.category === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={form.category === cat.id ? { backgroundColor: cat.color } : undefined}>
                    {cat.label}
                  </button>
                ))}
              </div>
              {showFormCatManager && (
                <div className="mt-2 p-3 bg-gray-50 rounded-xl space-y-2">
                  <div className="flex gap-2">
                    <input type="text" placeholder="새 카테고리 이름" value={newCatLabel}
                      onChange={(e) => setNewCatLabel(e.target.value)}
                      className="flex-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-200" />
                    <button onClick={handleAddCategory} disabled={!newCatLabel.trim()}
                      className="px-2 py-1.5 text-xs text-white bg-green-400 hover:bg-green-500 rounded-lg disabled:opacity-40">추가</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {categoryColorPresets.map((c) => (
                      <button key={c}
                        onClick={() => setNewCatColor(c)}
                        onDoubleClick={() => { setShowColorPicker(true); setTimeout(() => formColorInputRef.current?.click(), 0); }}
                        className={`w-6 h-6 rounded-full transition-all ${newCatColor === c ? 'ring-2 ring-offset-1 ring-gray-600' : ''}`}
                        style={{ backgroundColor: c }}
                        title="더블클릭: 커스텀 컬러" />
                    ))}
                    <div className="relative">
                      <button
                        onClick={() => { setShowColorPicker(true); setTimeout(() => formColorInputRef.current?.click(), 0); }}
                        className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-600 text-xs"
                        title="직접 색상 선택"
                      >+</button>
                      <input
                        ref={formColorInputRef}
                        type="color"
                        value={newCatColor}
                        onChange={(e) => setNewCatColor(e.target.value)}
                        className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
                      />
                    </div>
                    {showColorPicker && (
                      <span className="text-xs text-gray-400 ml-1">선택: {newCatColor}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {taskCategories.map((cat) => (
                      <span key={cat.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-white rounded-full border">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.label}
                        <button onClick={() => handleRemoveCategory(cat.id)} className="text-gray-400 hover:text-red-500 ml-0.5">x</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">마감일</label>
              <input type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
            </div>

            {/* 더 보기 토글 */}
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              {showAdvanced ? '간단히 보기 ▲' : '더 보기 (메모/반복) ▼'}
            </button>

            {showAdvanced && (
              <div className="space-y-5">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">메모</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                    placeholder="메모를 입력하세요"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-200" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">반복</label>
                  <select value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value as RepeatType })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200">
                    {Object.entries(repeatLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowForm(false); setShowAdvanced(false); }} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-xl">취소</button>
              <button onClick={handleAdd} className="px-4 py-2 text-sm text-white bg-green-500 hover:bg-green-600 rounded-xl font-medium">추가</button>
            </div>
          </div>
        )}

        {/* 선택 모드 툴바 */}
        {selectMode && (
          <div className="bg-white rounded-2xl shadow-soft px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                {selectedIds.size}개 선택됨
              </span>
              <button
                onClick={handleSelectAll}
                className="text-xs text-green-600 hover:text-green-700 font-medium"
              >
                {selectedIds.size === filteredAndSortedTasks.length ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div className="relative" ref={bulkEditRef}>
              <button
                onClick={() => setShowBulkEdit(!showBulkEdit)}
                disabled={selectedIds.size === 0}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                일괄 편집
              </button>

              {/* 일괄 편집 패널 */}
              {showBulkEdit && selectedIds.size > 0 && (
                <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-lg border border-gray-100 p-4 z-30 w-[320px] space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700">{selectedIds.size}개 항목 일괄 편집</h3>

                  {/* 목표 */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">목표</label>
                    <GoalSelect
                      value={bulkForm.goalId}
                      onChange={(goalId, projectName) => setBulkForm({ ...bulkForm, goalId, project: projectName || '' })}
                    />
                  </div>

                  {/* 중요도 */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">중요도</label>
                    <div className="flex gap-1.5">
                      {([['high', '높음'], ['medium', '보통'], ['low', '낮음']] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setBulkForm({ ...bulkForm, priority: bulkForm.priority === key ? undefined : key })}
                          className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                            bulkForm.priority === key
                              ? 'bg-green-500 text-white font-medium'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 날짜 */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">마감일</label>
                    <input
                      type="date"
                      value={bulkForm.date ?? ''}
                      onChange={(e) => setBulkForm({ ...bulkForm, date: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
                    />
                  </div>

                  {/* 종류 (카테고리) */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">종류</label>
                    <div className="flex flex-wrap gap-1.5">
                      {taskCategories.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setBulkForm({ ...bulkForm, category: bulkForm.category === cat.id ? undefined : cat.id })}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                            bulkForm.category === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          style={bulkForm.category === cat.id ? { backgroundColor: cat.color } : undefined}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 상태 */}
                  <div>
                    <label className="text-xs text-gray-500 mb-1.5 block">상태</label>
                    <div className="flex gap-1.5">
                      {([['pending', '대기'], ['in_progress', '진행중'], ['completed', '완료']] as const).map(([key, label]) => (
                        <button
                          key={key}
                          onClick={() => setBulkForm({ ...bulkForm, status: bulkForm.status === key ? undefined : key })}
                          className={`px-3 py-1.5 text-xs rounded-full transition-all ${
                            bulkForm.status === key
                              ? 'bg-green-500 text-white font-medium'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 적용 버튼 */}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => { setShowBulkEdit(false); setBulkForm({}); }}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-xl"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleBulkApply}
                      disabled={Object.values(bulkForm).every((v) => v === undefined)}
                      className="px-4 py-1.5 text-xs text-white bg-green-500 hover:bg-green-600 rounded-xl font-medium disabled:opacity-40"
                    >
                      적용
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 매일 루틴 섹션 */}
        {!loading && dailyTasks.length > 0 && (
          <DailyRoutineSection
            dailyTasks={dailyTasks}
            isCompletedToday={isCompletedToday}
            toggleCompletion={toggleCompletion}
            completedCount={getDailyCompletedCount(dailyTaskIds)}
            totalCount={dailyTasks.length}
            onSelect={setSelectedItem}
          />
        )}

        {/* 뷰 탭 */}
        <div className="flex items-center gap-1 bg-white rounded-2xl p-1.5 shadow-soft">
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl transition-all ${
                viewMode === tab.key
                  ? 'bg-green-50 text-green-600 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.Icon />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 뷰 콘텐츠 */}
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-8">불러오는 중...</p>
        ) : (
          <>
            {viewMode === 'list' && (
              <TaskListView
                tasks={filteredAndSortedTasks}
                categories={taskCategories}
                onCycleStatus={cycleStatus}
                onToggleStar={toggleStar}
                onStartPomodoro={context.startPomodoro}
                onSelect={setSelectedItem}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                goals={allGoals}
                projects={projects}
              />
            )}
            {viewMode === 'kanban' && (
              <TaskKanbanView
                tasks={filteredAndSortedTasks}
                categories={taskCategories}
                goals={allGoals}
                onUpdateStatus={updateStatus}
                onCycleStatus={cycleStatus}
                onToggleStar={toggleStar}
                onStartPomodoro={context.startPomodoro}
                onSelect={setSelectedItem}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
              />
            )}
          </>
        )}
      </div>

      {/* 상세 팝업 */}
      {selectedItem && (
        <ItemDetailPopup
          type="task"
          item={selectedItem}
          categories={taskCategories}
          onSave={(updated) => handlePopupSave(updated as TaskItem)}
          onQuickUpdate={(updated) => { updateTask((updated as TaskItem).id, updated as TaskItem); setSelectedItem(updated as TaskItem); }}
          onDelete={handlePopupDelete}
          onClose={() => setSelectedItem(null)}
          onCategoriesChange={setTaskCategories}
          onStartPomodoro={context.startPomodoro}
        />
      )}
    </div>
  );
}
