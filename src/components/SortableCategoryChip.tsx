/**
 * @file src/components/SortableCategoryChip.tsx
 * @description 드래그로 순서 변경 가능한 카테고리 칩 + 컨테이너
 * - @dnd-kit 기반 수평 드래그 정렬
 * - 카테고리 관리 패널에서 사용
 */
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ScheduleCategory } from '../types';

interface SortableCategoryListProps {
  categories: ScheduleCategory[];
  onReorder: (cats: ScheduleCategory[]) => void;
  onRemove: (id: string) => void;
}

function SortableChip({ cat, onRemove }: { cat: ScheduleCategory; onRemove: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <span
      ref={setNodeRef}
      style={style}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-white rounded-full border select-none"
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 touch-none"
        title="드래그하여 순서 변경"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <circle cx="3" cy="2" r="1" /><circle cx="7" cy="2" r="1" />
          <circle cx="3" cy="5" r="1" /><circle cx="7" cy="5" r="1" />
          <circle cx="3" cy="8" r="1" /><circle cx="7" cy="8" r="1" />
        </svg>
      </span>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
      {cat.label}
      <button onClick={() => onRemove(cat.id)} className="text-gray-400 hover:text-red-500 ml-0.5">x</button>
    </span>
  );
}

export function SortableCategoryList({ categories, onReorder, onRemove }: SortableCategoryListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(arrayMove(categories, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={categories.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
        <div className="flex flex-wrap gap-1">
          {categories.map((cat) => (
            <SortableChip key={cat.id} cat={cat} onRemove={onRemove} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
