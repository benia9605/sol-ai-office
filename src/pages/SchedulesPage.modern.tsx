/**
 * @file src/pages/SchedulesPage.modern.tsx
 * @description 일정 페이지 — 모던 테마 (MUJI 톤)
 * - 페이지 헤더: label + font-light 헤드라인
 * - 미니 월간 캘린더 (hairline grid, 일정 있는 날만 진초록 dot)
 * - 카테고리 필터 / 검색 (hairline)
 * - 월별 그룹 일정 리스트 (divide-y + 큰 날짜 + 제목 + 시간)
 * - 추가/편집은 모디 톤 폼/팝업 그대로 호출
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import { useSchedules } from '../hooks/useSchedules';
import { useTasks } from '../hooks/useTasks';
import { useProjects } from '../hooks/useProjects';
import { defaultScheduleCategories, defaultTaskCategories } from '../data';
import { ScheduleItem, ScheduleCategory, RepeatType, TaskItem } from '../types';
import { ItemDetailPopup } from '../components/ItemDetailPopup';
import { DateRangePicker } from '../components/calendar/DateRangePicker';
import { ProjectSelect } from '../components/ProjectSelect';
import { downloadIcs } from '../utils/icsExport';
import { getBadgeColors } from '../utils/colorUtils';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const MONTHS_EN = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const repeatLabels: Record<RepeatType, string> = {
  none: '없음', daily: '매일', weekly: '매주', monthly: '매월', yearly: '매년',
};

function formatYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function SchedulesPageModern({ workspaceId, embedded }: { workspaceId?: string; embedded?: boolean } = {}) {
  const { schedules, add: addSchedule, update: updateSchedule, remove: removeSchedule, toggleComplete } = useSchedules(workspaceId);
  const { tasks, updateTask } = useTasks();
  const { projects } = useProjects();
  const [taskCategories] = useState(defaultTaskCategories);
  const [categories] = useState<ScheduleCategory[]>(defaultScheduleCategories);

  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null);
  const [selectedTaskItem, setSelectedTaskItem] = useState<TaskItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [form, setForm] = useState({
    title: '', date: '', endDate: '' as string | undefined, time: '', project: '',
    category: '', repeat: 'none' as RepeatType, reminder: 'none', notes: '', tagInput: '', tags: [] as string[],
  });

  // 검색 + 카테고리 필터
  const filtered = useMemo(() => {
    let result = [...schedules];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q) ||
        s.tags?.some((t) => t.toLowerCase().includes(q)) ||
        s.project?.toLowerCase().includes(q),
      );
    }
    if (categoryFilter !== 'all') {
      result = result.filter((s) => s.category === categoryFilter);
    }
    result.sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    return result;
  }, [schedules, searchQuery, categoryFilter]);

  // 월별 그룹핑
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, ScheduleItem[]> = {};
    filtered.forEach((item) => {
      const d = new Date(item.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [filtered]);

  // 일정 있는 날짜 (점 표시용)
  const datesWithSchedule = useMemo(() => {
    const set = new Set<string>();
    schedules.forEach((s) => set.add(s.date));
    return set;
  }, [schedules]);

  // 다음 일정 (Featured용)
  const nextSchedule = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [...schedules]
      .filter((s) => {
        const d = new Date(s.date);
        d.setHours(0, 0, 0, 0);
        return d.getTime() >= today.getTime();
      })
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))[0];
  }, [schedules]);

  const handleAdd = () => {
    if (!form.title.trim() || !form.date) return;
    const cat = categories.find((c) => c.id === form.category);
    addSchedule({
      title: form.title,
      date: form.date,
      endDate: form.endDate || undefined,
      time: form.time,
      project: form.project,
      color: cat?.color || '#1b4332',
      category: form.category || undefined,
      repeat: form.repeat,
      reminder: form.reminder,
      notes: form.notes,
      tags: form.tags.length > 0 ? form.tags : undefined,
    });
    setForm({ title: '', date: '', endDate: undefined, time: '', project: '', category: '', repeat: 'none', reminder: 'none', notes: '', tagInput: '', tags: [] });
    setShowForm(false);
    setShowAdvanced(false);
  };

  const handleAddTag = () => {
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm({ ...form, tags: [...form.tags, tag], tagInput: '' });
    }
  };

  const inner = (
    <>
      <div className={embedded ? 'space-y-12' : 'mx-auto max-w-5xl px-5 sm:px-8 py-10 sm:py-14 space-y-14 sm:space-y-16'}>

        {/* ── Page Header ── */}
        <section className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <p className="label">Schedule</p>
            <h1 className="mt-5 text-4xl font-light leading-[1.25] sm:text-5xl">
              일정
            </h1>
            <p className="mt-4 text-sm text-foreground-muted">
              {filtered.length}건의 일정이 등록되어 있습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="border border-foreground px-6 py-2.5 text-sm hover:bg-foreground hover:text-surface transition-colors"
          >
            {showForm ? '취소' : '+ 새 일정'}
          </button>
        </section>

        {/* ── Next Schedule (Featured) ── */}
        {nextSchedule && <NextScheduleFeatured item={nextSchedule} onClick={() => setSelectedItem(nextSchedule)} />}

        {/* ── Add Form (toggle) ── */}
        {showForm && (
          <AddForm
            form={form}
            setForm={setForm}
            categories={categories}
            showAdvanced={showAdvanced}
            setShowAdvanced={setShowAdvanced}
            onAddTag={handleAddTag}
            onCancel={() => { setShowForm(false); setShowAdvanced(false); }}
            onSubmit={handleAdd}
          />
        )}

        {/* ── Mini Calendar ── */}
        <MiniCalendar
          month={calendarMonth}
          onMonthChange={setCalendarMonth}
          datesWithSchedule={datesWithSchedule}
          onDateClick={() => setSearchQuery('')}
          schedules={schedules}
          onScheduleClick={setSelectedItem}
          categories={categories}
        />

        {/* ── Filter / Search ── */}
        <section className="space-y-4">
          {/* 카테고리 필터 chip */}
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
              label="전체"
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

          {/* 검색 */}
          <div className="relative">
            <svg viewBox="0 0 20 20" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-foreground-faint" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="9" cy="9" r="6" />
              <path d="M14 14l3 3" strokeLinecap="round" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목, 메모, 태그, 프로젝트 검색"
              className="w-full pl-10 pr-4 py-3 bg-surface border border-line text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
            />
          </div>
        </section>

        {/* ── Schedules by Month ── */}
        <section>
          <SectionHeader title="전체 일정" />
          {Object.entries(groupedByMonth).length === 0 ? (
            <EmptyRow message="조건에 맞는 일정이 없습니다." />
          ) : (
            Object.entries(groupedByMonth).map(([monthKey, items]) => (
              <MonthGroup
                key={monthKey}
                monthKey={monthKey}
                items={items}
                categories={categories}
                onItemClick={setSelectedItem}
                onToggleComplete={toggleComplete}
              />
            ))
          )}
        </section>

      </div>

      {/* 상세 팝업 (모디 톤 그대로) */}
      {selectedItem && (
        <ItemDetailPopup
          type="schedule"
          item={selectedItem}
          categories={categories}
          onSave={(updated) => { updateSchedule((updated as ScheduleItem).id, updated as ScheduleItem); setSelectedItem(null); }}
          onDelete={(id) => { removeSchedule(id); setSelectedItem(null); }}
          onClose={() => setSelectedItem(null)}
        />
      )}
      {selectedTaskItem && (
        <ItemDetailPopup
          type="task"
          item={selectedTaskItem}
          categories={taskCategories}
          onSave={(updated) => { updateTask((updated as TaskItem).id, updated as TaskItem); setSelectedTaskItem(null); }}
          onDelete={() => setSelectedTaskItem(null)}
          onClose={() => setSelectedTaskItem(null)}
        />
      )}
    </>
  );
  return embedded ? inner : <main className="min-h-full bg-surface text-foreground">{inner}</main>;
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
        <span
          className="w-1.5 h-1.5 shrink-0"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
      )}
      {label}
    </button>
  );
}

function NextScheduleFeatured({ item, onClick }: { item: ScheduleItem; onClick: () => void }) {
  const d = new Date(item.date);
  const isToday = isSameDay(d, new Date());
  const isTomorrow = isSameDay(d, new Date(Date.now() + 86400000));

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left border border-line hover:border-foreground transition-colors"
    >
      <div className="grid sm:grid-cols-[1fr_1.6fr]">
        {/* 좌측: 큰 날짜 */}
        <div className="aspect-[4/3] sm:aspect-auto bg-surface-muted relative">
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="label">{MONTHS_EN[d.getMonth()]}</p>
            <p className="mt-3 text-7xl sm:text-8xl font-light leading-none tabular-nums">
              {String(d.getDate()).padStart(2, '0')}
            </p>
            <p className="mt-3 label">{DAY_NAMES[d.getDay()]}요일</p>
          </div>
        </div>

        {/* 우측: 일정 정보 */}
        <div className="p-8 sm:p-10 flex flex-col">
          <p className="label text-primary-500">
            {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : 'Next Schedule'}
          </p>
          <h3 className="mt-4 text-2xl font-light leading-snug">{item.title}</h3>

          {item.notes && (
            <p className="mt-4 text-sm leading-[1.85] text-foreground-muted line-clamp-3">{item.notes}</p>
          )}

          <dl className="mt-7 grid grid-cols-2 gap-y-4 gap-x-6 border-t border-line pt-6 text-sm">
            <Detail label="시간" value={item.time || '종일'} />
            <Detail label="프로젝트" value={item.project || '미지정'} />
            {item.endDate && item.endDate > item.date && (
              <Detail label="종료일" value={item.endDate} />
            )}
            {item.repeat && item.repeat !== 'none' && (
              <Detail label="반복" value={repeatLabels[item.repeat]} />
            )}
          </dl>
        </div>
      </div>
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-1.5 text-foreground">{value}</dd>
    </div>
  );
}

function MiniCalendar({
  month,
  onMonthChange,
  datesWithSchedule,
  schedules,
  onScheduleClick,
  categories,
}: {
  month: Date;
  onMonthChange: (d: Date) => void;
  datesWithSchedule: Set<string>;
  onDateClick: (date: string) => void;
  schedules: ScheduleItem[];
  onScheduleClick: (s: ScheduleItem) => void;
  categories: ScheduleCategory[];
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const cells = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const startOffset = firstDay.getDay();
    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

    return Array.from({ length: totalCells }, (_, i) => {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > lastDay.getDate()) {
        return { date: null, dayNum: null };
      }
      const d = new Date(month.getFullYear(), month.getMonth(), dayNum);
      return { date: formatYMD(d), dayNum, dateObj: d };
    });
  }, [month]);

  // 날짜별 일정 인덱스 (셀 안에 표시용)
  const schedulesByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    schedules.forEach((s) => {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    });
    return map;
  }, [schedules]);

  const today = formatYMD(new Date());
  const monthLabel = `${month.getFullYear()}.${String(month.getMonth() + 1).padStart(2, '0')}`;
  const selectedItems = selectedDate ? schedules.filter((s) => s.date === selectedDate) : [];

  return (
    <section>
      <SectionHeader title={monthLabel} />
      {/* 캘린더 컨테이너 — 연한 muted 배경 */}
      <div className="border-b border-line bg-surface-muted">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-line bg-surface">
          {DAY_NAMES.map((d, i) => (
            <div key={d} className={`py-3 text-center label ${i === 0 ? 'text-foreground' : ''}`}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            if (!cell.date) {
              return (
                <div
                  key={i}
                  className="min-h-[72px] sm:min-h-[96px] border-r border-b border-line/60 bg-surface-muted"
                />
              );
            }
            const cellItems = schedulesByDate.get(cell.date) ?? [];
            const isToday = cell.date === today;
            const isSelected = cell.date === selectedDate;
            const isSunday = i % 7 === 0;
            const visibleItems = cellItems.slice(0, 2);
            const overflow = cellItems.length - visibleItems.length;

            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedDate(isSelected ? null : cell.date)}
                className={`min-h-[72px] sm:min-h-[96px] border-r border-b border-line/60 p-1.5 sm:p-2 text-left flex flex-col items-stretch transition-colors ${
                  isSelected
                    ? 'bg-foreground text-surface'
                    : 'bg-surface hover:bg-surface-muted'
                }`}
              >
                {/* 날짜 숫자 */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs tabular-nums ${
                    isSelected
                      ? ''
                      : isToday
                        ? 'text-primary-500 font-semibold'
                        : isSunday
                          ? 'text-foreground'
                          : 'text-foreground-muted'
                  }`}>
                    {cell.dayNum}
                  </span>
                  {isToday && !isSelected && (
                    <span className="text-[8px] tracking-[0.15em] uppercase text-primary-500 hidden sm:inline">
                      TODAY
                    </span>
                  )}
                </div>

                {/* 일정 텍스트 (최대 2개) */}
                {visibleItems.length > 0 && (
                  <div className="mt-1.5 space-y-0.5 overflow-hidden">
                    {visibleItems.map((s) => {
                      const cat = categories.find((c) => c.id === s.category);
                      const cc = cat ? getBadgeColors(cat.color) : null;
                      if (isSelected) {
                        // 선택된 셀: 흰 텍스트 우선
                        return (
                          <p key={s.id} className="text-[10px] sm:text-[11px] leading-tight truncate flex items-center gap-1">
                            <span
                              className="w-1.5 h-1.5 shrink-0"
                              style={{ backgroundColor: cc?.dot ?? '#ffffff' }}
                              aria-hidden
                            />
                            <span className="truncate">{s.title}</span>
                          </p>
                        );
                      }
                      return (
                        <p
                          key={s.id}
                          className="text-[10px] sm:text-[11px] leading-tight truncate px-1 py-px"
                          style={cc ? { backgroundColor: cc.bg, color: cc.text } : undefined}
                          title={s.title}
                        >
                          {s.title}
                        </p>
                      );
                    })}
                    {overflow > 0 && (
                      <p className={`text-[9px] sm:text-[10px] truncate ${
                        isSelected ? 'text-surface/80' : 'text-foreground-faint'
                      }`}>
                        +{overflow}
                      </p>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 이전/다음 달 + 오늘 */}
      <div className="flex items-center justify-between mt-3 text-sm">
        <button
          type="button"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="text-foreground-muted hover:text-foreground transition-colors"
        >
          ← 이전 달
        </button>
        <button
          type="button"
          onClick={() => { const d = new Date(); onMonthChange(new Date(d.getFullYear(), d.getMonth(), 1)); }}
          className="text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          오늘
        </button>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="text-foreground-muted hover:text-foreground transition-colors"
        >
          다음 달 →
        </button>
      </div>

      {/* 선택된 날짜의 일정 미리보기 */}
      {selectedDate && selectedItems.length > 0 && (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {selectedItems.map((s) => {
            const cat = categories.find((c) => c.id === s.category);
            const cc = cat ? getBadgeColors(cat.color) : null;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onScheduleClick(s)}
                  className="w-full flex items-center gap-3 py-3 pl-4 pr-3 hover:bg-surface-muted transition-colors text-left"
                >
                  {cc && (
                    <span
                      className="w-1.5 h-1.5 shrink-0"
                      style={{ backgroundColor: cc.dot }}
                      aria-hidden
                    />
                  )}
                  <span className="text-sm truncate flex-1">{s.title}</span>
                  {cat && cc && (
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 leading-none shrink-0"
                      style={{ backgroundColor: cc.bg, color: cc.text }}
                    >
                      {cat.label}
                    </span>
                  )}
                  <span className="text-xs text-foreground-faint tabular-nums shrink-0">
                    {s.time || '종일'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function MonthGroup({
  monthKey,
  items,
  categories,
  onItemClick,
  onToggleComplete,
}: {
  monthKey: string;
  items: ScheduleItem[];
  categories: ScheduleCategory[];
  onItemClick: (s: ScheduleItem) => void;
  onToggleComplete: (id: string) => void;
}) {
  const [y, m] = monthKey.split('-').map(Number);
  const monthLabel = `${y}.${String(m).padStart(2, '0')} · ${MONTHS_EN[m - 1]}`;

  return (
    <div className="mt-12 first:mt-6">
      <p className="label">{monthLabel}</p>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {items.map((s) => {
          const d = new Date(s.date);
          const cat = categories.find((c) => c.id === s.category);
          const isToday = isSameDay(d, new Date());
          const cc = cat ? getBadgeColors(cat.color) : null;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onItemClick(s)}
                className={`w-full grid grid-cols-[28px_88px_1fr_auto] items-center gap-3 sm:gap-5 py-5 pl-4 pr-4 sm:pl-5 hover:bg-surface-muted transition-colors text-left ${s.completed ? 'opacity-55' : ''}`}
              >
                {/* 완료 체크 (체크리스트) */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); onToggleComplete(s.id); }}
                  aria-label={s.completed ? '완료 취소' : '완료'}
                  className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-colors ${
                    s.completed ? 'bg-primary-500 border-primary-500 text-white' : 'border-foreground-faint text-transparent hover:border-primary-400'
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>

                {/* 왼쪽: 날짜 (좌측 컬러 라인 + 큰 숫자) */}
                <div className="flex items-stretch gap-3 border-r border-line pr-4">
                  <span
                    className="w-[3px] shrink-0"
                    style={{ backgroundColor: cc?.dot ?? 'var(--color-line)' }}
                    aria-hidden
                  />
                  <div>
                    <p className="text-[10px] tracking-[0.2em] uppercase text-foreground-faint">
                      {MONTHS_EN[d.getMonth()]}
                    </p>
                    <p className={`mt-1 text-2xl font-light leading-none tabular-nums ${
                      isToday ? 'text-primary-500' : ''
                    }`}>
                      {String(d.getDate()).padStart(2, '0')}
                    </p>
                    <p className="mt-1.5 text-[10px] tracking-[0.15em] text-foreground-faint">
                      {DAY_NAMES[d.getDay()]}
                    </p>
                  </div>
                </div>

                {/* 가운데: 제목 + 메타 */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.isMilestone && <span className="shrink-0" title="절대 놓치면 안 되는 마감">🚩</span>}
                    <p className={`text-base truncate ${s.completed ? 'line-through text-foreground-faint' : ''}`}>{s.title}</p>
                    {s.generatedBy && s.generatedBy !== 'manual' && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 leading-none bg-primary-50 text-primary-600 rounded-full" title="AI 일정 비서가 만든 일정">🤖 AI</span>
                    )}
                    {cat && cc && (
                      <span
                        className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 leading-none shrink-0"
                        style={{ backgroundColor: cc.bg, color: cc.text }}
                      >
                        <span
                          className="w-1.5 h-1.5 shrink-0"
                          style={{ backgroundColor: cc.dot }}
                          aria-hidden
                        />
                        {cat.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-foreground-muted truncate">
                    {s.project || '프로젝트 미지정'}
                    {s.endDate && s.endDate > s.date && ` · ${s.endDate.slice(5).replace('-', '/')}까지`}
                  </p>
                </div>

                {/* 오른쪽: 시간 + ICS */}
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-foreground-faint tabular-nums">
                    {s.time || '종일'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); downloadIcs(s); }}
                    aria-label="ICS 내보내기"
                    className="w-7 h-7 flex items-center justify-center border border-line text-foreground-muted hover:border-foreground hover:text-foreground transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v12" />
                      <path d="M7 10l5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>
                  </button>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface AddFormProps {
  form: {
    title: string; date: string; endDate?: string; time: string; project: string;
    category: string; repeat: RepeatType; reminder: string; notes: string;
    tagInput: string; tags: string[];
  };
  setForm: React.Dispatch<React.SetStateAction<AddFormProps['form']>>;
  categories: ScheduleCategory[];
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  onAddTag: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function AddForm({ form, setForm, categories, showAdvanced, setShowAdvanced, onAddTag, onCancel, onSubmit }: AddFormProps) {
  return (
    <section className="border border-line p-6 sm:p-8 space-y-6 bg-surface">
      <p className="label">New Schedule</p>

      {/* 제목 */}
      <label className="block space-y-2">
        <span className="label">제목</span>
        <input
          type="text"
          placeholder="일정 제목"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full border border-line bg-surface px-4 py-3 text-base placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
        />
      </label>

      {/* 날짜 */}
      <label className="block space-y-2">
        <span className="label">날짜 / 시간</span>
        <DateRangePicker
          date={form.date}
          endDate={form.endDate}
          time={form.time}
          onDateChange={(d) => setForm({ ...form, date: d })}
          onEndDateChange={(ed) => setForm({ ...form, endDate: ed })}
          onTimeChange={(t) => setForm({ ...form, time: t })}
        />
      </label>

      {/* 프로젝트 */}
      <label className="block space-y-2">
        <span className="label">프로젝트</span>
        <ProjectSelect value={form.project} onChange={(v) => setForm({ ...form, project: v })} />
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
                className={`px-4 py-1.5 text-xs border transition-colors ${
                  active
                    ? 'bg-foreground text-surface border-foreground'
                    : 'bg-surface text-foreground-muted border-line hover:border-foreground hover:text-foreground'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 태그 */}
      <div className="space-y-2">
        <p className="label">태그</p>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {form.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1.5 text-xs border border-line px-2.5 py-1">
                #{tag}
                <button
                  type="button"
                  onClick={() => setForm({ ...form, tags: form.tags.filter((t) => t !== tag) })}
                  className="text-foreground-faint hover:text-foreground"
                >×</button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          placeholder="태그 입력 후 Enter"
          value={form.tagInput}
          onChange={(e) => setForm({ ...form, tagInput: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onAddTag();
            }
          }}
          className="w-full border border-line bg-surface px-4 py-2.5 text-sm placeholder:text-foreground-faint focus:border-foreground focus:outline-none transition-colors"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-xs text-foreground-muted hover:text-foreground transition-colors"
      >
        {showAdvanced ? '간단히 보기 ▲' : '더 보기 (반복 / 알림 / 비고) ▼'}
      </button>

      {showAdvanced && (
        <div className="space-y-6 pt-2 border-t border-line">
          <div className="grid grid-cols-2 gap-4">
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
            <label className="block space-y-2">
              <span className="label">알림</span>
              <select
                value={form.reminder}
                onChange={(e) => setForm({ ...form, reminder: e.target.value })}
                className="w-full border border-line bg-surface px-3 py-2.5 text-sm focus:border-foreground focus:outline-none transition-colors"
              >
                <option value="none">없음</option>
                <option value="10min">10분 전</option>
                <option value="30min">30분 전</option>
                <option value="1hour">1시간 전</option>
                <option value="1day">1일 전</option>
              </select>
            </label>
          </div>
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
        </div>
      )}

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
          disabled={!form.title.trim() || !form.date}
          className="border border-foreground bg-foreground px-6 py-2.5 text-sm text-surface hover:bg-foreground-muted hover:border-foreground-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          추가
        </button>
      </div>
    </section>
  );
}
