import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { habitColor } from "@/features/habits/habit-colors";
import type { Habit } from "@/features/habits/habit-types";

export function SortableHabit({ habit, wheel = false, children }: {
  habit: Habit;
  wheel?: boolean;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition,
    isDragging, isOver, active } = useSortable({ id: habit.id });
  const handle = (
    <button ref={setActivatorNodeRef} type="button" className="habit-drag-handle"
      {...attributes} {...listeners} aria-label={`Reorder ${habit.name}`} data-ui-sound="custom">
      <GripVertical />
    </button>
  );
  return (
    <div ref={setNodeRef} className={wheel ? "habit-wheel-label" : "habit-row"}
      role={wheel ? undefined : "row"} data-dragging={isDragging || undefined}
      data-drop-target={isOver && active?.id !== habit.id || undefined}
      style={{ "--habit-color": habitColor(habit),
        transform: wheel ? undefined : CSS.Transform.toString(transform),
        transition: wheel ? undefined : transition } as CSSProperties}>
      {children(handle)}
    </div>
  );
}
