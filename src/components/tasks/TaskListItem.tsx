/**
 * @file src/components/tasks/TaskListItem.tsx
 * @description 할일 아이템 컴포넌트
 * - □ 제목  프로젝트태그  마감일(D-n)
 */
import { TaskItem, TaskStatus, ScheduleCategory } from '../../types';

/** 상태 SVG 아이콘 */
export function StatusIcon({ status, onClick }: { status: TaskStatus; onClick: () => void }) {
  const common = 'w-5 h-5 flex-shrink-0 cursor-pointer transition-transform hover:scale-110';

  if (status === 'completed') {
    return (
      <button onClick={onClick} className={common} title="완료됨 (클릭: 대기로)">
        <svg viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" fill="#4ade80" stroke="#22c55e" strokeWidth="1" />
          <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }
  if (status === 'in_progress') {
    return (
      <button onClick={onClick} className={common} title="진행중 (클릭: 완료로)">
        <svg viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
          <path d="M10 5v5l3 3" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }
  return (
    <button onClick={onClick} className={common} title="대기 (클릭: 진행중으로)">
      <svg viewBox="0 0 20 20" fill="none">
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
  goalName?: string;
  onCycleStatus: (id: string) => void;
  onToggleStar: (id: string) => void;
  onStartPomodoro?: (task: TaskItem) => void;
  onSelect: (task: TaskItem) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function TaskListItem({ task, projectColor, goalName, onCycleStatus, onToggleStar, onSelect, selectMode, selected, onToggleSelect }: TaskListItemProps) {
  const isCompleted = task.status === 'completed';

  return (
    <div
      onClick={() => selectMode ? onToggleSelect?.(task.id) : onSelect(task)}
      className={`flex items-center gap-3 bg-white rounded-2xl shadow-soft px-4 py-3 cursor-pointer hover:shadow-hover transition-all ${isCompleted ? 'opacity-50' : ''} ${selectMode && selected ? 'ring-2 ring-green-400 bg-green-50/30' : ''}`}
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

      {/* 제목 */}
      <span className={`flex-1 text-sm font-medium min-w-0 truncate ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
        {task.title}
      </span>

      {/* 오른쪽 정보: 별표 / 날짜 / D-day / 목표 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* 즐겨찾기 별표 */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStar(task.id); }}
          className={`text-sm transition-all ${task.starred ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'}`}
          title={task.starred ? '즐겨찾기 해제' : '즐겨찾기'}
        >
          {task.starred ? '★' : '☆'}
        </button>

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

        {/* 목표명 (프로젝트 색상 점 포함) */}
        {goalName && (
          <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-500 max-w-[100px]">
            {projectColor && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: projectColor }} />}
            <span className="truncate">{goalName}</span>
          </span>
        )}
      </div>
    </div>
  );
}
