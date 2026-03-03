/**
 * @file src/components/tasks/TaskKanbanView.tsx
 * @description 칸반 뷰 - @dnd-kit 드래그앤드롭
 * - 3열: 대기 / 진행중 / 완료
 * - 드롭 시 상태 변경
 * - 모바일: 수평 스크롤, 각 열 min-w-[260px]
 * - PC: grid grid-cols-3
 */
import { useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { TaskItem, TaskStatus, ScheduleCategory } from '../../types';
import { useProjects } from '../../hooks/useProjects';
import { GoalRow } from '../../services/goals.service';
import { GoalBadge } from '../GoalBadge';

interface TaskKanbanViewProps {
  tasks: TaskItem[];
  categories: ScheduleCategory[];
  goals?: GoalRow[];
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onCycleStatus: (id: string) => void;
  onToggleStar: (id: string) => void;
  onStartPomodoro?: (task: TaskItem) => void;
  onSelect: (task: TaskItem) => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

const columns: { id: TaskStatus; label: string; color: string; bg: string }[] = [
  { id: 'pending',     label: '대기',   color: 'text-gray-600',  bg: 'bg-gray-50' },
  { id: 'in_progress', label: '진행중', color: 'text-blue-600',  bg: 'bg-blue-50' },
  { id: 'completed',   label: '완료',   color: 'text-green-600', bg: 'bg-green-50' },
];

const priorityDot: Record<TaskItem['priority'], string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-400',
  low: 'bg-gray-300',
};

function getDday(dateStr?: string): string | null {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `D+${Math.abs(diff)}`;
  if (diff === 0) return 'D-Day';
  return `D-${diff}`;
}

/** 드래그 가능한 칸반 카드 */
function KanbanCard({ task, categories, projectColor, goalName, goalColor, onSelect, onToggleStar, selectMode, selected, onToggleSelect }: {
  task: TaskItem;
  categories: ScheduleCategory[];
  projectColor?: string;
  goalName?: string;
  goalColor?: string;
  onSelect: (task: TaskItem) => void;
  onToggleStar: (id: string) => void;
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const cat = categories.find((c) => c.id === task.category);
  const dday = getDday(task.date);
  const isOverdue = dday?.startsWith('D+');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => selectMode ? onToggleSelect?.(task.id) : onSelect(task)}
      className={`bg-white rounded-xl shadow-soft hover:shadow-hover transition-all overflow-hidden ${selectMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} ${selectMode && selected ? 'ring-2 ring-green-400 bg-green-50/30' : ''}`}
    >
      {/* 카테고리 상단바 */}
      <div className="h-1 w-full" style={{ backgroundColor: cat?.color ?? '#e5e7eb' }} />

      <div className="p-3 space-y-2">
        {/* 제목 + 우선순위 점 + 즐겨찾기/체크박스 */}
        <div className="flex items-start gap-2">
          {selectMode ? (
            <div className="mt-1 flex-shrink-0">
              {selected ? (
                <svg viewBox="0 0 20 20" className="w-4 h-4">
                  <rect x="1" y="1" width="18" height="18" rx="4" fill="#22c55e" stroke="#16a34a" strokeWidth="1" />
                  <path d="M6 10l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20" className="w-4 h-4">
                  <rect x="1" y="1" width="18" height="18" rx="4" fill="white" stroke="#d1d5db" strokeWidth="1.5" />
                </svg>
              )}
            </div>
          ) : (
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${priorityDot[task.priority]}`} />
          )}
          <p className={`text-sm font-medium flex-1 ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
            {task.title}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleStar(task.id); }}
            className={`flex-shrink-0 text-xs transition-all ${task.starred ? 'text-amber-400' : 'text-gray-300 hover:text-amber-300'}`}
          >
            {task.starred ? '★' : '☆'}
          </button>
        </div>

        {/* 프로젝트 + D-day */}
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            {projectColor && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: projectColor }} />}
            {task.project}
          </span>
          {dday && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              isOverdue ? 'bg-red-100 text-red-600' : dday === 'D-Day' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
            }`}>
              {dday}
            </span>
          )}
        </div>

        {/* 목표 배지 + 카테고리 배지 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {goalName && (
            <GoalBadge title={goalName} projectColor={goalColor} size="sm" />
          )}
          {cat && (
            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
              style={{ backgroundColor: cat.color }}>
              {cat.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** 드래그 오버레이용 카드 (드래그 중 미리보기) */
function KanbanCardOverlay({ task, categories, projectColor }: { task: TaskItem; categories: ScheduleCategory[]; projectColor?: string }) {
  const cat = categories.find((c) => c.id === task.category);
  const dday = getDday(task.date);

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden w-[240px] opacity-90">
      <div className="h-1 w-full" style={{ backgroundColor: cat?.color ?? '#e5e7eb' }} />
      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${priorityDot[task.priority]}`} />
          <p className="text-sm font-medium flex-1 text-gray-800">{task.title}</p>
        </div>
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            {projectColor && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: projectColor }} />}
            {task.project}
          </span>
          {dday && <span className="text-xs text-gray-500">{dday}</span>}
        </div>
      </div>
    </div>
  );
}

/** 드롭 가능한 열 (목표별 그룹핑 + 토글) */
function KanbanColumn({ column, tasks, categories, colorMap, goalMap, projectColorById, collapsed, toggleCollapse, onSelect, onToggleStar, selectMode, selectedIds, onToggleSelect }: {
  column: typeof columns[number];
  tasks: TaskItem[];
  categories: ScheduleCategory[];
  colorMap: Record<string, string>;
  goalMap: Map<string, GoalRow>;
  projectColorById: Record<string, string>;
  collapsed: Set<string>;
  toggleCollapse: (key: string) => void;
  onSelect: (task: TaskItem) => void;
  onToggleStar: (id: string) => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  // 목표별 그룹핑
  const { goalGroups, noGoalTasks } = useMemo(() => {
    const groups = new Map<string, { goal: GoalRow; tasks: TaskItem[] }>();
    const noGoal: TaskItem[] = [];

    tasks.forEach((t) => {
      if (t.goalId && goalMap.has(t.goalId)) {
        const existing = groups.get(t.goalId);
        if (existing) existing.tasks.push(t);
        else groups.set(t.goalId, { goal: goalMap.get(t.goalId)!, tasks: [t] });
      } else {
        noGoal.push(t);
      }
    });

    return { goalGroups: Array.from(groups.values()), noGoalTasks: noGoal };
  }, [tasks, goalMap]);

  const hasGoals = goalGroups.length > 0;

  // 접힌 그룹의 task ID를 제외한 visible task IDs (SortableContext용)
  const visibleTaskIds = useMemo(() => {
    const ids: string[] = [];
    goalGroups.forEach(({ goal, tasks: gTasks }) => {
      const key = `${column.id}-${goal.id}`;
      if (!collapsed.has(key)) gTasks.forEach((t) => ids.push(t.id));
    });
    const noGoalKey = `${column.id}-no_goal`;
    if (!collapsed.has(noGoalKey) || !hasGoals) noGoalTasks.forEach((t) => ids.push(t.id));
    return ids;
  }, [goalGroups, noGoalTasks, collapsed, column.id, hasGoals]);

  const renderCard = (task: TaskItem) => {
    const goal = task.goalId ? goalMap.get(task.goalId) : undefined;
    return (
      <KanbanCard key={task.id} task={task} categories={categories} projectColor={colorMap[task.project]} goalName={undefined} goalColor={goal ? projectColorById[goal.project_id] : undefined} onSelect={onSelect} onToggleStar={onToggleStar} selectMode={selectMode} selected={selectedIds?.has(task.id)} onToggleSelect={onToggleSelect} />
    );
  };

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[260px] flex-1 rounded-2xl p-3 transition-colors ${column.bg} ${isOver ? 'ring-2 ring-blue-300' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${column.color}`}>{column.label}</h3>
        <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <SortableContext items={visibleTaskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[60px]">
          {hasGoals ? (
            <>
              {goalGroups.map(({ goal, tasks: gTasks }) => {
                const collapseKey = `${column.id}-${goal.id}`;
                const isCollapsed = collapsed.has(collapseKey);
                const goalColor = projectColorById[goal.project_id];

                return (
                  <div key={goal.id}>
                    {/* ▼ GoalBadge 토글 */}
                    <button
                      onClick={() => toggleCollapse(collapseKey)}
                      className="flex items-center gap-1.5 py-1 px-0.5 mb-1"
                    >
                      <svg
                        className={`w-2.5 h-2.5 text-gray-400 flex-shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                        viewBox="0 0 10 10" fill="currentColor"
                      >
                        <path d="M2 3l3 4 3-4H2z" />
                      </svg>
                      <GoalBadge title={goal.title} projectColor={goalColor} size="sm" />
                      <span className="text-[11px] text-gray-400">{gTasks.length}</span>
                    </button>
                    {!isCollapsed && (
                      <div className="space-y-2">
                        {gTasks.map(renderCard)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 목표 없는 할일 */}
              {noGoalTasks.length > 0 && (
                <div>
                  <button
                    onClick={() => toggleCollapse(`${column.id}-no_goal`)}
                    className="flex items-center gap-1.5 py-1 px-0.5 mb-1"
                  >
                    <svg
                      className={`w-2.5 h-2.5 text-gray-400 flex-shrink-0 transition-transform ${collapsed.has(`${column.id}-no_goal`) ? '-rotate-90' : ''}`}
                      viewBox="0 0 10 10" fill="currentColor"
                    >
                      <path d="M2 3l3 4 3-4H2z" />
                    </svg>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">목표 없음</span>
                    <span className="text-[11px] text-gray-400">{noGoalTasks.length}</span>
                  </button>
                  {!collapsed.has(`${column.id}-no_goal`) && (
                    <div className="space-y-2">
                      {noGoalTasks.map(renderCard)}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            // 목표 없으면 플랫 렌더
            tasks.map(renderCard)
          )}

          {tasks.length === 0 && (
            <div className="text-xs text-gray-300 text-center py-6 border-2 border-dashed border-gray-200 rounded-xl">
              여기에 끌어놓기
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function TaskKanbanView({ tasks, categories, goals = [], onUpdateStatus, onToggleStar, onSelect, selectMode, selectedIds, onToggleSelect }: TaskKanbanViewProps) {
  const { projects } = useProjects();
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p) => { map[p.name] = p.color; });
    return map;
  }, [projects]);
  const projectColorById = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p) => { map[p.id] = p.color; });
    return map;
  }, [projects]);
  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, TaskItem[]> = { pending: [], in_progress: [], completed: [] };
    tasks.forEach((t) => { map[t.status].push(t); });
    return map;
  }, [tasks]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    // over.id can be a column id (TaskStatus) or another task id
    let targetStatus: TaskStatus | undefined;

    if (['pending', 'in_progress', 'completed'].includes(over.id as string)) {
      targetStatus = over.id as TaskStatus;
    } else {
      // Dropped on a task → find which column that task is in
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) targetStatus = overTask.status;
    }

    if (targetStatus) {
      const task = tasks.find((t) => t.id === taskId);
      if (task && task.status !== targetStatus) {
        onUpdateStatus(taskId, targetStatus);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2 lg:grid lg:grid-cols-3 lg:overflow-x-visible">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasksByStatus[col.id]}
            categories={categories}
            colorMap={colorMap}
            goalMap={goalMap}
            projectColorById={projectColorById}
            collapsed={collapsed}
            toggleCollapse={toggleCollapse}
            onSelect={onSelect}
            onToggleStar={onToggleStar}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <KanbanCardOverlay task={activeTask} categories={categories} projectColor={colorMap[activeTask.project]} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
