/**
 * @file src/components/calendar/CalendarView.tsx
 * @description 캘린더 뷰 — 할일/일정 페이지 공용
 *
 * [할일 캘린더] 주간 뷰 — "언제까지 해야 하나?" (마감 중심)
 * - 7일 컬럼, 하루에 할일이 전부 펼쳐짐
 * - 상태 토글(체크박스) 바로 사용 가능
 * - 일정은 날짜 아래 색깔 점으로만 표시
 * - 디테일 패널: 할일 위 → 일정 접기 아래
 *
 * [일정 캘린더] 월간 뷰 — "그날 뭐가 있나?" (시간 중심)
 * - 범위 일정 바 오버레이
 * - 할일은 "마감 N" 배지
 * - 디테일 패널: 일정 위 → 할일 접기 아래
 */
import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCenter,
} from '@dnd-kit/core';
import { TaskItem, ScheduleItem, ScheduleCategory } from '../../types';
import { getBadgeColors } from '../../utils/colorUtils';

/* ─────────── types ─────────── */

interface CalendarViewProps {
  mode: 'tasks' | 'schedules';
  tasks: TaskItem[];
  schedules: ScheduleItem[];
  taskCategories: ScheduleCategory[];
  scheduleCategories: ScheduleCategory[];
  onTaskClick: (task: TaskItem) => void;
  onScheduleClick: (schedule: ScheduleItem) => void;
  onTaskDateChange: (id: string, newDate: string) => void;
  onScheduleDateChange: (id: string, newDate: string) => void;
  onTaskStatusCycle?: (id: string) => void;
}

type DragItem = { type: 'task'; item: TaskItem } | { type: 'schedule'; item: ScheduleItem };

interface RangeBarSegment {
  scheduleId: string; title: string; color: string;
  startCol: number; endCol: number; lane: number;
  isRangeStart: boolean; isRangeEnd: boolean;
}

/* ─────────── helpers ─────────── */

const toYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayStr = () => toYMD(new Date());

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function getCalendarDays(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstDay.getDay());
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) week.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d));
    weeks.push(week);
  }
  return weeks;
}

/** 주어진 날짜가 속한 주의 일요일 반환 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const statusColor: Record<string, string> = { completed: '#22c55e', in_progress: '#3b82f6', pending: '#d1d5db' };
const BAR_HEIGHT = 16;

/* ─────────── shared sub-components ─────────── */

function DraggableItem({ dragId, children }: { dragId: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={isDragging ? 'opacity-30 z-50' : ''}>
      {children}
    </div>
  );
}

function TaskPreviewRow({ task, category, onClick, onStatusCycle }: {
  task: TaskItem; category?: ScheduleCategory; onClick: () => void; onStatusCycle?: () => void;
}) {
  return (
    <DraggableItem dragId={`task-${task.id}`}>
      <div onClick={onClick} className="flex items-start gap-2 px-1 py-2 cursor-pointer active:bg-gray-50 rounded-lg transition-colors">
        <button onClick={(e) => { e.stopPropagation(); onStatusCycle?.(); }}
          className="flex-shrink-0 w-5 h-5 mt-[2px] flex items-center justify-center transition-colors">
          {task.status === 'completed' && (
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
              <circle cx="10" cy="10" r="9" fill="#4ade80" stroke="#22c55e" strokeWidth="1" />
              <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {task.status === 'in_progress' && (
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
              <circle cx="10" cy="10" r="9" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
              <path d="M10 6.5v3.5l2 2" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {task.status === 'pending' && (
            <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
              <circle cx="10" cy="10" r="9" fill="white" stroke="#d1d5db" strokeWidth="1.5" />
            </svg>
          )}
        </button>
        <div className="w-[3px] h-4 rounded-full flex-shrink-0 mt-[3px]" style={{ backgroundColor: category?.color || '#d1d5db' }} />
        <span className={`text-[13px] leading-5 flex-1 min-w-0 ${task.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{task.title}</span>
        {category && (() => { const cc = getBadgeColors(category.color); return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: cc.bg, color: cc.text }}><span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cc.dot }} />{category.label}</span>; })()}
      </div>
    </DraggableItem>
  );
}

function SchedulePreviewRow({ schedule, category, onClick }: {
  schedule: ScheduleItem; category?: ScheduleCategory; onClick: () => void;
}) {
  const barColor = category?.color || '#fb923c';
  const hasRange = schedule.endDate && schedule.endDate > schedule.date;
  const fmt = (ds: string) => { const d = new Date(ds + 'T00:00:00'); return `${d.getMonth() + 1}/${d.getDate()}`; };
  return (
    <DraggableItem dragId={`schedule-${schedule.id}`}>
      <div onClick={onClick} className="flex items-center gap-3 px-1 py-2 cursor-pointer active:bg-gray-50 rounded-lg transition-colors">
        <div className="w-[3px] h-5 rounded-full flex-shrink-0" style={{ backgroundColor: barColor }} />
        <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">{hasRange ? `${fmt(schedule.date)}~${fmt(schedule.endDate!)}` : schedule.time || '종일'}</span>
        <span className="text-[13px] text-gray-800 flex-1 min-w-0 truncate">{schedule.title}</span>
        {category && (() => { const cc = getBadgeColors(category.color); return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: cc.bg, color: cc.text }}><span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cc.dot }} />{category.label}</span>; })()}
      </div>
    </DraggableItem>
  );
}

/* ══════════════════════════════════════════════════════════
   주간 뷰 (할일 캘린더)
   ══════════════════════════════════════════════════════════ */

function WeeklyTaskView({
  tasks, schedules, taskCategories, scheduleCategories,
  onTaskClick, onScheduleClick, onTaskDateChange, onTaskStatusCycle,
  dragItem, setDragItem,
}: CalendarViewProps & { dragItem: DragItem | null; setDragItem: (d: DragItem | null) => void }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>('');

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const today = todayStr();

  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    tasks.forEach((t) => { if (t.date) (map[t.date] ??= []).push(t); });
    return map;
  }, [tasks]);

  // 날짜별 일정 색깔 도트 (단일 + 범위)
  const rangeSchedules = useMemo(() => schedules.filter((s) => s.endDate && s.endDate > s.date), [schedules]);
  const singleSchedules = useMemo(() => schedules.filter((s) => !s.endDate || s.endDate <= s.date), [schedules]);

  const scheduleDotsByDate = useMemo(() => {
    const map: Record<string, string[]> = {};
    singleSchedules.forEach((s) => {
      const cat = scheduleCategories.find((c) => c.id === s.category);
      (map[s.date] ??= []).push(cat?.color || '#fb923c');
    });
    rangeSchedules.forEach((s) => {
      const cat = scheduleCategories.find((c) => c.id === s.category);
      const color = cat?.color || '#fb923c';
      const start = new Date(s.date + 'T00:00:00');
      const end = new Date(s.endDate! + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) (map[toYMD(d)] ??= []).push(color);
    });
    return map;
  }, [singleSchedules, rangeSchedules, scheduleCategories]);

  // 선택일 일정 (단일 + 범위)
  const singleSchedulesByDate = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    singleSchedules.forEach((s) => { (map[s.date] ??= []).push(s); });
    return map;
  }, [singleSchedules]);

  const selectedSchedules = useMemo(() => {
    const result: ScheduleItem[] = [];
    const seen = new Set<string>();
    (singleSchedulesByDate[selectedDate] ?? []).forEach((s) => { seen.add(s.id); result.push(s); });
    rangeSchedules.forEach((s) => {
      if (!seen.has(s.id) && selectedDate >= s.date && selectedDate <= s.endDate!) { seen.add(s.id); result.push(s); }
    });
    return result;
  }, [singleSchedulesByDate, rangeSchedules, selectedDate]);

  const selectedTasks = tasksByDate[selectedDate] ?? [];

  const prevWeek = useCallback(() => {
    setWeekStart((ws) => { const d = new Date(ws); d.setDate(d.getDate() - 7); return d; });
  }, []);
  const nextWeek = useCallback(() => {
    setWeekStart((ws) => { const d = new Date(ws); d.setDate(d.getDate() + 7); return d; });
  }, []);
  const goToday = useCallback(() => {
    setWeekStart(getWeekStart(new Date()));
    setSelectedDate(todayStr());
  }, []);

  // 주 라벨
  const weekLabel = useMemo(() => {
    const s = weekDays[0];
    const e = weekDays[6];
    if (s.getMonth() === e.getMonth()) {
      return `${s.getFullYear()}년 ${s.getMonth() + 1}월 ${s.getDate()}일 - ${e.getDate()}일`;
    }
    return `${s.getMonth() + 1}/${s.getDate()} - ${e.getMonth() + 1}/${e.getDate()}`;
  }, [weekDays]);

  const isThisWeek = toYMD(weekDays[0]) === toYMD(getWeekStart(new Date()));

  const selectedDateLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  }, [selectedDate]);

  return (
    <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
      {/* ── 주 네비게이션 ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button onClick={prevWeek} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 active:bg-gray-200 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[14px] sm:text-[15px] font-semibold text-gray-900">{weekLabel}</span>
          {!isThisWeek && (
            <button onClick={goToday} className="text-[11px] px-2 py-0.5 text-red-500 hover:bg-red-50 rounded-full font-medium transition-colors">이번 주</button>
          )}
        </div>
        <button onClick={nextWeek} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 active:bg-gray-200 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>

      {/* ── 7일 컬럼 그리드 ── */}
      <div className="grid grid-cols-7 border-t border-gray-100">
        {weekDays.map((date) => {
          const dateStr = toYMD(date);
          const isToday = dateStr === today;
          const isSelected = dateStr === selectedDate;
          const dayTasks = tasksByDate[dateStr] ?? [];
          const dots = scheduleDotsByDate[dateStr] ?? [];
          const dayNum = date.getDay();

          return (
            <WeekDayColumn
              key={dateStr}
              dateStr={dateStr}
              date={date}
              dayNum={dayNum}
              isToday={isToday}
              isSelected={isSelected}
              tasks={dayTasks}
              scheduleDotColors={dots}
              taskDotColors={[]}
              onClick={() => setSelectedDate(dateStr)}
              onStatusCycle={onTaskStatusCycle}
            />
          );
        })}
      </div>

      {/* ── 데스크탑: 인라인 디테일 패널 ── */}
      <div className="hidden sm:block border-t border-gray-100">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-gray-900">{selectedDateLabel}</span>
          {selectedTasks.length > 0 && (
            <span className="text-[11px] text-gray-400">할일 {selectedTasks.length}건</span>
          )}
        </div>
        <div className="px-3 pb-2 max-h-[300px] overflow-y-auto">
          {selectedTasks.length === 0 && selectedSchedules.length === 0 ? (
            <div className="pb-1" />
          ) : (
            <div>
              {selectedTasks.length > 0 && (
                <div className="divide-y divide-gray-50">
                  {selectedTasks.map((t) => (
                    <TaskPreviewRow key={t.id} task={t}
                      category={taskCategories.find((c) => c.id === t.category)}
                      onClick={() => onTaskClick(t)}
                      onStatusCycle={onTaskStatusCycle ? () => onTaskStatusCycle(t.id) : undefined} />
                  ))}
                </div>
              )}
              <ScheduleRefSection schedules={selectedSchedules} scheduleCategories={scheduleCategories} onScheduleClick={onScheduleClick} />
            </div>
          )}
        </div>
      </div>

      {/* ── 모바일: 하단 시트 ── */}
      {(selectedTasks.length > 0 || selectedSchedules.length > 0) && (
        <MobileBottomSheet
          dateLabel={selectedDateLabel}
          tasks={selectedTasks}
          schedules={selectedSchedules}
          taskCategories={taskCategories}
          scheduleCategories={scheduleCategories}
          onTaskClick={onTaskClick}
          onScheduleClick={onScheduleClick}
          onTaskStatusCycle={onTaskStatusCycle}
          onClose={() => setSelectedDate('')}
        />
      )}
    </div>
  );
}

/** 모바일 하단 시트 */
function MobileBottomSheet({ dateLabel, tasks, schedules, taskCategories, scheduleCategories, onTaskClick, onScheduleClick, onTaskStatusCycle, onClose }: {
  dateLabel: string; tasks: TaskItem[]; schedules: ScheduleItem[];
  taskCategories: ScheduleCategory[]; scheduleCategories: ScheduleCategory[];
  onTaskClick: (t: TaskItem) => void; onScheduleClick: (s: ScheduleItem) => void;
  onTaskStatusCycle?: (id: string) => void; onClose: () => void;
}) {
  return (
    <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 animate-slide-up">
      {/* 배경 오버레이 */}
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />
      {/* 시트 */}
      <div className="relative bg-white rounded-t-2xl shadow-xl max-h-[55vh] flex flex-col">
        {/* 핸들 + 헤더 */}
        <div className="pt-2 pb-1 px-4">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-2" />
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-semibold text-gray-900">{dateLabel}</span>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        {/* 콘텐츠 */}
        <div className="overflow-y-auto px-3 pb-6">
          {tasks.length > 0 && (
            <div className="divide-y divide-gray-50">
              {tasks.map((t) => (
                <TaskPreviewRow key={t.id} task={t}
                  category={taskCategories.find((c) => c.id === t.category)}
                  onClick={() => onTaskClick(t)}
                  onStatusCycle={onTaskStatusCycle ? () => onTaskStatusCycle(t.id) : undefined} />
              ))}
            </div>
          )}
          {schedules.length > 0 && (
            <div className={tasks.length > 0 ? 'mt-2 pt-1 border-t border-gray-100' : ''}>
              <div className="text-[11px] text-gray-400 px-1 py-1 font-medium">일정 ({schedules.length})</div>
              {schedules.map((s) => {
                const cat = scheduleCategories.find((c) => c.id === s.category);
                return (
                  <SchedulePreviewRow key={s.id} schedule={s} category={cat} onClick={() => onScheduleClick(s)} />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 주간 뷰 — 하루 컬럼 */
function WeekDayColumn({ dateStr, date, dayNum, isToday, isSelected, tasks, scheduleDotColors, taskDotColors, onClick, onStatusCycle }: {
  dateStr: string; date: Date; dayNum: number; isToday: boolean; isSelected: boolean;
  tasks: TaskItem[]; scheduleDotColors: string[]; taskDotColors: string[]; onClick: () => void;
  onStatusCycle?: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`flex flex-col border-r last:border-r-0 border-gray-100 cursor-pointer transition-colors
        ${isOver ? 'bg-green-50' : ''}
        ${isSelected ? 'bg-green-50/50' : 'hover:bg-gray-50/30'}
      `}
    >
      {/* 요일 + 날짜 헤더 */}
      <div className="text-center pt-2 pb-1">
        <div className={`text-[10px] font-medium mb-0.5 ${dayNum === 0 ? 'text-red-300' : dayNum === 6 ? 'text-blue-300' : 'text-gray-400'}`}>
          {DAY_NAMES[dayNum]}
        </div>
        <span className={`inline-flex w-7 h-7 items-center justify-center rounded-full text-[13px] leading-none
          ${isToday ? 'bg-red-500 text-white font-bold' : ''}
          ${isSelected && !isToday ? 'bg-green-500 text-white font-semibold' : ''}
          ${!isSelected && !isToday ? `font-semibold ${dayNum === 0 ? 'text-red-400' : dayNum === 6 ? 'text-blue-400' : 'text-gray-700'}` : ''}
        `}>
          {date.getDate()}
        </span>
      </div>

      {/* 일정 색깔 점 */}
      {scheduleDotColors.length > 0 && (
        <div className="flex justify-center gap-[2px] pb-1">
          {scheduleDotColors.slice(0, 5).map((color, i) => (
            <div key={i} className="w-[5px] h-[5px] rounded-full" style={{ backgroundColor: color }} />
          ))}
        </div>
      )}

      {/* ── 모바일: 할일 도트만 ── */}
      <div className="sm:hidden flex-1 px-1 pt-2 pb-6">
        {tasks.length > 0 && (
          <div className="flex flex-wrap justify-center gap-[4px]">
            {tasks.slice(0, 6).map((t, i) => (
              <div key={i} className="w-[6px] h-[6px] rounded-full border"
                style={{
                  borderColor: statusColor[t.status],
                  backgroundColor: t.status === 'completed' ? statusColor.completed : t.status === 'in_progress' ? '#dbeafe' : 'white',
                }} />
            ))}
            {tasks.length > 6 && <span className="text-[7px] text-gray-400 leading-none">+{tasks.length - 6}</span>}
          </div>
        )}
      </div>

      {/* ── 데스크탑: 할일 텍스트 리스트 ── */}
      <div className="hidden sm:block flex-1 px-[2px] pb-1 space-y-[2px]" style={{ minHeight: 100 }}>
        {tasks.slice(0, 5).map((t) => (
          <div key={t.id} className="flex items-start gap-[3px] px-[3px] py-[2px] rounded transition-colors hover:bg-green-50/50">
            <button
              onClick={(e) => { e.stopPropagation(); onStatusCycle?.(t.id); }}
              className="flex-shrink-0 w-[12px] h-[12px] mt-[1px] rounded-full border-[1.5px] flex items-center justify-center"
              style={{
                borderColor: statusColor[t.status],
                backgroundColor: t.status === 'completed' ? statusColor.completed : 'transparent',
              }}
            >
              {t.status === 'completed' && <svg width="6" height="6" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M2 6l3 3 5-5" /></svg>}
              {t.status === 'in_progress' && <div className="w-[4px] h-[4px] rounded-full bg-blue-500" />}
            </button>
            <span className={`text-[10px] leading-[14px] break-words ${
              t.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700'
            }`}>
              {t.title}
            </span>
          </div>
        ))}
        {tasks.length > 5 && (
          <span className="text-[9px] text-green-500 font-medium pl-1 leading-none">+{tasks.length - 5}개</span>
        )}
      </div>
    </div>
  );
}

/** 할일 캘린더 디테일 — 일정 접기 섹션 */
function ScheduleRefSection({ schedules, scheduleCategories, onScheduleClick }: {
  schedules: ScheduleItem[]; scheduleCategories: ScheduleCategory[];
  onScheduleClick: (s: ScheduleItem) => void;
}) {
  const [open, setOpen] = useState(false);
  if (schedules.length === 0) return null;
  return (
    <div className="mt-2 pt-1 border-t border-gray-100">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-1 py-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={`transition-transform ${open ? 'rotate-90' : ''}`}><path d="M6 4l4 4-4 4" /></svg>
        일정 ({schedules.length})
      </button>
      {open && (
        <div className="pl-1">
          {schedules.map((s) => {
            const cat = scheduleCategories.find((c) => c.id === s.category);
            const color = cat?.color || '#fb923c';
            return (
              <div key={s.id} onClick={() => onScheduleClick(s)}
                className="flex items-center gap-2 px-1 py-1.5 cursor-pointer hover:bg-gray-50 rounded transition-colors">
                <div className="w-[3px] h-4 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[11px] text-gray-400 flex-shrink-0 tabular-nums">{s.time || '종일'}</span>
                <span className="text-[12px] text-gray-600 truncate">{s.title}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   월간 뷰 (일정 캘린더)
   ══════════════════════════════════════════════════════════ */

function MonthlyScheduleView({
  tasks, schedules, taskCategories, scheduleCategories,
  onTaskClick, onScheduleClick, onScheduleDateChange, onTaskDateChange, onTaskStatusCycle,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string>('');

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const weeks = useMemo(() => getCalendarDays(year, month), [year, month]);
  const today = todayStr();

  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    tasks.forEach((t) => { if (t.date) (map[t.date] ??= []).push(t); });
    return map;
  }, [tasks]);

  const rangeSchedules = useMemo(() => schedules.filter((s) => s.endDate && s.endDate > s.date), [schedules]);
  const singleSchedules = useMemo(() => schedules.filter((s) => !s.endDate || s.endDate <= s.date), [schedules]);
  const singleSchedulesByDate = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {};
    singleSchedules.forEach((s) => { (map[s.date] ??= []).push(s); });
    return map;
  }, [singleSchedules]);

  const rangeBarsByWeek = useMemo(() => {
    return weeks.map((week) => {
      const weekStart = toYMD(week[0]);
      const weekEnd = toYMD(week[6]);
      const segments: RangeBarSegment[] = [];
      rangeSchedules.forEach((s) => {
        if (s.endDate! < weekStart || s.date > weekEnd) return;
        const cat = scheduleCategories.find((c) => c.id === s.category);
        const startCol = s.date <= weekStart ? 0 : week.findIndex((d) => toYMD(d) === s.date);
        const endCol = s.endDate! >= weekEnd ? 6 : week.findIndex((d) => toYMD(d) === s.endDate);
        segments.push({ scheduleId: s.id, title: s.title, color: cat?.color || '#fb923c', startCol: Math.max(0, startCol), endCol: Math.min(6, endCol), lane: 0, isRangeStart: s.date >= weekStart, isRangeEnd: s.endDate! <= weekEnd });
      });
      segments.sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
      const laneEnds: number[] = [];
      segments.forEach((seg) => {
        let lane = laneEnds.findIndex((end) => end < seg.startCol);
        if (lane === -1) { lane = laneEnds.length; laneEnds.push(-1); }
        seg.lane = lane;
        laneEnds[lane] = seg.endCol;
      });
      return { segments, maxLanes: laneEnds.length };
    });
  }, [weeks, rangeSchedules, scheduleCategories]);

  const selectedTasks = tasksByDate[selectedDate] ?? [];
  const selectedSchedules = useMemo(() => {
    const result: ScheduleItem[] = [];
    const seen = new Set<string>();
    (singleSchedulesByDate[selectedDate] ?? []).forEach((s) => { seen.add(s.id); result.push(s); });
    rangeSchedules.forEach((s) => {
      if (!seen.has(s.id) && selectedDate >= s.date && selectedDate <= s.endDate!) { seen.add(s.id); result.push(s); }
    });
    return result;
  }, [singleSchedulesByDate, rangeSchedules, selectedDate]);

  const prevMonth = useCallback(() => setCurrentMonth(new Date(year, month - 1, 1)), [year, month]);
  const nextMonth = useCallback(() => setCurrentMonth(new Date(year, month + 1, 1)), [year, month]);
  const goToday = useCallback(() => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayStr());
  }, []);

  const selectedDateLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });
  }, [selectedDate]);

  const hasItems = selectedSchedules.length > 0 || selectedTasks.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg></button>
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-gray-900">{year}년 {month + 1}월</span>
          {!(year === new Date().getFullYear() && month === new Date().getMonth()) && (
            <button onClick={goToday} className="text-[11px] px-2 py-0.5 text-red-500 hover:bg-red-50 rounded-full font-medium transition-colors">오늘</button>
          )}
        </div>
        <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg></button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAY_NAMES.map((day, i) => (
          <div key={day} className={`text-center py-1.5 text-[11px] font-medium ${i === 0 ? 'text-red-300' : i === 6 ? 'text-blue-300' : 'text-gray-400'}`}>{day}</div>
        ))}
      </div>

      {/* 월간 그리드 */}
      <div>
        {weeks.map((week, wi) => {
          const { segments, maxLanes } = rangeBarsByWeek[wi];
          return (
            <div key={wi} className="relative">
              {segments.length > 0 && (
                <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: 28 }}>
                  {segments.map((seg) => (
                    <div key={`${seg.scheduleId}-w${wi}`}
                      className={`absolute flex items-center pointer-events-auto cursor-pointer overflow-hidden ${seg.isRangeStart ? 'rounded-l-[4px]' : ''} ${seg.isRangeEnd ? 'rounded-r-[4px]' : ''}`}
                      style={{ left: `${(seg.startCol / 7) * 100}%`, width: `${((seg.endCol - seg.startCol + 1) / 7) * 100}%`, top: seg.lane * BAR_HEIGHT, height: BAR_HEIGHT - 2, backgroundColor: getBadgeColors(seg.color).bg }}
                      onClick={(e) => { e.stopPropagation(); const s = schedules.find((s) => s.id === seg.scheduleId); if (s) onScheduleClick(s); }}>
                      {seg.isRangeStart && <div className="w-[3px] h-[10px] rounded-full flex-shrink-0 ml-1" style={{ backgroundColor: seg.color }} />}
                      <span className="text-[8px] sm:text-[10px] text-gray-700 truncate px-1 leading-none font-medium">{seg.isRangeStart ? seg.title : ''}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-7">
                {week.map((date) => {
                  const dateStr = toYMD(date);
                  return (
                    <MonthlyCell
                      key={dateStr}
                      date={date}
                      month={month}
                      isToday={dateStr === today}
                      isSelected={dateStr === selectedDate}
                      singleSchedules={singleSchedulesByDate[dateStr] ?? []}
                      taskCount={(tasksByDate[dateStr] ?? []).length}
                      maxLanes={maxLanes}
                      scheduleCategories={scheduleCategories}
                      onClick={() => setSelectedDate(dateStr)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* 선택 날짜 미리보기 */}
      <div className="border-t border-gray-100">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-[13px] font-semibold text-gray-900">{selectedDateLabel}</span>
          {hasItems && <span className="text-[11px] text-gray-400">일정 {selectedSchedules.length}건</span>}
        </div>
        <div className="px-3 pb-3 max-h-[280px] overflow-y-auto">
          {!hasItems ? null : (
            <div>
              <div className="divide-y divide-gray-50">
                {selectedSchedules.map((s) => (
                  <SchedulePreviewRow key={s.id} schedule={s} category={scheduleCategories.find((c) => c.id === s.category)} onClick={() => onScheduleClick(s)} />
                ))}
              </div>
              {selectedTasks.length > 0 && (
                <TaskRefSectionForSchedule tasks={selectedTasks} taskCategories={taskCategories} onTaskClick={onTaskClick} onTaskStatusCycle={onTaskStatusCycle} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** 월간 뷰 — 일정 셀 */
function MonthlyCell({ date, month, isToday, isSelected, singleSchedules: daySingleSchedules, taskCount, maxLanes, scheduleCategories, onClick }: {
  date: Date; month: number; isToday: boolean; isSelected: boolean;
  singleSchedules: ScheduleItem[]; taskCount: number; maxLanes: number;
  scheduleCategories: ScheduleCategory[]; onClick: () => void;
}) {
  const dateStr = toYMD(date);
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  const dayNum = date.getDay();

  return (
    <div ref={setNodeRef} onClick={onClick}
      className={`flex flex-col p-0.5 sm:p-1 cursor-pointer border-b border-r border-gray-100 transition-colors
        ${isOver ? 'bg-orange-50' : ''} ${isSelected ? 'bg-orange-50/40' : 'hover:bg-gray-50/50'} ${date.getMonth() !== month ? 'opacity-30' : ''}`}
      style={{ minHeight: 54 + maxLanes * BAR_HEIGHT }}>
      <div className="flex justify-center mb-0.5">
        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[11px] sm:text-xs leading-none
          ${isToday && isSelected ? 'bg-red-500 text-white font-bold' : ''} ${isToday && !isSelected ? 'text-red-500 font-bold' : ''}
          ${isSelected && !isToday ? 'bg-gray-800 text-white font-semibold' : ''}
          ${!isSelected && !isToday ? `font-medium ${dayNum === 0 ? 'text-red-400' : dayNum === 6 ? 'text-blue-400' : 'text-gray-600'}` : ''}`}>
          {date.getDate()}
        </span>
      </div>
      {maxLanes > 0 && <div style={{ height: maxLanes * BAR_HEIGHT }} />}
      <div className="flex-1 space-y-[1px] overflow-hidden">
        {daySingleSchedules.slice(0, 3).map((s) => {
          const cat = scheduleCategories.find((c) => c.id === s.category);
          const color = cat?.color || '#fb923c';
          return (
            <div key={s.id} className="flex items-center gap-[2px] px-[2px] rounded-sm overflow-hidden" style={{ backgroundColor: getBadgeColors(color).bg }}>
              <div className="w-[3px] h-[12px] sm:h-[14px] rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[8px] sm:text-[10px] text-gray-700 truncate leading-[12px] sm:leading-[14px]">{s.title}</span>
            </div>
          );
        })}
        {daySingleSchedules.length > 3 && <span className="text-[8px] text-gray-400 pl-1">+{daySingleSchedules.length - 3}</span>}
      </div>
      {taskCount > 0 && (
        <div className="flex justify-end mt-auto">
          <span className="text-[7px] sm:text-[8px] text-gray-400 bg-gray-100 rounded px-1 leading-[14px]">마감 {taskCount}</span>
        </div>
      )}
    </div>
  );
}

/** 일정 캘린더 디테일 — 할일 참조 접기 */
function TaskRefSectionForSchedule({ tasks, taskCategories, onTaskClick, onTaskStatusCycle }: {
  tasks: TaskItem[]; taskCategories: ScheduleCategory[];
  onTaskClick: (t: TaskItem) => void; onTaskStatusCycle?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 pt-1 border-t border-gray-100">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-1 py-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={`transition-transform ${open ? 'rotate-90' : ''}`}><path d="M6 4l4 4-4 4" /></svg>
        마감 할일 ({tasks.length})
      </button>
      {open && (
        <div className="divide-y divide-gray-50 pl-1">
          {tasks.map((t) => (
            <TaskPreviewRow key={t.id} task={t} category={taskCategories.find((c) => c.id === t.category)}
              onClick={() => onTaskClick(t)} onStatusCycle={onTaskStatusCycle ? () => onTaskStatusCycle(t.id) : undefined} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────── main export ─────────── */

export function CalendarView(props: CalendarViewProps) {
  const [dragItem, setDragItem] = useState<DragItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith('task-')) {
      const task = props.tasks.find((t) => t.id === id.replace('task-', ''));
      if (task) setDragItem({ type: 'task', item: task });
    } else if (id.startsWith('schedule-')) {
      const s = props.schedules.find((s) => s.id === id.replace('schedule-', ''));
      if (s) setDragItem({ type: 'schedule', item: s });
    }
  }, [props.tasks, props.schedules]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDragItem(null);
    const { active, over } = event;
    if (!over) return;
    const targetDate = String(over.id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return;
    const activeId = String(active.id);
    if (activeId.startsWith('task-')) {
      const taskId = activeId.replace('task-', '');
      const task = props.tasks.find((t) => t.id === taskId);
      if (task && task.date !== targetDate) props.onTaskDateChange(taskId, targetDate);
    } else if (activeId.startsWith('schedule-')) {
      const scheduleId = activeId.replace('schedule-', '');
      const schedule = props.schedules.find((s) => s.id === scheduleId);
      if (schedule && schedule.date !== targetDate) props.onScheduleDateChange(scheduleId, targetDate);
    }
  }, [props]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

      {props.mode === 'tasks' ? (
        <WeeklyTaskView {...props} dragItem={dragItem} setDragItem={setDragItem} />
      ) : (
        <MonthlyScheduleView {...props} />
      )}

      <DragOverlay>
        {dragItem?.type === 'task' && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-lg border border-gray-200 max-w-[260px]">
            <div className="w-[3px] h-4 rounded-full" style={{ backgroundColor: props.taskCategories.find(c => c.id === dragItem.item.category)?.color || '#d1d5db' }} />
            <span className="text-[13px] text-gray-800 truncate">{dragItem.item.title}</span>
          </div>
        )}
        {dragItem?.type === 'schedule' && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-xl shadow-lg border border-gray-200 max-w-[260px]">
            <div className="w-[3px] h-4 rounded-full bg-orange-400" />
            <span className="text-[13px] text-gray-800 truncate">{dragItem.item.title}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
