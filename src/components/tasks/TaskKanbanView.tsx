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

interface TaskKanbanViewProps {
  tasks: TaskItem[];
  categories: ScheduleCategory[];
  onUpdateStatus: (id: string, status: TaskStatus) => void;
  onCycleStatus: (id: string) => void;
  onToggleStar: (id: string) => void;
  onStartPomodoro?: (task: TaskItem) => void;
  onSelect: (task: TaskItem) => void;
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
function KanbanCard({ task, categories, projectColor, onSelect, onToggleStar }: {
  task: TaskItem;
  categories: ScheduleCategory[];
  projectColor?: string;
  onSelect: (task: TaskItem) => void;
  onToggleStar: (id: string) => void;
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
      onClick={() => onSelect(task)}
      className="bg-white rounded-xl shadow-soft hover:shadow-hover transition-all cursor-grab active:cursor-grabbing overflow-hidden"
    >
      {/* 카테고리 상단바 */}
      <div className="h-1 w-full" style={{ backgroundColor: cat?.color ?? '#e5e7eb' }} />

      <div className="p-3 space-y-2">
        {/* 제목 + 우선순위 점 + 즐겨찾기 */}
        <div className="flex items-start gap-2">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${priorityDot[task.priority]}`} />
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

        {/* 카테고리 배지 */}
        {cat && (
          <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
            style={{ backgroundColor: cat.color }}>
            {cat.label}
          </span>
        )}
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

/** 드롭 가능한 열 */
function KanbanColumn({ column, tasks, categories, colorMap, onSelect, onToggleStar }: {
  column: typeof columns[number];
  tasks: TaskItem[];
  categories: ScheduleCategory[];
  colorMap: Record<string, string>;
  onSelect: (task: TaskItem) => void;
  onToggleStar: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={`min-w-[260px] flex-1 rounded-2xl p-3 transition-colors ${column.bg} ${isOver ? 'ring-2 ring-blue-300' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${column.color}`}>{column.label}</h3>
        <span className="text-xs text-gray-400 bg-white px-2 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[60px]">
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} categories={categories} projectColor={colorMap[task.project]} onSelect={onSelect} onToggleStar={onToggleStar} />
          ))}
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

export function TaskKanbanView({ tasks, categories, onUpdateStatus, onToggleStar, onSelect }: TaskKanbanViewProps) {
  const { projects } = useProjects();
  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p) => { map[p.name] = p.color; });
    return map;
  }, [projects]);
  const [activeId, setActiveId] = useState<string | null>(null);

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
            onSelect={onSelect}
            onToggleStar={onToggleStar}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <KanbanCardOverlay task={activeTask} categories={categories} projectColor={colorMap[activeTask.project]} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
