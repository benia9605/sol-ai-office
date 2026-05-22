/**
 * @file src/pages/TasksPage.modern.tsx
 * @description 할일 페이지 — 모던 테마 (MUJI 톤)
 * - 페이지 헤더: label + font-light 헤드라인 + 새 할일 버튼
 * - 빠른 추가 인라인 입력
 * - 필터: 상태 chip + 카테고리 chip + 프로젝트 select + 정렬 select
 * - 검색
 * - 리스트 뷰 (날짜 그룹: 마감지남/오늘/내일/이번주/나중에/마감없음)
 * - 행: 직사각형 체크박스(상태 cycle) + 제목 + 카테고리 컬러 배지 + 우선순위 dot + 마감일
 * - 선택 모드 + 일괄 삭제
 * - 추가 폼 / ItemDetailPopup (모디 톤 그대로 호출)
 */
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { TaskItem, TaskStatus, RepeatType, ScheduleCategory } from '../types';
import { useTasks } from '../hooks/useTasks';
import { defaultTaskCategories } from '../data';
import { ItemDetailPopup } from '../components/ItemDetailPopup';
import { GoalSelect } from '../components/GoalSelect';
import { getBadgeColors } from '../utils/colorUtils';
import { getTodayStr } from '../utils/dateCalc';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const repeatLabels: Record<RepeatType, string> = {
  none: '없음', daily: '매일', weekly: '매주', monthly: '매월', yearly: '매년',
};

type SortMode = 'deadline' | 'priority' | 'created' | 'name';
type StatusFilter = 'all' | TaskStatus;

const sortOptions: { key: SortMode; label: string }[] = [
  { key: 'deadline', label: '마감일순' },
  { key: 'priority', label: '우선순위순' },
  { key: 'created',  label: '최신순' },
  { key: 'name',     label: '이름순' },
];

const statusFilters: { key: StatusFilter; label: string }[] = [
  { key: 'all',          label: '전체' },
  { key: 'pending',      label: '대기' },
  { key: 'in_progress',  label: '진행중' },
  { key: 'completed',    label: '완료' },
];

const priorityWeight: Record<TaskItem['priority'], number> = { high: 0, medium: 1, low: 2 };

const priorityMeta: Record<TaskItem['priority'], { label: string; color: string }> = {
  high:   { label: '긴급', color: '#dc2626' },   // 빨강
  medium: { label: '중요', color: '#f59e0b' },   // 호박
  low:    { label: '보통', color: '#9ca3af' },   // 회색
};

function diffDays(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function dDayLabel(date?: string): string | null {
  if (!date) return null;
  const d = diffDays(date);
  if (d === 0) return 'D-DAY';
  if (d < 0) return `+${Math.abs(d)}`;
  return `D-${d}`;
}

/** 오늘 포커스에 표시할 상태 문구 */
function todayStatusLabel(date?: string): string {
  if (!date) return '오늘 예정';
  const d = diffDays(date);
  if (d === 0) return '오늘 마감';
  if (d < 0) return `${Math.abs(d)}일 지남`;
  return '오늘 예정';
}

/** N일 미뤄진 업무 라벨 (Resume용) */
function staleDaysLabel(date: string): string {
  const d = Math.abs(diffDays(date));
  return `${d}일 미뤄짐`;
}

/** 마지막 작업 일자 표시 ("5월 18일" 형태) */
function lastActiveLabel(date: string): string {
  const d = new Date(date);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 빠른 기록(인박스) 판정 — 분류되지 않은 태스크 */
function isInbox(t: TaskItem): boolean {
  return !t.date && !t.project && !t.category && t.repeat !== 'daily' && t.status !== 'completed';
}

/** 오늘 포커스 판정 — 오늘 마감 / 1~2일 지남 */
function isTodayFocus(t: TaskItem): boolean {
  if (t.status === 'completed' || !t.date) return false;
  const d = diffDays(t.date);
  return d >= -2 && d <= 0;  // 그제 / 어제 / 오늘
}

/** 다시 시작 후보 판정 — 3일 이상 미뤄진 미완료 */
function isResume(t: TaskItem): boolean {
  if (t.status === 'completed' || !t.date) return false;
  return diffDays(t.date) <= -3;
}

export function TasksPageModern() {
  const { tasks, add, remove, updateTask, cycleStatus } = useTasks();
  const [categories] = useState<ScheduleCategory[]>(defaultTaskCategories);

  // 필터/정렬/검색
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<SortMode>('deadline');
  const [searchQuery, setSearchQuery] = useState('');

  // 페이지네이션 (전체 할일 리스트)
  const PAGE_SIZE = 10;
  const [listPage, setListPage] = useState(0);

  // 필터/검색 바뀌면 페이지 초기화
  useEffect(() => { setListPage(0); }, [statusFilter, categoryFilter, projectFilter, sortMode, searchQuery]);

  // 입력 모드 (3-toggle): null | 'inbox' | 'quick' | 'detail'
  type InputMode = 'inbox' | 'quick' | 'detail';
  const [inputMode, setInputMode] = useState<InputMode | null>(null);

  // 인박스 빠른 기록 입력
  const [inboxTitle, setInboxTitle] = useState('');
  const inboxInputRef = useRef<HTMLInputElement>(null);

  // 빠른 추가 입력 (오늘 자동)
  const [quickTitle, setQuickTitle] = useState('');
  const quickAddRef = useRef<HTMLInputElement>(null);

  // 상세 추가 폼
  const [form, setForm] = useState({
    title: '', project: '', priority: 'medium' as TaskItem['priority'], date: '',
    category: '', notes: '', repeat: 'none' as RepeatType, goalId: undefined as string | undefined,
  });

  // 상세 팝업
  const [selectedItem, setSelectedItem] = useState<TaskItem | null>(null);

  // 선택 모드
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ─── 특수 그룹 분리 ───
  // 1) 매일 루틴 (daily 반복)
  // 2) 인박스 (분류 안 한 빠른 기록)
  // 3) 오늘의 포커스 (오늘 + 1~2일 지남)
  // 4) 다시 시작 (3일+ 미뤄짐)
  // 5) 일반 리스트 (나머지)
  const groupSplit = useMemo(() => {
    const daily: TaskItem[] = [];
    const inbox: TaskItem[] = [];
    const todayFocus: TaskItem[] = [];
    const resume: TaskItem[] = [];
    const others: TaskItem[] = [];
    tasks.forEach((t) => {
      if (t.repeat === 'daily') { daily.push(t); return; }
      if (isInbox(t))           { inbox.push(t); return; }
      if (isTodayFocus(t))      { todayFocus.push(t); return; }
      if (isResume(t))          { resume.push(t); return; }
      others.push(t);
    });
    // 오늘 포커스 정렬: 우선순위 → 마감일 빠른순
    todayFocus.sort((a, b) => {
      const pw = priorityWeight[a.priority] - priorityWeight[b.priority];
      if (pw !== 0) return pw;
      return (a.date || '').localeCompare(b.date || '');
    });
    // 다시 시작 정렬: 더 오래 미뤄진 것 먼저
    resume.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    // 인박스: 최신 추가 먼저
    inbox.sort((a, b) => b.id.localeCompare(a.id));
    return { daily, inbox, todayFocus, resume, others };
  }, [tasks]);

  const dailyTasks = groupSplit.daily;
  const inboxTasks = groupSplit.inbox;
  const todayFocusTasks = groupSplit.todayFocus;
  const resumeTasks = groupSplit.resume;

  // 전체 할일 리스트용 — daily만 제외하고 모든 task 포함 (inbox/today/resume 다 들어감)
  const nonDailyTasks = useMemo(
    () => tasks.filter((t) => t.repeat !== 'daily'),
    [tasks],
  );

  const projectNames = useMemo(() => {
    const names = new Set(tasks.map((t) => t.project).filter(Boolean));
    return Array.from(names);
  }, [tasks]);

  // 필터 + 정렬 파이프라인 (전체 리스트용 — 모든 비-루틴 task 포함)
  const filtered = useMemo(() => {
    let result = [...nonDailyTasks];

    if (statusFilter !== 'all') result = result.filter((t) => t.status === statusFilter);
    if (categoryFilter !== 'all') result = result.filter((t) => t.category === categoryFilter);
    if (projectFilter !== 'all') result = result.filter((t) => t.project === projectFilter);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
        t.project?.toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => {
      if (sortMode === 'deadline') {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return a.date.localeCompare(b.date);
      }
      if (sortMode === 'priority') return priorityWeight[a.priority] - priorityWeight[b.priority];
      if (sortMode === 'name') return a.title.localeCompare(b.title, 'ko', { numeric: true });
      return b.id.localeCompare(a.id);
    });

    return result;
  }, [nonDailyTasks, statusFilter, categoryFilter, projectFilter, sortMode, searchQuery]);

  // 날짜별 그룹핑 — 같은 날짜의 할일을 하나로 묶음 (일정 페이지 톤)
  const dateGroups = useMemo(() => {
    const withDate: TaskItem[] = [];
    const noDate: TaskItem[] = [];
    filtered.forEach((t) => {
      if (t.date) withDate.push(t);
      else noDate.push(t);
    });
    const map = new Map<string, TaskItem[]>();
    withDate.forEach((t) => {
      const arr = map.get(t.date!) ?? [];
      arr.push(t);
      map.set(t.date!, arr);
    });
    // 정렬: 날짜 내림차순 (먼 미래 → 가까운 미래 → 오늘 → 과거)
    // 같은 날 내부는 우선순위 → 제목
    const dated = [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, items]) => [
        date,
        [...items].sort((a, b) => {
          const pw = priorityWeight[a.priority] - priorityWeight[b.priority];
          if (pw !== 0) return pw;
          return a.title.localeCompare(b.title, 'ko');
        }),
      ] as [string, TaskItem[]]);
    return { dated, noDate };
  }, [filtered]);

  const completedCount = useMemo(
    () => filtered.filter((t) => t.status === 'completed').length,
    [filtered],
  );

  // 떠오르는 생각 — 분류 없이 인박스로 (date/project/category 모두 비움)
  const handleInboxAdd = useCallback(() => {
    if (!inboxTitle.trim()) return;
    add({
      title: inboxTitle.trim(),
      project: '',
      priority: 'medium',
      status: 'pending',
      starred: false,
    });
    setInboxTitle('');
    setTimeout(() => inboxInputRef.current?.focus(), 50);
  }, [inboxTitle, add]);

  // 빠른 추가 — 오늘 마감으로 빠르게
  const handleQuickAdd = useCallback(() => {
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
    setTimeout(() => quickAddRef.current?.focus(), 50);
  }, [quickTitle, add]);

  // 다시 시작 — 마감일을 오늘로 + 진행중으로
  const handleResume = useCallback((task: TaskItem) => {
    updateTask(task.id, {
      ...task,
      date: getTodayStr(),
      status: 'in_progress',
    });
  }, [updateTask]);

  // 인박스 → 분류 (상세 폼에 prefill, 인박스 항목 삭제)
  const handleInboxClassify = useCallback((task: TaskItem) => {
    setForm({
      title: task.title,
      project: '',
      priority: 'medium',
      date: getTodayStr(),
      category: '',
      notes: task.notes || '',
      repeat: 'none',
      goalId: undefined,
    });
    remove(task.id);
    setInputMode('detail');
  }, [remove]);

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
    setInputMode(null);
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((t) => t.id)));
  }, [selectedIds.size, filtered]);

  const handleBulkDelete = useCallback(async () => {
    if (!window.confirm(`${selectedIds.size}개 할일을 삭제하시겠습니까?`)) return;
    for (const id of selectedIds) await remove(id);
    setSelectMode(false);
    setSelectedIds(new Set());
  }, [selectedIds, remove]);

  return (
    <main className="min-h-full bg-surface text-foreground">
      <div className="mx-auto max-w-5xl px-5 sm:px-8 py-10 sm:py-14 space-y-12 sm:space-y-14">

        {/* ── Page Header ── */}
        <section>
          <p className="label">Tasks</p>
          <h1 className="mt-5 text-4xl font-light leading-[1.25] sm:text-5xl">
            할일
          </h1>
          <p className="mt-4 text-sm text-foreground-muted">
            오늘 <span className="text-foreground">{todayFocusTasks.length}</span>건
            {inboxTasks.length > 0 && <> · 인박스 <span className="text-foreground">{inboxTasks.length}</span></>}
            {resumeTasks.length > 0 && <> · 다시 시작 <span className="text-primary-500">{resumeTasks.length}</span></>}
            {dailyTasks.length > 0 && <> · 루틴 {dailyTasks.length}</>}
            <span className="text-foreground-faint"> · 전체 {nonDailyTasks.length}건</span>
          </p>
        </section>

        {/* ── Daily Routine 최상단 (있을 때만) ── */}
        {dailyTasks.length > 0 && (
          <DailyRoutineSection
            tasks={dailyTasks}
            categories={categories}
            onTaskClick={setSelectedItem}
            onCycleStatus={cycleStatus}
          />
        )}

        {/* ── 입력 3-toggle (인박스 / 빠른추가 / 상세추가) ── */}
        <section className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <InputToggleButton
              active={inputMode === 'inbox'}
              onClick={() => setInputMode(inputMode === 'inbox' ? null : 'inbox')}
              labelEn="Capture"
              labelKo="떠오르는 생각 던져놓기"
              hint="분류 없이 인박스에"
            />
            <InputToggleButton
              active={inputMode === 'quick'}
              onClick={() => setInputMode(inputMode === 'quick' ? null : 'quick')}
              labelEn="Quick"
              labelKo="빠른 추가"
              hint="오늘 마감으로"
            />
            <InputToggleButton
              active={inputMode === 'detail'}
              onClick={() => setInputMode(inputMode === 'detail' ? null : 'detail')}
              labelEn="Detail"
              labelKo="상세 추가"
              hint="마감일·카테고리"
            />
          </div>

          {/* 인박스 입력 */}
          {inputMode === 'inbox' && (
            <div className="border border-line bg-surface px-4 py-3 flex items-center gap-2">
              <input
                ref={inboxInputRef}
                autoFocus
                type="text"
                placeholder="떠오른 생각을 그대로 — Enter로 인박스에 기록"
                value={inboxTitle}
                onChange={(e) => setInboxTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleInboxAdd();
                  if (e.key === 'Escape') setInputMode(null);
                }}
                className="flex-1 bg-transparent text-sm placeholder:text-foreground-faint focus:outline-none"
              />
              <button
                type="button"
                onClick={handleInboxAdd}
                disabled={!inboxTitle.trim()}
                className="text-xs text-foreground-muted hover:text-foreground disabled:opacity-40"
              >
                기록
              </button>
            </div>
          )}

          {/* 빠른 추가 입력 */}
          {inputMode === 'quick' && (
            <div className="border border-line bg-surface px-4 py-3 flex items-center gap-2">
              <input
                ref={quickAddRef}
                autoFocus
                type="text"
                placeholder="제목 입력 — Enter로 오늘 마감 할일로 추가"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleQuickAdd();
                  if (e.key === 'Escape') setInputMode(null);
                }}
                className="flex-1 bg-transparent text-sm placeholder:text-foreground-faint focus:outline-none"
              />
              <span className="text-[10px] tracking-[0.18em] uppercase text-foreground-faint shrink-0">Today</span>
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={!quickTitle.trim()}
                className="text-xs text-foreground-muted hover:text-foreground disabled:opacity-40"
              >
                추가
              </button>
            </div>
          )}

          {/* 상세 추가 폼 */}
          {inputMode === 'detail' && (
            <AddForm
              form={form}
              setForm={setForm}
              categories={categories}
              onCancel={() => setInputMode(null)}
              onSubmit={handleAdd}
            />
          )}
        </section>

        {/* ── ★ Today's Focus — 오늘의 포커스 (가장 시선) ── */}
        {todayFocusTasks.length > 0 && (
          <TodayFocusSection
            tasks={todayFocusTasks}
            categories={categories}
            onItemClick={setSelectedItem}
            onCycleStatus={cycleStatus}
          />
        )}

        {/* ── Quick Capture Inbox — 모아둔 빠른 기록 ── */}
        {inboxTasks.length > 0 && (
          <InboxSection
            tasks={inboxTasks}
            onItemClick={setSelectedItem}
            onClassify={handleInboxClassify}
            onComplete={cycleStatus}
            onRemove={remove}
          />
        )}

        {/* ── Resume — 다시 시작할 업무 ── */}
        {resumeTasks.length > 0 && (
          <ResumeSection
            tasks={resumeTasks}
            categories={categories}
            onItemClick={setSelectedItem}
            onResume={handleResume}
          />
        )}

        {/* ── Filters ── */}
        <section className="space-y-4">
          {/* 상태 chip */}
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((f) => (
              <FilterChip
                key={f.key}
                active={statusFilter === f.key}
                onClick={() => setStatusFilter(f.key)}
                label={f.label}
              />
            ))}
          </div>

          {/* 카테고리 chip */}
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
              label="모든 카테고리"
            />
            {categories.map((cat) => (
              <FilterChip
                key={cat.id}
                active={categoryFilter === cat.id}
                onClick={() => setCategoryFilter(categoryFilter === cat.id ? 'all' : cat.id)}
                label={cat.label}
                dotColor={cat.color}
              />
            ))}
          </div>

          {/* 정렬 + 프로젝트 + 검색 */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
            <div className="relative">
              <svg viewBox="0 0 20 20" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-faint" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="9" cy="9" r="6" />
                <path d="M14 14l3 3" strokeLinecap="round" />
              </svg>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="제목, 메모, 태그, 프로젝트 검색"
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-line text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
              />
            </div>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
            >
              <option value="all">모든 프로젝트</option>
              {projectNames.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
            >
              {sortOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>

          {/* 선택 모드 토글 + 일괄 액션 */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectMode(!selectMode);
                if (selectMode) setSelectedIds(new Set());
              }}
              className="text-xs text-foreground-muted hover:text-foreground transition-colors"
            >
              {selectMode ? '선택 모드 종료' : '선택 모드'}
            </button>
            {selectMode && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-foreground-muted hover:text-foreground transition-colors"
                >
                  {selectedIds.size === filtered.length ? '전체 해제' : '전체 선택'}
                </button>
                <span className="text-xs text-foreground-faint">{selectedIds.size}개</span>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                  className="border border-line-strong px-3 py-1 text-xs hover:border-foreground transition-colors disabled:opacity-40"
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── 전체 할일 — 날짜별 묶음 + 페이지네이션 ── */}
        <ListPaginated
          dated={dateGroups.dated}
          noDate={dateGroups.noDate}
          page={listPage}
          pageSize={PAGE_SIZE}
          onPageChange={setListPage}
          categories={categories}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onItemClick={setSelectedItem}
          onCycleStatus={cycleStatus}
          onToggleSelect={toggleSelect}
        />

      </div>

      {/* 상세 팝업 (모디 톤 그대로) */}
      {selectedItem && (
        <ItemDetailPopup
          type="task"
          item={selectedItem}
          categories={categories}
          onSave={(updated) => { updateTask((updated as TaskItem).id, updated as TaskItem); setSelectedItem(null); }}
          onDelete={(id) => { remove(id); setSelectedItem(null); }}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </main>
  );
}

/* ─────────────────────────────────────────────────────── */
/*  서브 컴포넌트                                            */
/* ─────────────────────────────────────────────────────── */

function SectionHeader({ title, cta, onCta }: { title: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line pb-3">
      <h2 className="text-base font-normal">{title}</h2>
      {cta && (
        <button onClick={onCta} className="text-xs text-foreground-muted hover:text-foreground transition-colors">
          {cta} →
        </button>
      )}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="border-b border-line py-16 text-center">
      <p className="text-sm text-foreground-faint">{message}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  dotColor,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  dotColor?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs border transition-colors ${
        active
          ? 'bg-foreground text-surface border-foreground'
          : 'bg-surface text-foreground-muted border-line hover:border-foreground hover:text-foreground'
      }`}
    >
      {dotColor && (
        <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: dotColor }} aria-hidden />
      )}
      {label}
    </button>
  );
}

/* ─── 입력 모드 토글 버튼 (3개 중 하나) ─── */

function InputToggleButton({
  active,
  onClick,
  labelEn,
  labelKo,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  labelEn: string;
  labelKo: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 text-left border transition-colors ${
        active
          ? 'bg-foreground text-surface border-foreground'
          : 'bg-surface text-foreground border-line hover:border-foreground'
      }`}
    >
      <p className={`text-[10px] tracking-[0.22em] uppercase ${
        active ? 'text-surface/70' : 'text-foreground-faint'
      }`}>
        {labelEn}
      </p>
      <p className="mt-1.5 text-sm leading-tight">{labelKo}</p>
      <p className={`mt-1 text-[10px] ${
        active ? 'text-surface/60' : 'text-foreground-faint'
      }`}>
        {hint}
      </p>
    </button>
  );
}

/* ─── 페이지네이션 컨테이너 ─── */

interface ListPaginatedProps {
  dated: [string, TaskItem[]][];
  noDate: TaskItem[];
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  categories: ScheduleCategory[];
  selectMode: boolean;
  selectedIds: Set<string>;
  onItemClick: (t: TaskItem) => void;
  onCycleStatus: (id: string) => void;
  onToggleSelect: (id: string) => void;
}

function ListPaginated({
  dated, noDate, page, pageSize, onPageChange,
  categories, selectMode, selectedIds,
  onItemClick, onCycleStatus, onToggleSelect,
}: ListPaginatedProps) {
  // No Date 그룹도 페이지 1개 슬롯으로 취급. 그러면 마지막 페이지에서 함께 나타남.
  const hasNoDate = noDate.length > 0;
  const totalSlots = dated.length + (hasNoDate ? 1 : 0);
  const totalPages = Math.max(1, Math.ceil(totalSlots / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  const startIdx = safePage * pageSize;
  const endIdx = startIdx + pageSize;

  // 이번 페이지의 dated 슬라이스
  const pagedDated = dated.slice(startIdx, Math.min(endIdx, dated.length));
  // No Date는 마지막 페이지의 마지막 슬롯에만 표시
  const showNoDate = hasNoDate && endIdx > dated.length;

  if (totalSlots === 0) {
    return (
      <section>
        <SectionHeader title="전체 할일" />
        <EmptyRow message="조건에 맞는 할일이 없습니다." />
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-line pb-3">
        <h2 className="text-base font-normal">전체 할일</h2>
        <p className="text-xs text-foreground-faint tabular-nums">
          {totalSlots}개 그룹 · 최신순
        </p>
      </div>

      {/* 페이지된 dated 그룹 */}
      {pagedDated.map(([date, items]) => (
        <DateGroupBlock
          key={date}
          date={date}
          items={items}
          categories={categories}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onItemClick={onItemClick}
          onCycleStatus={onCycleStatus}
          onToggleSelect={onToggleSelect}
        />
      ))}

      {/* 마감일 없음은 마지막 페이지에서만 */}
      {showNoDate && (
        <NoDateGroupBlock
          items={noDate}
          categories={categories}
          selectMode={selectMode}
          selectedIds={selectedIds}
          onItemClick={onItemClick}
          onCycleStatus={onCycleStatus}
          onToggleSelect={onToggleSelect}
        />
      )}

      {/* 페이지네이션 컨트롤 (페이지 2개 이상일 때만) */}
      {totalPages > 1 && (
        <nav className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(0, safePage - 1))}
            disabled={safePage === 0}
            className={`inline-flex items-center gap-2 text-xs transition-colors ${
              safePage === 0
                ? 'text-foreground-faint cursor-not-allowed'
                : 'text-foreground-muted hover:text-foreground'
            }`}
            aria-label="이전 페이지"
          >
            <span aria-hidden>←</span> 이전
          </button>
          <p className="text-xs tabular-nums">
            <span className="text-foreground">{safePage + 1}</span>
            <span className="text-foreground-faint"> / {totalPages}</span>
          </p>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages - 1, safePage + 1))}
            disabled={safePage >= totalPages - 1}
            className={`inline-flex items-center gap-2 text-xs transition-colors ${
              safePage >= totalPages - 1
                ? 'text-foreground-faint cursor-not-allowed'
                : 'text-foreground-muted hover:text-foreground'
            }`}
            aria-label="다음 페이지"
          >
            다음 <span aria-hidden>→</span>
          </button>
        </nav>
      )}
    </section>
  );
}

/* ─── 날짜별 그룹 블록 (같은 날짜 할일 묶기) ─── */

interface DateGroupBlockProps {
  date: string;
  items: TaskItem[];
  categories: ScheduleCategory[];
  selectMode: boolean;
  selectedIds: Set<string>;
  onItemClick: (t: TaskItem) => void;
  onCycleStatus: (id: string) => void;
  onToggleSelect: (id: string) => void;
}

function DateGroupBlock({
  date, items, categories,
  selectMode, selectedIds, onItemClick, onCycleStatus, onToggleSelect,
}: DateGroupBlockProps) {
  const d = new Date(date);
  const dayDiff = diffDays(date);
  const isOverdue = dayDiff < 0;

  return (
    <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[80px_1fr] gap-3 sm:gap-5 py-3 border-b border-line">
      {/* 좌측: 월/일/요일만 */}
      <div>
        <p className="text-[9px] tracking-[0.2em] uppercase text-primary-500">
          {MONTHS_EN[d.getMonth()]}
        </p>
        <p className={`mt-0.5 text-xl font-light leading-none tabular-nums ${
          isOverdue ? 'text-primary-500' : 'text-foreground-muted'
        }`}>
          {String(d.getDate()).padStart(2, '0')}
        </p>
        <p className="mt-1 text-[9px] tracking-[0.15em] text-foreground-faint">
          {DAY_NAMES[d.getDay()]}
        </p>
      </div>

      {/* 우측: 상단 N건 + 한 줄 행 divide-y */}
      <div className="min-w-0">
        <p className="text-right text-[10px] tabular-nums text-foreground-faint mb-0.5">
          {items.length}건
        </p>
        <ul className="divide-y divide-line">
          {items.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              categories={categories}
              selectMode={selectMode}
              selected={selectedIds.has(t.id)}
              onItemClick={onItemClick}
              onCycleStatus={onCycleStatus}
              onToggleSelect={onToggleSelect}
              hideDate
              compact
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── 마감일 없음 그룹 ─── */

function NoDateGroupBlock({
  items, categories,
  selectMode, selectedIds, onItemClick, onCycleStatus, onToggleSelect,
}: {
  items: TaskItem[];
  categories: ScheduleCategory[];
  selectMode: boolean;
  selectedIds: Set<string>;
  onItemClick: (t: TaskItem) => void;
  onCycleStatus: (id: string) => void;
  onToggleSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[80px_1fr] gap-3 sm:gap-5 py-3 border-b border-line">
      {/* 좌측 */}
      <div>
        <p className="text-[9px] tracking-[0.2em] uppercase text-primary-500">No Date</p>
      </div>
      {/* 우측 */}
      <div className="min-w-0">
        <p className="text-right text-[10px] tabular-nums text-foreground-faint mb-0.5">
          {items.length}건
        </p>
        <ul className="divide-y divide-line">
          {items.map((t) => (
            <TaskRow
              key={t.id}
              task={t}
              categories={categories}
              selectMode={selectMode}
              selected={selectedIds.has(t.id)}
              onItemClick={onItemClick}
              onCycleStatus={onCycleStatus}
              onToggleSelect={onToggleSelect}
              hideDate
              compact
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── 할일 한 줄 ─── */

interface TaskRowProps {
  task: TaskItem;
  categories: ScheduleCategory[];
  selectMode: boolean;
  selected: boolean;
  onItemClick: (t: TaskItem) => void;
  onCycleStatus: (id: string) => void;
  onToggleSelect: (id: string) => void;
  /** 날짜 그룹 안에서 호출될 때 우측 D-day/날짜 숨김 */
  hideDate?: boolean;
  /** 한 줄 컴팩트 모드 (날짜 그룹 안에서 사용) */
  compact?: boolean;
}

function TaskRow({
  task, categories, selectMode, selected,
  onItemClick, onCycleStatus, onToggleSelect, hideDate, compact,
}: TaskRowProps) {
  const cat = categories.find((c) => c.id === task.category);
  const cc = cat ? getBadgeColors(cat.color) : null;
  const isCompleted = task.status === 'completed';
  const dday = dDayLabel(task.date);
  const overdue = task.date ? diffDays(task.date) < 0 && !isCompleted : false;
  const priority = priorityMeta[task.priority];
  const showRightDate = !hideDate && dday;

  const Checkbox = selectMode ? (
    <button
      type="button"
      onClick={() => onToggleSelect(task.id)}
      aria-label="선택"
      className={`w-5 h-5 border flex items-center justify-center shrink-0 transition-colors ${
        selected ? 'bg-foreground border-foreground' : 'bg-surface border-line-strong hover:border-foreground'
      }`}
    >
      {selected && (
        <svg viewBox="0 0 12 12" className="w-3 h-3 text-surface" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  ) : (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onCycleStatus(task.id); }}
      aria-label="상태 변경"
      className={`w-5 h-5 border flex items-center justify-center shrink-0 transition-colors ${
        isCompleted
          ? 'bg-primary-500 border-primary-500'
          : task.status === 'in_progress'
            ? 'bg-surface border-foreground'
            : 'bg-surface border-line-strong hover:border-foreground'
      }`}
    >
      {isCompleted && (
        <svg viewBox="0 0 12 12" className="w-3 h-3 text-surface" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {task.status === 'in_progress' && (
        <span className="w-2 h-2 bg-foreground" aria-hidden />
      )}
    </button>
  );

  /* ─── compact: 한 줄 ─── */
  if (compact) {
    return (
      <li>
        <div className="flex items-center gap-2 sm:gap-2.5 py-1.5 px-2 hover:bg-surface-muted transition-colors">
          {/* 체크박스 (작게) */}
          <span className="shrink-0 scale-90 origin-center">{Checkbox}</span>

          {/* 우선순위 dot */}
          <span
            className="w-1 h-1 shrink-0"
            style={{ backgroundColor: priority.color }}
            aria-label={priority.label}
          />

          {/* 제목 */}
          <button
            type="button"
            onClick={() => onItemClick(task)}
            className={`flex-1 min-w-0 text-left text-[13px] truncate ${
              isCompleted ? 'text-foreground-faint line-through' : 'text-foreground-muted'
            }`}
          >
            {task.title}
          </button>

          {/* 카테고리 (작게) */}
          {cat && cc && (
            <span
              className="hidden sm:inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 leading-none shrink-0"
              style={{ backgroundColor: cc.bg, color: cc.text }}
            >
              <span className="w-1 h-1 shrink-0" style={{ backgroundColor: cc.dot }} aria-hidden />
              {cat.label}
            </span>
          )}

          {/* 프로젝트 (작게) */}
          {task.project && (
            <span className="hidden sm:inline text-[10px] text-foreground-faint truncate max-w-[80px] shrink-0">
              {task.project}
            </span>
          )}
        </div>
      </li>
    );
  }

  /* ─── 기본 모드 (2줄) ─── */
  return (
    <li>
      <div className="grid grid-cols-[24px_1fr_auto] items-center gap-4 py-4 pl-4 pr-3 sm:pl-6 hover:bg-surface-muted transition-colors">
        {Checkbox}

        <button
          type="button"
          onClick={() => onItemClick(task)}
          className="text-left min-w-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <p className={`text-base truncate ${
              isCompleted ? 'text-foreground-faint line-through' : ''
            }`}>
              {task.title}
            </p>
            {cat && cc && (
              <span
                className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 leading-none shrink-0"
                style={{ backgroundColor: cc.bg, color: cc.text }}
              >
                <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: cc.dot }} aria-hidden />
                {cat.label}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-foreground-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5" style={{ backgroundColor: priority.color }} aria-hidden />
              {priority.label}
            </span>
            {task.project && <span className="truncate">· {task.project}</span>}
            {task.repeat && task.repeat !== 'none' && (
              <span>· 반복 {repeatLabels[task.repeat]}</span>
            )}
          </div>
        </button>

        <div className="shrink-0 text-right">
          {showRightDate && (
            <p className={`text-xs tracking-[0.1em] tabular-nums ${
              overdue ? 'text-primary-500' : 'text-foreground-faint'
            }`}>
              {dday}
            </p>
          )}
          {!hideDate && task.date && (
            <p className="mt-0.5 text-[10px] text-foreground-faint tabular-nums">
              {task.date.slice(5).replace('-', '/')}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/* ─── 매일 루틴 ─── */

function DailyRoutineSection({
  tasks,
  categories,
  onTaskClick,
  onCycleStatus,
}: {
  tasks: TaskItem[];
  categories: ScheduleCategory[];
  onTaskClick: (t: TaskItem) => void;
  onCycleStatus: (id: string) => void;
}) {
  const completed = tasks.filter((t) => t.status === 'completed').length;
  return (
    <section className="border border-line">
      {/* 헤더 — 한 줄 */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-line">
        <div className="flex items-baseline gap-3">
          <p className="label">Daily</p>
          <p className="text-xs text-foreground-muted">매일 루틴</p>
        </div>
        <p className="text-xs text-foreground-muted tabular-nums">
          <span className="text-primary-500">{completed}</span>
          <span className="text-foreground-faint"> / {tasks.length}</span>
        </p>
      </div>

      {/* 칩 가로 스크롤 */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 sm:px-5 py-3">
        {tasks.map((t) => {
          const cat = categories.find((c) => c.id === t.category);
          const isCompleted = t.status === 'completed';
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onCycleStatus(t.id)}
              onDoubleClick={() => onTaskClick(t)}
              title="클릭: 완료 토글 · 더블클릭: 상세"
              className={`inline-flex items-center gap-2 shrink-0 px-3 py-1.5 border text-xs transition-colors ${
                isCompleted
                  ? 'bg-surface-muted border-line text-foreground-faint'
                  : 'bg-surface border-line-strong text-foreground hover:border-foreground'
              }`}
            >
              <span
                className={`w-3.5 h-3.5 border flex items-center justify-center shrink-0 ${
                  isCompleted
                    ? 'bg-primary-500 border-primary-500'
                    : 'bg-surface border-line-strong'
                }`}
                aria-hidden
              >
                {isCompleted && (
                  <svg viewBox="0 0 12 12" className="w-2.5 h-2.5 text-surface" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              {cat && (
                <span
                  className="w-1.5 h-1.5 shrink-0"
                  style={{ backgroundColor: cat.color }}
                  aria-hidden
                />
              )}
              <span className={isCompleted ? 'line-through' : ''}>
                {t.title}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ─── 추가 폼 ─── */

interface AddFormProps {
  form: {
    title: string; project: string; priority: TaskItem['priority']; date: string;
    category: string; notes: string; repeat: RepeatType; goalId?: string;
  };
  setForm: React.Dispatch<React.SetStateAction<AddFormProps['form']>>;
  categories: ScheduleCategory[];
  onCancel: () => void;
  onSubmit: () => void;
}

function AddForm({ form, setForm, categories, onCancel, onSubmit }: AddFormProps) {
  return (
    <section className="border border-line p-6 sm:p-8 space-y-6 bg-surface">
      <p className="label">New Task</p>

      <label className="block space-y-2">
        <span className="label">제목</span>
        <input
          type="text"
          placeholder="할일 제목"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full border border-line bg-surface px-4 py-3 text-base placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block space-y-2">
          <span className="label">마감일</span>
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
          />
        </label>
        <label className="block space-y-2">
          <span className="label">우선순위</span>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as TaskItem['priority'] })}
            className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
          >
            <option value="high">높음</option>
            <option value="medium">보통</option>
            <option value="low">낮음</option>
          </select>
        </label>
      </div>

      {/* 목표 */}
      <label className="block space-y-2">
        <span className="label">목표 / 프로젝트</span>
        <GoalSelect
          value={form.goalId}
          projectName={form.project}
          onChange={(g) => setForm({ ...form, goalId: g.goalId, project: g.projectName })}
        />
      </label>

      {/* 카테고리 */}
      <div className="space-y-2">
        <p className="label">카테고리</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const active = form.category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setForm({ ...form, category: active ? '' : cat.id })}
                className={`inline-flex items-center gap-2 px-4 py-1.5 text-xs border transition-colors ${
                  active
                    ? 'bg-foreground text-surface border-foreground'
                    : 'bg-surface text-foreground-muted border-line hover:border-foreground hover:text-foreground'
                }`}
              >
                <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: cat.color }} aria-hidden />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 반복 */}
      <label className="block space-y-2">
        <span className="label">반복</span>
        <select
          value={form.repeat}
          onChange={(e) => setForm({ ...form, repeat: e.target.value as RepeatType })}
          className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
        >
          {Object.entries(repeatLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>

      {/* 비고 */}
      <label className="block space-y-2">
        <span className="label">비고</span>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          placeholder="메모를 입력하세요"
          className="w-full border border-line bg-surface px-4 py-3 text-sm resize-none placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
        />
      </label>

      <div className="flex justify-end gap-2 pt-2 border-t border-line">
        <button
          type="button"
          onClick={onCancel}
          className="border border-line-strong px-6 py-2.5 text-sm text-foreground hover:border-foreground transition-colors"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!form.title.trim()}
          className="border border-foreground bg-foreground px-6 py-2.5 text-sm text-surface hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          추가
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────── */
/*  ★ Today's Focus — 오늘의 포커스 (가장 시선)              */
/* ─────────────────────────────────────────────────────── */

function TodayFocusSection({
  tasks,
  categories,
  onItemClick,
  onCycleStatus,
}: {
  tasks: TaskItem[];
  categories: ScheduleCategory[];
  onItemClick: (t: TaskItem) => void;
  onCycleStatus: (id: string) => void;
}) {
  return (
    <section className="border border-foreground">
      {/* 헤더 */}
      <div className="flex items-baseline justify-between gap-3 px-5 sm:px-6 py-4 border-b border-foreground bg-foreground text-surface">
        <div className="flex items-baseline gap-3">
          <p className="text-[10px] tracking-[0.22em] uppercase">Today's Focus</p>
          <p className="text-sm">오늘 처리해야 할 업무</p>
        </div>
        <p className="text-xs tabular-nums">{tasks.length}건</p>
      </div>

      {/* 리스트 */}
      <ul className="divide-y divide-line">
        {tasks.map((t) => {
          const cat = categories.find((c) => c.id === t.category);
          const cc = cat ? getBadgeColors(cat.color) : null;
          const priority = priorityMeta[t.priority];
          const statusText = todayStatusLabel(t.date);
          const overdue = t.date ? diffDays(t.date) < 0 : false;
          return (
            <li key={t.id}>
              <div className="grid grid-cols-[24px_1fr_auto] items-center gap-4 py-4 pl-5 pr-4 sm:pl-6 hover:bg-surface-muted transition-colors">
                {/* 체크박스 */}
                <button
                  type="button"
                  onClick={() => onCycleStatus(t.id)}
                  aria-label="완료 토글"
                  className="w-5 h-5 border bg-surface border-line-strong hover:border-foreground flex items-center justify-center transition-colors"
                >
                  {t.status === 'in_progress' && (
                    <span className="w-2 h-2 bg-foreground" aria-hidden />
                  )}
                </button>

                {/* 본문 */}
                <button
                  type="button"
                  onClick={() => onItemClick(t)}
                  className="text-left min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-base font-normal truncate">{t.title}</p>
                    {cat && cc && (
                      <span
                        className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 leading-none shrink-0"
                        style={{ backgroundColor: cc.bg, color: cc.text }}
                      >
                        <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: cc.dot }} aria-hidden />
                        {cat.label}
                      </span>
                    )}
                  </div>
                  <p className={`mt-1.5 text-xs ${overdue ? 'text-primary-500' : 'text-foreground-muted'}`}>
                    {statusText}
                    {t.project && ` · ${t.project}`}
                  </p>
                </button>

                {/* 우선순위 배지 */}
                <span
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 leading-none shrink-0"
                  style={{
                    backgroundColor: `${priority.color}1a`,
                    color: priority.color,
                    border: `1px solid ${priority.color}40`,
                  }}
                >
                  <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: priority.color }} aria-hidden />
                  {priority.label}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ─────────────────────────────────────────────────────── */
/*  Quick Capture Inbox — 모아둔 빠른 기록                   */
/* ─────────────────────────────────────────────────────── */

function InboxSection({
  tasks,
  onItemClick,
  onClassify,
  onComplete,
  onRemove,
}: {
  tasks: TaskItem[];
  onItemClick: (t: TaskItem) => void;
  onClassify: (t: TaskItem) => void;
  onComplete: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="border border-line">
      <div className="flex items-baseline justify-between gap-3 px-5 sm:px-6 py-3 border-b border-line bg-surface-muted">
        <div className="flex items-baseline gap-3">
          <p className="label">Inbox</p>
          <p className="text-xs text-foreground-muted">빠른 기록 — 던져놓은 생각들</p>
        </div>
        <p className="text-xs text-foreground-muted tabular-nums">{tasks.length}건</p>
      </div>
      <ul className="divide-y divide-line">
        {tasks.map((t) => (
          <li key={t.id}>
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-3 pl-5 pr-3 sm:pl-6 hover:bg-surface-muted transition-colors">
              <button
                type="button"
                onClick={() => onItemClick(t)}
                className="text-left min-w-0"
              >
                <p className="text-sm truncate">{t.title}</p>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onClassify(t)}
                  className="text-[11px] text-foreground-muted hover:text-foreground border border-line-strong hover:border-foreground px-2.5 py-1 transition-colors"
                  title="마감일·카테고리를 정해서 정식 할일로"
                >
                  분류 →
                </button>
                <button
                  type="button"
                  onClick={() => onComplete(t.id)}
                  className="text-[11px] text-foreground-muted hover:text-foreground border border-line hover:border-foreground px-2.5 py-1 transition-colors"
                  title="완료 처리"
                >
                  완료
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(t.id)}
                  className="text-[11px] text-foreground-faint hover:text-primary-500 px-2 py-1 transition-colors"
                  aria-label="삭제"
                >
                  ×
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ─────────────────────────────────────────────────────── */
/*  Resume — 다시 시작할 업무 (3일+ 미뤄짐)                  */
/* ─────────────────────────────────────────────────────── */

function ResumeSection({
  tasks,
  categories,
  onItemClick,
  onResume,
}: {
  tasks: TaskItem[];
  categories: ScheduleCategory[];
  onItemClick: (t: TaskItem) => void;
  onResume: (t: TaskItem) => void;
}) {
  return (
    <section className="border border-line">
      <div className="flex items-baseline justify-between gap-3 px-5 sm:px-6 py-3 border-b border-line">
        <div className="flex items-baseline gap-3">
          <p className="label">Resume</p>
          <p className="text-xs text-foreground-muted">놓친 업무 다시 시작하기</p>
        </div>
        <p className="text-xs text-foreground-muted tabular-nums">{tasks.length}건</p>
      </div>
      <ul className="divide-y divide-line">
        {tasks.map((t) => {
          const cat = categories.find((c) => c.id === t.category);
          const cc = cat ? getBadgeColors(cat.color) : null;
          return (
            <li key={t.id}>
              <div className="grid grid-cols-[1fr_auto] items-center gap-4 py-4 pl-5 pr-4 sm:pl-6 hover:bg-surface-muted transition-colors">
                <button
                  type="button"
                  onClick={() => onItemClick(t)}
                  className="text-left min-w-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-base truncate">{t.title}</p>
                    {cat && cc && (
                      <span
                        className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 leading-none shrink-0"
                        style={{ backgroundColor: cc.bg, color: cc.text }}
                      >
                        <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: cc.dot }} aria-hidden />
                        {cat.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-foreground-muted">
                    <span className="text-primary-500">{t.date && staleDaysLabel(t.date)}</span>
                    {t.date && <> · 마지막 작업 · {lastActiveLabel(t.date)}</>}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onResume(t)}
                  className="shrink-0 border border-foreground px-4 py-2 text-xs hover:bg-foreground hover:text-surface transition-colors"
                >
                  다시 시작 →
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
