/**
 * @file src/components/tasks/TaskListItem.tsx
 * @description 할일 아이템 컴포넌트
 * - □ 제목  프로젝트태그  마감일(D-n)
 * - 인라인 제목 편집 (더블클릭/롱프레스)
 * - 스와이프(모바일) / 호버(PC) 빠른 액션
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { TaskItem, TaskStatus, ScheduleCategory } from '../../types';
import { getBadgeColors } from '../../utils/colorUtils';

/** 상태 SVG 아이콘 */
export function StatusIcon({ status, onClick }: { status: TaskStatus; onClick: () => void }) {
  const common = 'w-5 h-5 flex-shrink-0 cursor-pointer transition-transform hover:scale-110 flex items-center justify-center';

  if (status === 'completed') {
    return (
      <button onClick={onClick} className={common} title="완료됨 (클릭: 대기로)">
        <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
          <circle cx="10" cy="10" r="9" fill="#4ade80" stroke="#22c55e" strokeWidth="1" />
          <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }
  if (status === 'in_progress') {
    return (
      <button onClick={onClick} className={common} title="진행중 (클릭: 완료로)">
        <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
          <circle cx="10" cy="10" r="9" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
          <path d="M10 6.5v3.5l2 2" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }
  return (
    <button onClick={onClick} className={common} title="대기 (클릭: 진행중으로)">
      <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5">
        <circle cx="10" cy="10" r="9" fill="white" stroke="#d1d5db" strokeWidth="1.5" />
      </svg>
    </button>
  );
}

function getDDay(dateStr?: string): string {
  if (!dateStr) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'D-Day';
  if (diff > 0) return `D-${diff}`;
  return `D+${Math.abs(diff)}`;
}

function getDDayColor(dateStr?: string): string {
  if (!dateStr) return 'text-gray-400';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'text-red-500';
  if (diff === 0) return 'text-blue-500';
  if (diff <= 3) return 'text-amber-500';
  return 'text-gray-400';
}

interface TaskListItemProps {
  task: TaskItem;
  categories: ScheduleCategory[];
  projectColor?: string;
  onCycleStatus: (id: string) => void;
  onStartPomodoro?: (task: TaskItem) => void;
  onSelect: (task: TaskItem) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onUpdateTitle?: (id: string, title: string) => void;
  onPostpone?: (id: string) => void;
  onMoveToToday?: (id: string) => void;
  isOverdue?: boolean;
}

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function TaskListItem({
  task, categories, onCycleStatus, onSelect, selectMode, selected, onToggleSelect,
  onUpdateTitle, onPostpone, onMoveToToday, isOverdue,
}: TaskListItemProps) {
  const isCompleted = task.status === 'completed';
  const category = task.category ? categories.find((c) => c.id === task.category) : undefined;

  // ── 인라인 편집 ──
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = useCallback(() => {
    if (selectMode || isCompleted) return;
    setEditTitle(task.title);
    setEditing(true);
  }, [selectMode, isCompleted, task.title]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdateTitle?.(task.id, trimmed);
    }
  }, [editTitle, task.id, task.title, onUpdateTitle]);

  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditTitle(task.title);
  }, [task.title]);

  // 롱프레스 (모바일 인라인 편집)
  const handleTitleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      startEdit();
    }, 500);
  }, [startEdit]);

  const handleTitleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // ── 스와이프 (모바일) ──
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const swipingRef = useRef(false);
  const SWIPE_THRESHOLD = 60;

  const handleSwipeTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipingRef.current = false;
  }, []);

  const handleSwipeTouchMove = useCallback((e: React.TouchEvent) => {
    if (editing) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    if (!swipingRef.current && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
      swipingRef.current = true;
    }

    if (swipingRef.current) {
      // 왼쪽 스와이프만 허용 (최대 -100)
      const clamped = Math.max(-100, Math.min(0, deltaX));
      setSwipeX(clamped);
    }
  }, [editing]);

  const handleSwipeTouchEnd = useCallback(() => {
    if (swipingRef.current && swipeX < -SWIPE_THRESHOLD) {
      if (isOverdue && onMoveToToday) {
        onMoveToToday(task.id);
      } else if (onPostpone) {
        onPostpone(task.id);
      }
    }
    swipingRef.current = false;
    setSwipeX(0);
  }, [swipeX, isOverdue, onMoveToToday, onPostpone, task.id]);

  // 호버 상태 (PC)
  const [hovered, setHovered] = useState(false);

  const canSwipe = !isCompleted && !selectMode && !editing;

  return (
    <div
      className="relative rounded-2xl"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 스와이프 배경 — 왼쪽 스와이프 중일 때만 표시 */}
      {swipeX < 0 && (
        <div className="absolute inset-y-0 right-0 w-24 flex items-center justify-center bg-amber-400 rounded-r-2xl">
          <span className="text-white text-xs font-semibold">{isOverdue ? '오늘로' : '내일로'}</span>
        </div>
      )}

      {/* 메인 카드 */}
      <div
        onClick={() => {
          if (swipingRef.current) return;
          if (selectMode) { onToggleSelect?.(task.id); return; }
          if (!editing) onSelect(task);
        }}
        onTouchStart={canSwipe ? handleSwipeTouchStart : undefined}
        onTouchMove={canSwipe ? handleSwipeTouchMove : undefined}
        onTouchEnd={canSwipe ? handleSwipeTouchEnd : undefined}
        className={`relative flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${isCompleted ? 'opacity-50' : ''} ${selectMode && selected ? 'bg-green-50/50' : ''}`}
        style={{
          transform: swipeX !== 0 ? `translateX(${swipeX}px)` : undefined,
          transition: swipingRef.current ? 'none' : 'transform 0.2s ease',
        }}
      >
        {/* 선택 모드: 체크박스 / 일반 모드: 상태 아이콘 */}
        {selectMode ? (
          <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
            <button
              onClick={() => onToggleSelect?.(task.id)}
              className="w-5 h-5 flex items-center justify-center"
            >
              {selected ? (
                <svg viewBox="0 0 20 20" className="w-5 h-5">
                  <rect x="1" y="1" width="18" height="18" rx="4" fill="#22c55e" stroke="#16a34a" strokeWidth="1" />
                  <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" className="w-5 h-5">
                  <rect x="1" y="1" width="18" height="18" rx="4" fill="white" stroke="#d1d5db" strokeWidth="1.5" />
                </svg>
              )}
            </button>
          </div>
        ) : (
          <div onClick={(e) => e.stopPropagation()}>
            <StatusIcon status={task.status} onClick={() => onCycleStatus(task.id)} />
          </div>
        )}

        {/* 제목 (인라인 편집 가능) */}
        {editing ? (
          <input
            ref={inputRef}
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit();
              if (e.key === 'Escape') cancelEdit();
            }}
            onBlur={commitEdit}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-sm font-medium bg-transparent border-b-2 border-green-400 outline-none px-0 py-0 leading-5 min-w-0"
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); startEdit(); }}
            onTouchStart={handleTitleTouchStart}
            onTouchEnd={handleTitleTouchEnd}
            className={`flex-1 text-sm font-medium min-w-0 truncate leading-5 ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}
          >
            {task.title}
          </span>
        )}

        {/* 오른쪽 정보: 카테고리 / 날짜 / D-day */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* 카테고리 */}
          {category && (() => {
            const cc = getBadgeColors(category.color);
            return (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: cc.bg, color: cc.text }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cc.dot }} />
                {category.label}
              </span>
            );
          })()}

          {/* 날짜 (M/D) */}
          {task.date && (
            <span className="text-[11px] text-gray-400">
              {formatShortDate(task.date)}
            </span>
          )}

          {/* D-day */}
          {task.date && !isCompleted && (
            <span className={`text-[11px] font-semibold ${getDDayColor(task.date)}`}>
              {getDDay(task.date)}
            </span>
          )}

          {/* PC 호버 액션 버튼 */}
          {hovered && !selectMode && !editing && !isCompleted && (
            <div className="hidden sm:flex items-center gap-1 ml-1">
              {isOverdue && onMoveToToday && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveToToday(task.id); }}
                  className="px-2 py-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  title="오늘로"
                >
                  오늘로
                </button>
              )}
              {onPostpone && !isOverdue && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPostpone(task.id); }}
                  className="px-2 py-0.5 text-[10px] font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                  title="내일로"
                >
                  내일로
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
