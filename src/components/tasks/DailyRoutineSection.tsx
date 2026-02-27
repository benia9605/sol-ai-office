/**
 * @file src/components/tasks/DailyRoutineSection.tsx
 * @description 매일 루틴 섹션 (TasksPage 상단)
 * - repeat='daily'인 태스크를 체크박스 리스트로 표시
 * - 진행률 바 + 완료 카운트
 * - 체크박스는 daily_completions 기반 (매일 리셋)
 */
import { TaskItem } from '../../types';

interface DailyRoutineSectionProps {
  dailyTasks: TaskItem[];
  isCompletedToday: (taskId: string) => boolean;
  toggleCompletion: (taskId: string) => void;
  completedCount: number;
  totalCount: number;
  onSelect: (task: TaskItem) => void;
}

function DailyCheckIcon({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  const common = 'w-5 h-5 flex-shrink-0 cursor-pointer transition-transform hover:scale-110';

  if (checked) {
    return (
      <button onClick={onClick} className={common}>
        <svg viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="9" fill="#4ade80" stroke="#22c55e" strokeWidth="1" />
          <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }
  return (
    <button onClick={onClick} className={common}>
      <svg viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="9" fill="white" stroke="#d1d5db" strokeWidth="1.5" />
      </svg>
    </button>
  );
}

export function DailyRoutineSection({
  dailyTasks,
  isCompletedToday,
  toggleCompletion,
  completedCount,
  totalCount,
  onSelect,
}: DailyRoutineSectionProps) {
  if (dailyTasks.length === 0) return null;

  const rate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl shadow-soft p-4 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-green-500">
            <circle cx="8" cy="8" r="6" />
            <path d="M8 4v4l2.5 1.5" />
          </svg>
          매일 루틴
        </h2>
        <span className="text-xs text-green-600 font-medium">
          {completedCount}/{totalCount} 완료
        </span>
      </div>

      {/* 진행률 바 */}
      <div className="h-1.5 bg-green-200/50 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-400 rounded-full transition-all duration-300"
          style={{ width: `${rate}%` }}
        />
      </div>

      {/* 체크리스트 */}
      <div className="space-y-1">
        {dailyTasks.map((task) => {
          const checked = isCompletedToday(task.id);
          return (
            <div
              key={task.id}
              className="flex items-center gap-3 py-1.5 px-1 rounded-xl hover:bg-white/50 transition-colors cursor-pointer"
            >
              <DailyCheckIcon checked={checked} onClick={() => toggleCompletion(task.id)} />
              <span
                onClick={() => onSelect(task)}
                className={`flex-1 text-sm transition-all ${
                  checked ? 'text-gray-400 line-through' : 'text-gray-700'
                }`}
              >
                {task.title}
              </span>
              {task.project && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/70 text-gray-500 flex-shrink-0">
                  {task.project}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
