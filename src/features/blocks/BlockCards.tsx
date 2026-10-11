import { useDraggable } from "@dnd-kit/core";
import {
  CalendarDays,
  Check,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleX,
  Clock3,
  Flag,
  GripVertical,
  Pause,
  Plus,
  Repeat2,
  RotateCcw,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useTaskStore } from "@/features/todo/todo-store";
import { STATUS_LABELS, daysUntil, formatEstimate, keyToDate } from "@/features/todo/todo-utils";
import type { Task, TaskStatus } from "@/features/todo/todo-types";
import { useHabitStore } from "@/features/habits/habit-store";
import { habitColor } from "@/features/habits/habit-colors";
import { HabitIcon } from "@/features/habits/habit-icons";
import { HabitLogControl } from "../habits/HabitLogControl";
import { HABIT_TRACKING_START, localDateKey } from "@/features/habits/habit-utils";
import type { Habit } from "@/features/habits/habit-types";
import { cn } from "@/shared/ui/utils";
import type { BlockDragItem, TimeBlock } from "./block-types";
import {
  SLOT_HEIGHT,
  DEFAULT_BLOCK_COLOR,
  blockColor,
  formatDuration,
  formatTime,
  habitDuration,
  isInstantBlock,
  taskDuration,
  type TimelineSegment,
  type BlockLane,
} from "./block-utils";

export const PRIORITY_COLORS = ["#e98d91", "#e6c575", "#a5b3c7"];
const STATUS_ICONS = {
  "not-started": CircleDashed,
  "in-progress": CircleDot,
  "on-hold": Pause,
  done: CircleCheck,
  kill: CircleX,
};

function taskStyle(task: Task): CSSProperties {
  return {
    "--block-color": DEFAULT_BLOCK_COLOR,
    "--priority-color": PRIORITY_COLORS[task.priority],
  } as CSSProperties;
}

export function TodoDetails({ task, timeRange }: { task: Task; timeRange?: string }) {
  const StatusIcon = STATUS_ICONS[task.status];
  const unit = { minutes: "m", hours: "h", days: "d", weeks: "w", months: "mo" };
  const estimate = task.estimate ? `${task.estimate.amount}${unit[task.estimate.unit]}` : "30m";
  const dueLabel = task.dueOn
    ? daysUntil(task.dueOn) === 0
      ? "Today"
      : keyToDate(task.dueOn).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "—";
  return (
    <span className="blocks-todo-details">
      {timeRange && <span className="blocks-time-range">{timeRange}</span>}
      <span
        className="blocks-priority"
        aria-label={`Priority ${task.priority}: ${["High", "Medium", "Low"][task.priority]}`}
        title={`Priority ${task.priority}: ${["High", "Medium", "Low"][task.priority]}`}
      >
        <Flag />
        <b>{task.priority}</b>
      </span>
      <span
        className={`blocks-task-status blocks-status-${task.status}`}
        aria-label={STATUS_LABELS[task.status]}
        title={STATUS_LABELS[task.status]}
      >
        <StatusIcon />
      </span>
      <span
        aria-label={`Estimate: ${task.estimate ? formatEstimate(task.estimate) : "30 minutes"}`}
        title={`Estimate: ${task.estimate ? formatEstimate(task.estimate) : "30 minutes (default)"}`}
      >
        <Clock3 />
        {estimate}
      </span>
      <span
        className={task.dueOn && daysUntil(task.dueOn) < 0 ? "blocks-overdue" : ""}
        aria-label={task.dueOn ? `Due ${task.dueOn}` : "No due date"}
        title={task.dueOn ? `Due ${task.dueOn}` : "No due date"}
      >
        <CalendarDays />
        {dueLabel}
      </span>
    </span>
  );
}

export function TodoCard({
  task,
  scheduled,
  onEdit,
  onSchedule,
}: {
  task: Task;
  scheduled: boolean;
  onEdit: () => void;
  onSchedule: () => void;
}) {
  const item: BlockDragItem = {
    category: "todo",
    sourceId: task.id,
    title: task.title,
    duration: taskDuration(task),
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `todo-${task.id}`,
    data: item,
  });
  return (
    <article
      ref={setNodeRef}
      className={cn("blocks-source-card blocks-todo-card", {
        "is-scheduled": scheduled,
        "is-dragging": isDragging,
      })}
      style={taskStyle(task)}
      title={scheduled ? "On the timeline" : undefined}
      onPointerDown={(event) => listeners?.onPointerDown?.(event)}
    >
      <button
        type="button"
        className="blocks-drag-handle"
        aria-label={`Drag ${task.title}`}
        {...attributes}
        onKeyDown={(event) => listeners?.onKeyDown?.(event)}
      >
        <GripVertical />
      </button>
      <button
        className="blocks-source-details"
        type="button"
        aria-label={`Edit ${task.title}`}
        onClick={onEdit}
      >
        <strong>{task.title}</strong>
        <TodoDetails task={task} />
      </button>
      <button
        className="blocks-schedule-button"
        type="button"
        aria-label={`Schedule ${task.title}`}
        title={scheduled ? "Already planned · schedule another session" : "Choose a time"}
        onClick={onSchedule}
      >
        <Plus />
      </button>
    </article>
  );
}

export function HabitCard({
  habit,
  scheduled,
  onEdit,
}: {
  habit: Habit;
  scheduled: boolean;
  onEdit: () => void;
}) {
  const item: BlockDragItem = {
    category: "habit",
    sourceId: habit.id,
    title: habit.name,
    duration: habitDuration(habit),
  };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `habit-${habit.id}`,
    data: item,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn("blocks-source-card blocks-habit-card", {
        "is-scheduled": scheduled,
        "is-dragging": isDragging,
      })}
      style={{ "--block-color": habitColor(habit) } as CSSProperties}
      {...attributes}
      {...listeners}
      aria-label={`Edit ${habit.name}`}
      onClick={onEdit}
      title={
        scheduled
          ? "On the timeline · drag to schedule again · click to edit"
          : "Drag anywhere to schedule · click to edit"
      }
    >
      <span className="blocks-habit-card-icon">
        <HabitIcon name={habit.icon ?? "circle"} />
      </span>
      <span className="blocks-source-details">
        <strong>{habit.name}</strong>
        <span className="blocks-habit-estimate">
          <Clock3 />
          {formatDuration(habitDuration(habit))}
        </span>
      </span>
    </button>
  );
}

export function TodoCompletion({ task }: { task: Task }) {
  const updateTask = useTaskStore((state) => state.updateTask);
  const isDemoMode = useTaskStore((state) => state.isDemoMode);
  const terminal = task.status === "done" || task.status === "kill";
  const setStatus = (status: TaskStatus) => updateTask(task.id, { status });
  return (
    <div
      data-block-control
      className="blocks-task-completion"
      aria-label={`Status for ${task.title}`}
    >
      {terminal ? (
        <button
          type="button"
          disabled={isDemoMode}
          aria-label={`Restore ${task.title}`}
          title="Restore task"
          onClick={() => setStatus("not-started")}
        >
          <RotateCcw />
        </button>
      ) : (
        <>
          <button
            type="button"
            disabled={isDemoMode}
            aria-label={`Complete ${task.title}`}
            title="Complete"
            onClick={() => setStatus("done")}
          >
            <Check />
          </button>
          <button
            type="button"
            disabled={isDemoMode}
            aria-label={`Kill ${task.title}`}
            title="Kill"
            onClick={() => setStatus("kill")}
          >
            <CircleX />
          </button>
        </>
      )}
    </div>
  );
}

export function HabitCompletion({ habit, date }: { habit: Habit; date: string }) {
  const value = useHabitStore((state) => state.logs[date]?.[habit.id]);
  const setLog = useHabitStore((state) => state.setLog);
  return (
    <span
      data-block-control
      className="blocks-habit-completion"
      style={{ "--habit-color": habitColor(habit) } as CSSProperties}
    >
      <HabitLogControl
        habit={habit}
        label={`${habit.name} on ${date}`}
        value={value}
        disabled={date < HABIT_TRACKING_START || date > localDateKey(new Date())}
        onChange={(value) => setLog(date, habit.id, value)}
      />
    </span>
  );
}

export function ScheduledBlock({
  block,
  segment,
  lane,
  title,
  date,
  task,
  habit,
  onEdit,
}: {
  block: TimeBlock;
  segment: TimelineSegment;
  lane?: BlockLane;
  title: string;
  date: string;
  task?: Task;
  habit?: Habit;
  onEdit: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${block.id}-${segment.row}`,
    data: {
      category: block.category,
      block,
      title,
      duration: block.end - block.start,
    } satisfies BlockDragItem,
  });
  const marker = isInstantBlock(block);
  const compact = segment.rowCount === 1;
  const terminal = task?.status === "done" || task?.status === "kill";
  const timeRange =
    segment.start === segment.end
      ? formatTime(segment.start)
      : `${formatTime(segment.start)} – ${formatTime(segment.end)}`;
  const icon = habit ? (habit.icon ?? "circle") : (block.icon ?? (marker ? "sun" : "utensils"));
  const style = {
    top: segment.row * SLOT_HEIGHT,
    height: segment.rowCount * SLOT_HEIGHT - 3,
    "--block-color": blockColor(block, habit),
    "--block-column": lane?.column ?? 0,
    "--block-columns": lane?.columns ?? 1,
    ...(task ? { "--priority-color": PRIORITY_COLORS[task.priority] } : {}),
  } as CSSProperties;
  const className = cn("blocks-scheduled", `blocks-category-${block.category}`, {
    "is-compact": compact,
    "is-done": terminal,
    "is-dragging": isDragging,
    "is-overlapping": (lane?.columns ?? 1) > 1,
  });

  return (
    <div
      ref={setNodeRef}
      data-block-item
      data-block-id={block.id}
      className={className}
      style={style}
      onPointerDown={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        if ((event.target as HTMLElement).closest("[data-block-control]")) return;
        listeners?.onPointerDown?.(event);
      }}
    >
      <button
        className="blocks-scheduled-content"
        type="button"
        {...attributes}
        onKeyDown={(event) => listeners?.onKeyDown?.(event)}
        onClick={onEdit}
        aria-label={
          marker
            ? `Edit ${title}, at ${formatTime(block.start)}`
            : `Edit ${title}, ${formatTime(segment.start)} to ${formatTime(segment.end)}`
        }
      >
        <span className="blocks-scheduled-icon" aria-hidden="true">
          {task ? <Check /> : <HabitIcon name={icon} />}
        </span>
        <span className="blocks-scheduled-text">
          <strong>
            <span>{title}</span>
            {block.repeatDaily && (
              <Repeat2 className="blocks-cycle-icon" aria-label="Repeats every day" />
            )}
          </strong>
          {task ? (
            <TodoDetails task={task} timeRange={timeRange} />
          ) : (
            <span className="blocks-time-range">{timeRange}</span>
          )}
        </span>
      </button>
      {task && <TodoCompletion task={task} />}
      {habit && <HabitCompletion habit={habit} date={date} />}
    </div>
  );
}
