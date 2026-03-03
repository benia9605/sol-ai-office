/**
 * @file src/components/tasks/TaskListView.tsx
 * @description 리스트 뷰 - 날짜 기준 그룹핑 + 각 그룹 내 목표별 서브 그룹 (접기/펼치기)
 * - 날짜: 지연됨 / 오늘 / 내일 / 이번 주 / 다음 주 / 나중에 / 마감일 없음
 * - 완료된 할일은 '지연됨' 대신 별도 '완료' 그룹으로 분류
 * - 각 날짜 그룹 내에서 목표별로 서브 그룹핑 + 토글
 */
import { useState, useMemo } from 'react';
import { TaskItem, ScheduleCategory } from '../../types';
import { TaskListItem } from './TaskListItem';
import { useProjects } from '../../hooks/useProjects';
import { GoalRow } from '../../services/goals.service';

interface Project {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  image?: string;
}

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
  goals?: GoalRow[];
  projects?: Project[];
}

function getDateGroup(task: TaskItem): string {
  if (!task.date) return 'no_date';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(task.date);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // 완료된 할일은 지연됨에서 제외 → 원래 날짜 그룹 유지
  if (diff < 0 && task.status !== 'completed') return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= 7) return 'this_week';
  if (diff <= 14) return 'next_week';
  // 완료된 과거 날짜 할일 → 'past_completed'
  if (diff < 0 && task.status === 'completed') return 'past_completed';
  return 'later';
}

const dateGroups = [
  { key: 'overdue',        label: '🔴 지연됨',     color: 'text-red-600' },
  { key: 'today',          label: '오늘',           color: 'text-blue-600' },
  { key: 'tomorrow',       label: '내일',           color: 'text-green-600' },
  { key: 'this_week',      label: '이번 주',        color: 'text-emerald-600' },
  { key: 'next_week',      label: '다음 주',        color: 'text-gray-600' },
  { key: 'later',          label: '나중에',         color: 'text-gray-500' },
  { key: 'no_date',        label: '마감일 없음',    color: 'text-gray-400' },
  { key: 'past_completed', label: '✅ 지난 완료',   color: 'text-gray-400' },
];

export function TaskListView({
  tasks, categories, onCycleStatus, onToggleStar, onStartPomodoro, onSelect,
  selectMode, selectedIds, onToggleSelect,
  goals = [], projects: projectsProp,
}: TaskListViewProps) {
  const { projects: projectsFromHook } = useProjects();
  const projects = projectsProp ?? projectsFromHook;

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p) => { map[p.name] = p.color; });
    return map;
  }, [projects]);

  // goalId → GoalRow 매핑
  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  // 접기/펼치기 상태 (key: `${dateGroupKey}-${goalId}`)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 날짜별 그룹핑
  const dateGrouped = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    tasks.forEach((t) => {
      const key = getDateGroup(t);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  // 목표별 서브 그룹핑 (날짜 그룹 내 할일 배열 → 목표 그룹들)
  const groupByGoal = (items: TaskItem[]) => {
    const goalGroups = new Map<string, { goal: GoalRow | null; tasks: TaskItem[] }>();
    const noGoalTasks: TaskItem[] = [];

    items.forEach((t) => {
      if (t.goalId && goalMap.has(t.goalId)) {
        const existing = goalGroups.get(t.goalId);
        if (existing) {
          existing.tasks.push(t);
        } else {
          goalGroups.set(t.goalId, { goal: goalMap.get(t.goalId)!, tasks: [t] });
        }
      } else {
        noGoalTasks.push(t);
      }
    });

    // 각 그룹 내: 완료 아래로 → 이름순 자연수 정렬
    const sortTasks = (arr: TaskItem[]) => arr.sort((a, b) => {
      const aComp = a.status === 'completed' ? 1 : 0;
      const bComp = b.status === 'completed' ? 1 : 0;
      if (aComp !== bComp) return aComp - bComp;
      return a.title.localeCompare(b.title, 'ko', { numeric: true });
    });
    for (const group of goalGroups.values()) {
      sortTasks(group.tasks);
    }
    sortTasks(noGoalTasks);

    return { goalGroups: Array.from(goalGroups.values()), noGoalTasks };
  };

  const hasGoals = goals.length > 0;

  const renderTaskItem = (task: TaskItem) => (
    <TaskListItem
      key={task.id}
      task={task}
      categories={categories}
      projectColor={colorMap[task.project]}
      goalName={task.goalId ? goalMap.get(task.goalId)?.title : undefined}
      onCycleStatus={onCycleStatus}
      onToggleStar={onToggleStar}
      onStartPomodoro={onStartPomodoro}
      onSelect={onSelect}
      selectMode={selectMode}
      selected={selectedIds?.has(task.id)}
      onToggleSelect={onToggleSelect}
    />
  );

  return (
    <div className="space-y-5">
      {dateGroups.map((g) => {
        const items = dateGrouped[g.key];
        if (!items || items.length === 0) return null;

        // 목표가 있으면 서브 그룹핑
        const hasGoalTasks = hasGoals && items.some((t) => t.goalId && goalMap.has(t.goalId));

        return (
          <section key={g.key}>
            <h2 className={`text-sm font-semibold ${g.color} mb-2`}>
              {g.label} <span className="text-gray-400 font-normal">({items.length})</span>
            </h2>

            {hasGoalTasks ? (
              // ── 목표별 서브 그룹핑 ──
              <GoalSubGroups
                dateGroupKey={g.key}
                items={items}
                groupByGoal={groupByGoal}
                collapsed={collapsed}
                toggleCollapse={toggleCollapse}
                renderTaskItem={renderTaskItem}
              />
            ) : (
              // ── 플랫 리스트 ──
              <div className="space-y-1.5">
                {items.map(renderTaskItem)}
              </div>
            )}
          </section>
        );
      })}

      {tasks.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">할일이 없습니다</p>
      )}
    </div>
  );
}

// ── 목표별 서브 그룹 컴포넌트 ──
function GoalSubGroups({
  dateGroupKey,
  items,
  groupByGoal,
  collapsed,
  toggleCollapse,
  renderTaskItem,
}: {
  dateGroupKey: string;
  items: TaskItem[];
  groupByGoal: (items: TaskItem[]) => { goalGroups: { goal: GoalRow | null; tasks: TaskItem[] }[]; noGoalTasks: TaskItem[] };
  collapsed: Set<string>;
  toggleCollapse: (key: string) => void;
  renderTaskItem: (task: TaskItem) => JSX.Element;
}) {
  const { goalGroups, noGoalTasks } = useMemo(() => groupByGoal(items), [items, groupByGoal]);

  return (
    <div className="space-y-2">
      {goalGroups.map(({ goal, tasks: goalTasks }) => {
        const collapseKey = `${dateGroupKey}-${goal?.id || 'unknown'}`;
        const isCollapsed = collapsed.has(collapseKey);
        const completedCount = goalTasks.filter((t) => t.status === 'completed').length;

        return (
          <div key={goal?.id || 'unknown'} className="bg-white rounded-2xl shadow-soft overflow-hidden">
            <button
              onClick={() => toggleCollapse(collapseKey)}
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
            >
              <svg
                className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                viewBox="0 0 12 12" fill="currentColor"
              >
                <path d="M4.5 2l4 4-4 4V2z" />
              </svg>
              <span className="text-xs font-medium text-gray-600 flex-1 truncate">
                {goal?.title || '목표 없음'}
              </span>
              <span className="text-[11px] text-gray-400 flex-shrink-0">
                {completedCount}/{goalTasks.length}
              </span>
            </button>
            {!isCollapsed && (
              <div className="px-3 pb-2 space-y-1">
                {goalTasks.map(renderTaskItem)}
              </div>
            )}
          </div>
        );
      })}

      {/* 목표 없는 할일 */}
      {noGoalTasks.length > 0 && (
        goalGroups.length > 0 ? (
          // 목표가 있는 그룹도 있으면 "목표 없음" 서브 그룹으로
          <div className="bg-white rounded-2xl shadow-soft overflow-hidden">
            <button
              onClick={() => toggleCollapse(`${dateGroupKey}-no_goal`)}
              className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
            >
              <svg
                className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${collapsed.has(`${dateGroupKey}-no_goal`) ? '' : 'rotate-90'}`}
                viewBox="0 0 12 12" fill="currentColor"
              >
                <path d="M4.5 2l4 4-4 4V2z" />
              </svg>
              <span className="text-xs font-medium text-gray-400 flex-1">목표 없음</span>
              <span className="text-[11px] text-gray-400 flex-shrink-0">{noGoalTasks.length}</span>
            </button>
            {!collapsed.has(`${dateGroupKey}-no_goal`) && (
              <div className="px-3 pb-2 space-y-1">
                {noGoalTasks.map(renderTaskItem)}
              </div>
            )}
          </div>
        ) : (
          // 목표 그룹 없이 목표없는 할일만 있으면 플랫 렌더
          <div className="space-y-1.5">
            {noGoalTasks.map(renderTaskItem)}
          </div>
        )
      )}
    </div>
  );
}
