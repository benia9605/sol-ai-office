/**
 * @file src/components/tasks/TaskListView.tsx
 * @description 리스트 뷰 - 날짜 기준 그룹핑
 * - 지연됨 / 오늘 / 내일 / 이번 주 / 다음 주 / 나중에 / 마감일 없음
 */
import { useMemo } from 'react';
import { TaskItem, ScheduleCategory } from '../../types';
import { TaskListItem } from './TaskListItem';
import { useProjects } from '../../hooks/useProjects';

interface TaskListViewProps {
  tasks: TaskItem[];
  categories: ScheduleCategory[];
  onCycleStatus: (id: string) => void;
  onToggleStar: (id: string) => void;
  onStartPomodoro?: (task: TaskItem) => void;
  onSelect: (task: TaskItem) => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

function getDateGroup(task: TaskItem): string {
  if (!task.date) return 'no_date';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.date);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= 7) return 'this_week';
  if (diff <= 14) return 'next_week';
  return 'later';
}

const dateGroups = [
  { key: 'overdue',   label: '🔴 지연됨',   color: 'text-red-600' },
  { key: 'today',     label: '오늘',         color: 'text-blue-600' },
  { key: 'tomorrow',  label: '내일',         color: 'text-green-600' },
  { key: 'this_week', label: '이번 주',      color: 'text-emerald-600' },
  { key: 'next_week', label: '다음 주',      color: 'text-gray-600' },
  { key: 'later',     label: '나중에',       color: 'text-gray-500' },
  { key: 'no_date',   label: '마감일 없음',  color: 'text-gray-400' },
];

export function TaskListView({ tasks, categories, onCycleStatus, onToggleStar, onStartPomodoro, onSelect, selectMode, selectedIds, onToggleSelect }: TaskListViewProps) {
  const { projects } = useProjects();
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p) => { map[p.name] = p.color; });
    return map;
  }, [projects]);

  const grouped = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    tasks.forEach((t) => {
      const key = getDateGroup(t);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  return (
    <div className="space-y-5">
      {dateGroups.map((g) => {
        const items = grouped[g.key];
        if (!items || items.length === 0) return null;
        return (
          <section key={g.key}>
            <h2 className={`text-sm font-semibold ${g.color} mb-2`}>
              {g.label} <span className="text-gray-400 font-normal">({items.length})</span>
            </h2>
            <div className="space-y-1.5">
              {items.map((task) => (
                <TaskListItem
                  key={task.id}
                  task={task}
                  categories={categories}
                  projectColor={colorMap[task.project]}
                  onCycleStatus={onCycleStatus}
                  onToggleStar={onToggleStar}
                  onStartPomodoro={onStartPomodoro}
                  onSelect={onSelect}
                  selectMode={selectMode}
                  selected={selectedIds?.has(task.id)}
                  onToggleSelect={onToggleSelect}
                />
              ))}
            </div>
          </section>
        );
      })}

      {tasks.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">할일이 없습니다</p>
      )}
    </div>
  );
}
