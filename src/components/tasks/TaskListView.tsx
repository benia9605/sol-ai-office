/**
 * @file src/components/tasks/TaskListView.tsx
 * @description 리스트 뷰 - 날짜 기준 or 목표별 그룹핑
 * - 날짜: 지연됨 / 오늘 / 내일 / 이번 주 / 다음 주 / 나중에 / 마감일 없음
 * - 목표별: 프로젝트 > 목표 계층 구조, 접기/펼치기 토글
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
  groupBy?: 'date' | 'goal';
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

export function TaskListView({
  tasks, categories, onCycleStatus, onToggleStar, onStartPomodoro, onSelect,
  selectMode, selectedIds, onToggleSelect,
  groupBy = 'date', goals = [], projects: projectsProp,
}: TaskListViewProps) {
  const { projects: projectsFromHook } = useProjects();
  const projects = projectsProp ?? projectsFromHook;

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p) => { map[p.name] = p.color; });
    return map;
  }, [projects]);

  // 접기/펼치기 상태 (key: goalId or 'no_goal')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── 날짜별 그룹핑 ──
  const dateGrouped = useMemo(() => {
    const map: Record<string, TaskItem[]> = {};
    tasks.forEach((t) => {
      const key = getDateGroup(t);
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return map;
  }, [tasks]);

  // ── 목표별 그룹핑 ──
  const goalGrouped = useMemo(() => {
    if (groupBy !== 'goal') return [];

    // goalId → GoalRow 매핑
    const goalMap = new Map(goals.map((g) => [g.id, g]));
    // projectId → Project 매핑
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    // goalId별 태스크 그룹핑
    const tasksByGoal = new Map<string, TaskItem[]>();
    const noGoalTasks: TaskItem[] = [];

    tasks.forEach((t) => {
      if (t.goalId && goalMap.has(t.goalId)) {
        const existing = tasksByGoal.get(t.goalId) || [];
        existing.push(t);
        tasksByGoal.set(t.goalId, existing);
      } else {
        noGoalTasks.push(t);
      }
    });

    // 프로젝트별로 묶기
    const projectGroups: {
      project: Project | null;
      goals: { goal: GoalRow; tasks: TaskItem[] }[];
    }[] = [];

    // projectId별로 goals를 분류
    const goalsByProject = new Map<string, GoalRow[]>();
    goals.forEach((g) => {
      if (tasksByGoal.has(g.id)) {
        const existing = goalsByProject.get(g.project_id) || [];
        existing.push(g);
        goalsByProject.set(g.project_id, existing);
      }
    });

    // 프로젝트 순서대로 렌더
    for (const [projectId, projectGoals] of goalsByProject) {
      const project = projectMap.get(projectId) || null;
      const goalItems = projectGoals.map((g) => ({
        goal: g,
        tasks: (tasksByGoal.get(g.id) || []).sort((a, b) =>
          a.title.localeCompare(b.title, 'ko', { numeric: true })
        ),
      }));
      projectGroups.push({ project, goals: goalItems });
    }

    return { projectGroups, noGoalTasks };
  }, [groupBy, tasks, goals, projects]);

  const renderTaskItem = (task: TaskItem) => (
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
  );

  // ── 목표별 뷰 ──
  if (groupBy === 'goal' && goalGrouped && typeof goalGrouped === 'object' && 'projectGroups' in goalGrouped) {
    const { projectGroups, noGoalTasks } = goalGrouped;

    return (
      <div className="space-y-4">
        {projectGroups.map(({ project, goals: goalItems }) => (
          <div key={project?.id || 'unknown'} className="space-y-2">
            {/* 프로젝트 헤더 */}
            <div className="flex items-center gap-2 px-1">
              {project?.image
                ? <img src={project.image} alt={project.name} className="w-4 h-4 object-contain" />
                : project?.emoji
                  ? <span className="text-sm">{project.emoji}</span>
                  : null
              }
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {project?.name || '프로젝트 없음'}
              </span>
            </div>

            {/* 목표별 그룹 */}
            {goalItems.map(({ goal, tasks: goalTasks }) => {
              const isCollapsed = collapsed.has(goal.id);
              const completedCount = goalTasks.filter((t) => t.status === 'completed').length;

              return (
                <section key={goal.id} className="bg-white rounded-2xl shadow-soft overflow-hidden">
                  {/* 목표 헤더 (토글) */}
                  <button
                    onClick={() => toggleCollapse(goal.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <svg
                      className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                      viewBox="0 0 12 12" fill="currentColor"
                    >
                      <path d="M4.5 2l4 4-4 4V2z" />
                    </svg>
                    <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                      {goal.title}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {completedCount}/{goalTasks.length}
                    </span>
                  </button>

                  {/* 할일 리스트 */}
                  {!isCollapsed && (
                    <div className="px-3 pb-2 space-y-1">
                      {goalTasks.map(renderTaskItem)}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ))}

        {/* 목표 없는 할일 */}
        {noGoalTasks.length > 0 && (
          <section className="bg-white rounded-2xl shadow-soft overflow-hidden">
            <button
              onClick={() => toggleCollapse('no_goal')}
              className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <svg
                className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${collapsed.has('no_goal') ? '' : 'rotate-90'}`}
                viewBox="0 0 12 12" fill="currentColor"
              >
                <path d="M4.5 2l4 4-4 4V2z" />
              </svg>
              <span className="text-sm font-medium text-gray-400 flex-1">목표 없음</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{noGoalTasks.length}</span>
            </button>
            {!collapsed.has('no_goal') && (
              <div className="px-3 pb-2 space-y-1">
                {noGoalTasks.sort((a, b) => a.title.localeCompare(b.title, 'ko', { numeric: true })).map(renderTaskItem)}
              </div>
            )}
          </section>
        )}

        {tasks.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">할일이 없습니다</p>
        )}
      </div>
    );
  }

  // ── 날짜별 뷰 (기본) ──
  return (
    <div className="space-y-5">
      {dateGroups.map((g) => {
        const items = dateGrouped[g.key];
        if (!items || items.length === 0) return null;
        return (
          <section key={g.key}>
            <h2 className={`text-sm font-semibold ${g.color} mb-2`}>
              {g.label} <span className="text-gray-400 font-normal">({items.length})</span>
            </h2>
            <div className="space-y-1.5">
              {items.map(renderTaskItem)}
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
