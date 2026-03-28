/**
 * @file src/pages/TasksPage.tsx
 * @description 할일 페이지
 * - 상단: [+ 추가] [정렬 ▼] [필터 ▼]
 * - 날짜 기준 그룹핑 리스트 뷰
 * - 추가 폼, ItemDetailPopup
 */
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { TaskItem, ScheduleItem, TaskStatus, RepeatType, ScheduleCategory } from '../types';
import { useTasks } from '../hooks/useTasks';
import { defaultTaskCategories, categoryColorPresets, defaultScheduleCategories } from '../data';
import { ItemDetailPopup } from '../components/ItemDetailPopup';
import { GoalSelect } from '../components/GoalSelect';
import { TaskListView } from '../components/tasks/TaskListView';
import { TaskKanbanView } from '../components/tasks/TaskKanbanView';
import { useDailyCompletions } from '../hooks/useDailyCompletions';
import { useProjects } from '../hooks/useProjects';
import { useSchedules } from '../hooks/useSchedules';
import { fetchAllGoals, GoalRow } from '../services/goals.service';
import { SortableCategoryList } from '../components/SortableCategoryChip';
import { CalendarView } from '../components/calendar/CalendarView';
import { getTodayStr, getTomorrowStr } from '../utils/dateCalc';

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
  const { schedules, update: updateSchedule } = useSchedules();
  const { toggleCompletion, isCompletedToday, completedCount: getDailyCompletedCount } = useDailyCompletions();
  const context = useOutletContext<TasksLayoutContext>() ?? {};
  const { projects } = useProjects();
  const [scheduleCategories] = useState(defaultScheduleCategories);

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

  // 검색
  const [searchQuery, setSearchQuery] = useState('');

  // Calendar toggle
  const [showCalendar, setShowCalendar] = useState(true);

  // 빠른 추가
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const quickAddRef = useRef<HTMLInputElement>(null);

  // 모바일 루틴 접기
  const [routineExpanded, setRoutineExpanded] = useState(false);

  // Detail popup
  const [selectedItem, setSelectedItem] = useState<TaskItem | null>(null);
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<ScheduleItem | null>(null);

  // 선택 모드 + 일괄 편집
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkForm, setBulkForm] = useState<{
    goalId?: string; project?: string; priority?: TaskItem['priority'];
    date?: string; category?: string; status?: TaskStatus;
  }>({});
  const bulkEditRef = useRef<HTMLDivElement>(null);
  const bulkEditPanelRef = useRef<HTMLDivElement>(null);

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

    // 3. Search filter (제목, 카테고리, 메모, 태그)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((t) => {
        if (t.title.toLowerCase().includes(q)) return true;
        if (t.notes?.toLowerCase().includes(q)) return true;
        if (t.tags?.some((tag) => tag.toLowerCase().includes(q))) return true;
        if (t.category) {
          const cat = taskCategories.find((c) => c.id === t.category);
          if (cat?.label.toLowerCase().includes(q)) return true;
        }
        return false;
      });
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
  }, [nonDailyTasks, projectFilter, statusFilter, sortMode, searchQuery, taskCategories]);

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

  const handleQuickAdd = () => {
    if (!quickTitle.trim()) return;
    add({
      title: quickTitle.trim(),
      project: '',
      priority: 'medium',
      status: 'pending',
      starred: false,
      date: getTodayStr(),
    });
    setQuickTitle('');
    // 입력창 유지 (연속 추가)
    setTimeout(() => quickAddRef.current?.focus(), 50);
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

  // 일괄 삭제
  const handleBulkDelete = useCallback(async () => {
    if (!window.confirm(`${selectedIds.size}개 할일을 삭제하시겠습니까?`)) return;
    for (const id of selectedIds) {
      await remove(id);
    }
    setSelectMode(false);
    setSelectedIds(new Set());
    setShowBulkEdit(false);
    setBulkForm({});
  }, [selectedIds, remove]);

  // 일괄 편집 외부 클릭 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        bulkEditRef.current && !bulkEditRef.current.contains(target) &&
        bulkEditPanelRef.current && !bulkEditPanelRef.current.contains(target)
      ) {
        setShowBulkEdit(false);
      }
    };
    if (showBulkEdit) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showBulkEdit]);

  return (
    <div className="min-h-full bg-[#f1f9f1] p-4 sm:p-6 lg:p-8">
      <div className={`mx-auto lg:flex lg:gap-3 ${viewMode === 'kanban' ? 'max-w-5xl lg:max-w-[76rem]' : 'max-w-3xl lg:max-w-[60rem]'}`}>
      <div className={`flex-1 min-w-0 space-y-5 ${viewMode === 'kanban' ? 'max-w-5xl' : 'max-w-3xl'} mx-auto`}>

        {/* 상단: 타이틀 + 추가 버튼 */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <img src="/images/todo.png" alt="할일" className="w-6 h-6 object-contain" />
            할일
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            {/* 캘린더 토글 */}
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className={`px-2.5 py-1 text-xs rounded-lg shadow-soft hover:shadow-hover transition-all ${
                showCalendar ? 'text-white bg-green-500 font-medium' : 'text-gray-600 bg-white'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="inline -mt-0.5 mr-0.5">
                <rect x="2" y="3" width="12" height="11" rx="1.5" /><line x1="2" y1="7" x2="14" y2="7" /><line x1="5.5" y1="1.5" x2="5.5" y2="4.5" /><line x1="10.5" y1="1.5" x2="10.5" y2="4.5" />
              </svg>
              캘린더
            </button>

            {/* ⚡ 빠른 추가 */}
            <button
              onClick={() => { setShowQuickAdd(!showQuickAdd); setShowForm(false); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg shadow-soft hover:shadow-hover transition-all ${showQuickAdd ? 'text-white bg-green-500' : 'text-green-600 bg-white'}`}
            >
              + 빠른
            </button>

            {/* 📋 상세 추가 */}
            <button
              onClick={() => { setShowForm(!showForm); setShowQuickAdd(false); }}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg shadow-soft hover:shadow-hover transition-all ${showForm ? 'text-white bg-green-500' : 'text-green-600 bg-white'}`}
            >
              + 상세
            </button>
          </div>
        </div>

        {/* 빠른 추가 인라인 */}
        {showQuickAdd && (
          <div className="flex gap-2">
            <input
              ref={quickAddRef}
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter' && quickTitle.trim()) handleQuickAdd(); if (e.key === 'Escape') { setShowQuickAdd(false); setQuickTitle(''); } }}
              placeholder="할일 제목을 입력하세요 (Enter로 추가)"
              className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200 shadow-soft"
              autoFocus
            />
            <button
              onClick={handleQuickAdd}
              disabled={!quickTitle.trim()}
              className="px-4 py-2.5 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-2xl shadow-soft disabled:opacity-40 transition-colors"
            >
              추가
            </button>
          </div>
        )}

        {/* 추가 폼 */}
        {showForm && (
          <div className="bg-white rounded-2xl p-4 shadow-soft space-y-5">
            {/* 제목 */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">제목</label>
              <input
                type="text" placeholder="할일 제목" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
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
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200"
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
                <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
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
                  <SortableCategoryList
                    categories={taskCategories}
                    onReorder={setTaskCategories}
                    onRemove={handleRemoveCategory}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-500 mb-1 block">마감일</label>
              <input type="date" value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
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
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-200" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">반복</label>
                  <select value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value as RepeatType })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200">
                    {Object.entries(repeatLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowForm(false); setShowAdvanced(false); }} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg">취소</button>
              <button onClick={handleAdd} className="px-4 py-2 text-sm text-white bg-green-500 hover:bg-green-600 rounded-lg font-medium">추가</button>
            </div>
          </div>
        )}

        {/* 모바일: 접이식 루틴 바 */}
        {!loading && dailyTasks.length > 0 && (
          <div className="lg:hidden">
            <button
              onClick={() => setRoutineExpanded(!routineExpanded)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-green-50 rounded-2xl shadow-soft"
            >
              <span className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-green-500">
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 4v4l2.5 1.5" />
                </svg>
                오늘 루틴
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xs font-medium text-green-600 bg-white/70 px-2 py-0.5 rounded-full">
                  {getDailyCompletedCount(dailyTaskIds)}/{dailyTasks.length} 완료
                </span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-green-500 transition-transform duration-200 ${routineExpanded ? 'rotate-180' : ''}`}
                >
                  <path d="M3 5l4 4 4-4" />
                </svg>
              </span>
            </button>
            {routineExpanded && (
              <div className="mt-1 bg-green-50 rounded-2xl shadow-soft p-3 space-y-1">
                {dailyTasks.map((task) => {
                  const checked = isCompletedToday(task.id);
                  return (
                    <div key={task.id} className="flex items-center gap-3 py-1.5 px-1 rounded-lg hover:bg-white/50 transition-colors cursor-pointer">
                      <button onClick={() => toggleCompletion(task.id)} className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                        <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
                          {checked ? (
                            <>
                              <circle cx="10" cy="10" r="9" fill="#4ade80" stroke="#22c55e" strokeWidth="1" />
                              <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </>
                          ) : (
                            <circle cx="10" cy="10" r="9" fill="white" stroke="#d1d5db" strokeWidth="1.5" />
                          )}
                        </svg>
                      </button>
                      <span onClick={() => setSelectedItem(task)}
                        className={`flex-1 text-sm leading-5 transition-all ${checked ? 'text-gray-400 line-through' : 'text-gray-700'}`}
                      >{task.title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 캘린더 */}
        {showCalendar && (
          <CalendarView
            mode="tasks"
            tasks={tasks}
            schedules={schedules}
            taskCategories={taskCategories}
            scheduleCategories={scheduleCategories}
            onTaskClick={setSelectedItem}
            onScheduleClick={setSelectedScheduleItem}
            onTaskDateChange={(id, date) => updateTask(id, { date })}
            onScheduleDateChange={(id, date) => updateSchedule(id, { date })}
            onTaskStatusCycle={cycleStatus}
          />
        )}

        {/* 필터/선택 + 검색 */}
        <div className="space-y-1.5">
        <div className="flex items-center justify-end gap-2">
          {/* 필터 */}
          <div ref={filterRef} className="relative">
            <button
              onClick={() => { setShowFilterDropdown(!showFilterDropdown); setShowSortDropdown(false); }}
              className={`px-2.5 py-1 text-xs rounded-lg shadow-soft hover:shadow-hover transition-all flex items-center gap-1 ${
                hasActiveFilter ? 'text-green-600 bg-green-50 font-medium' : 'text-gray-600 bg-white'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="2" y1="4" x2="14" y2="4" /><line x1="4" y1="8" x2="12" y2="8" /><line x1="6" y1="12" x2="10" y2="12" /></svg>
              필터
            </button>
            {showFilterDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-100 p-4 z-20 min-w-[220px] space-y-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1.5 block">프로젝트별</label>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setProjectFilter('all')} className={`px-2.5 py-1 text-xs rounded-full transition-all ${projectFilter === 'all' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>전체</button>
                    {projectNames.map((name) => (
                      <button key={name} onClick={() => setProjectFilter(projectFilter === name ? 'all' : name)} className={`px-2.5 py-1 text-xs rounded-full transition-all ${projectFilter === name ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{name}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1.5 block">상태별</label>
                  <div className="flex flex-wrap gap-1.5">
                    {statusFilterOptions.map((opt) => (
                      <button key={opt.key} onClick={() => setStatusFilter(statusFilter === opt.key ? 'all' : opt.key)} className={`px-2.5 py-1 text-xs rounded-full transition-all ${statusFilter === opt.key ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{opt.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1.5 block">정렬</label>
                  <div className="flex flex-wrap gap-1.5">
                    {sortOptions.map((opt) => (
                      <button key={opt.key} onClick={() => setSortMode(opt.key)} className={`px-2.5 py-1 text-xs rounded-full transition-all ${sortMode === opt.key ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>{opt.label}</button>
                    ))}
                  </div>
                </div>
                {hasActiveFilter && (
                  <button onClick={() => { setProjectFilter('all'); setStatusFilter('all'); }} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">필터 초기화</button>
                )}
              </div>
            )}
          </div>

          {/* 선택 / 취소 */}
          <button
            onClick={toggleSelectMode}
            className={`px-2.5 py-1 text-xs rounded-lg shadow-soft hover:shadow-hover transition-all ${
              selectMode ? 'text-white bg-green-500 font-medium' : 'text-gray-600 bg-white'
            }`}
          >
            {selectMode ? '취소' : '선택'}
          </button>
        </div>
        <div className="relative">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2">
            <circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14" y2="14" />
          </svg>
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="제목, 카테고리, 메모, 태그 검색"
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-200 shadow-soft"
          />
        </div>
        </div>

        {/* 선택 모드 액션 바 */}
        {selectMode && (
          <div className="bg-green-50 rounded-lg px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="text-xs text-green-700 hover:text-green-800 font-medium bg-white/70 px-2.5 py-1 rounded-lg"
              >
                {selectedIds.size === filteredAndSortedTasks.length ? '전체 해제' : '전체 선택'}
              </button>
              <span className="text-xs text-green-700 font-medium">{selectedIds.size}건 선택</span>
            </div>
            <div className="flex items-center gap-2" ref={bulkEditRef}>
              <button
                onClick={() => setShowBulkEdit(!showBulkEdit)}
                disabled={selectedIds.size === 0}
                className="px-3 py-1.5 text-xs font-medium text-green-700 bg-white border border-green-200 hover:bg-green-50 rounded-lg transition-all disabled:opacity-40"
              >
                수정
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0}
                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-all disabled:opacity-40"
              >
                삭제
              </button>
            </div>
          </div>
        )}

        {/* 일괄 수정 패널 */}
        {showBulkEdit && selectMode && selectedIds.size > 0 && (
          <div ref={bulkEditPanelRef} className="bg-white rounded-lg shadow-lg border border-gray-100 p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">{selectedIds.size}개 항목 일괄 수정</h3>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">목표</label>
              <GoalSelect value={bulkForm.goalId} onChange={(goalId, projectName) => setBulkForm({ ...bulkForm, goalId, project: projectName || '' })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">중요도</label>
              <div className="flex gap-1.5">
                {([['high', '높음'], ['medium', '보통'], ['low', '낮음']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setBulkForm({ ...bulkForm, priority: bulkForm.priority === key ? undefined : key })} className={`px-3 py-1.5 text-xs rounded-full transition-all ${bulkForm.priority === key ? 'bg-green-500 text-white font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">마감일</label>
              <input type="date" value={bulkForm.date ?? ''} onChange={(e) => setBulkForm({ ...bulkForm, date: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-200" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">종류</label>
              <div className="flex flex-wrap gap-1.5">
                {taskCategories.map((cat) => (
                  <button key={cat.id} onClick={() => setBulkForm({ ...bulkForm, category: bulkForm.category === cat.id ? undefined : cat.id })} className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${bulkForm.category === cat.id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`} style={bulkForm.category === cat.id ? { backgroundColor: cat.color } : undefined}>{cat.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">상태</label>
              <div className="flex gap-1.5">
                {([['pending', '대기'], ['in_progress', '진행중'], ['completed', '완료']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setBulkForm({ ...bulkForm, status: bulkForm.status === key ? undefined : key })} className={`px-3 py-1.5 text-xs rounded-full transition-all ${bulkForm.status === key ? 'bg-green-500 text-white font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => { setShowBulkEdit(false); setBulkForm({}); }} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">닫기</button>
              <button onClick={handleBulkApply} disabled={Object.values(bulkForm).every((v) => v === undefined)} className="px-4 py-1.5 text-xs text-white bg-green-500 hover:bg-green-600 rounded-lg font-medium disabled:opacity-40">적용</button>
            </div>
          </div>
        )}

        {/* 뷰 탭 */}
        <div className="flex items-center gap-1 bg-white rounded-2xl p-1.5 shadow-soft">
          {viewTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
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
                onStartPomodoro={context.startPomodoro}
                onSelect={setSelectedItem}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                goals={allGoals}
                projects={projects}
                onUpdateTitle={(id, title) => updateTask(id, { title })}
                onPostpone={(id) => updateTask(id, { date: getTomorrowStr() })}
                onMoveToToday={(id) => updateTask(id, { date: getTodayStr() })}
              />
            )}
            {viewMode === 'kanban' && (
              <TaskKanbanView
                tasks={filteredAndSortedTasks}
                categories={taskCategories}
                goals={allGoals}
                onUpdateStatus={updateStatus}
                onCycleStatus={cycleStatus}
                onSelect={setSelectedItem}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
              />
            )}
          </>
        )}
      </div>

      {/* 매일 루틴 오른쪽 배너 (PC only) */}
      {!loading && dailyTasks.length > 0 && (
        <div className="hidden lg:block lg:w-52 flex-shrink-0 pt-[3.25rem]">
          <div className="sticky top-8">
            <div className="bg-green-50 rounded-2xl shadow-soft p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-green-800 flex items-center gap-1.5">
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-green-600">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 4v4l2.5 1.5" />
                  </svg>
                  매일 루틴
                </h3>
                <span className="text-xs text-green-700 font-semibold">
                  {getDailyCompletedCount(dailyTaskIds)}/{dailyTasks.length}
                </span>
              </div>
              <div className="h-1.5 bg-green-200/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${dailyTasks.length > 0 ? (getDailyCompletedCount(dailyTaskIds) / dailyTasks.length) * 100 : 0}%` }}
                />
              </div>
              <div className="space-y-1">
                {dailyTasks.map((task) => {
                  const checked = isCompletedToday(task.id);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-2.5 py-1.5 px-1.5 rounded-lg hover:bg-white/60 transition-colors cursor-pointer"
                    >
                      <button
                        onClick={() => toggleCompletion(task.id)}
                        className="w-[18px] h-[18px] flex-shrink-0 flex items-center justify-center"
                      >
                        <svg viewBox="0 0 20 20" fill="none" className="w-[18px] h-[18px]">
                          {checked ? (
                            <>
                              <circle cx="10" cy="10" r="9" fill="#4ade80" stroke="#22c55e" strokeWidth="1" />
                              <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </>
                          ) : (
                            <circle cx="10" cy="10" r="9" fill="white" stroke="#bbcfbb" strokeWidth="1.5" />
                          )}
                        </svg>
                      </button>
                      <span
                        onClick={() => setSelectedItem(task)}
                        className={`flex-1 text-[13px] leading-5 transition-all ${
                          checked ? 'text-green-400 line-through' : 'text-green-900'
                        }`}
                      >
                        {task.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
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
      {selectedScheduleItem && (
        <ItemDetailPopup
          type="schedule"
          item={selectedScheduleItem}
          categories={scheduleCategories}
          onSave={(updated) => { updateSchedule((updated as ScheduleItem).id, updated as ScheduleItem); setSelectedScheduleItem(null); }}
          onDelete={(id) => { /* 일정 삭제는 일정 페이지에서 */ setSelectedScheduleItem(null); }}
          onClose={() => setSelectedScheduleItem(null)}
        />
      )}
    </div>
  );
}
