import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Check, Clock3, Repeat2 } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { habitColor } from "@/features/habits/habit-colors";
import { HabitIcon } from "@/features/habits/habit-icons";
import { HabitLogControl } from "../habits/HabitLogControl";
import { useHabitStore } from "@/features/habits/habit-store";
import { HABIT_TRACKING_START, localDateKey } from "@/features/habits/habit-utils";
import type { Habit } from "@/features/habits/habit-types";
import type { Task } from "@/features/todo/todo-types";
import { cn } from "@/shared/ui/utils";
import { PRIORITY_COLORS, TodoCompletion, TodoDetails } from "./BlockCards";
import type { BlockDragItem, TimeBlock, WakingHours } from "./block-types";
import { blockColor, formatDuration, formatTime, isInstantBlock } from "./block-utils";
import {
  connectedTimelineItems,
  connectedTimelineConnections,
  connectedIconHeight,
  connectedTimePosition,
  elapsedFraction,
  minuteOnDate,
  withDayBoundaries,
  type ConnectedTimelineItem,
} from "./connected-timeline";
import "./connected-timeline.css";

type ConnectedTimelineProps = {
  hours: WakingHours;
  blocks: TimeBlock[];
  date: string;
  tasks: Record<string, Task>;
  habits: Habit[];
  onEdit: (block: TimeBlock) => void;
  onCreate: (start: number, end: number) => void;
};

export function ConnectedTimeline({
  hours,
  blocks,
  date,
  tasks,
  habits,
  onEdit,
  onCreate,
}: ConnectedTimelineProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const items = connectedTimelineItems(hours, withDayBoundaries(hours, blocks));
  const height = items.reduce((total, item) => total + item.height, 0);
  const minute = minuteOnDate(date, now);
  const showNow = minute >= hours.start && minute <= hours.end;
  const currentPosition = connectedTimePosition(items, minute);
  const colorFor = (block: TimeBlock) =>
    blockColor(
      block,
      habits.find((habit) => habit.id === block.sourceId),
    );

  return (
    <div className="blocks-connected-scroll">
      <div
        className={cn("blocks-connected", { "is-live": showNow })}
        style={{ height }}
        aria-label="Connected timeline"
      >
        {connectedTimelineConnections(items).map(({ from, to, start, end, dotted }) => (
          <span
            key={`${from.key}-${to.key}`}
            className={cn("blocks-connected-line", { "is-dotted": dotted })}
            data-from={from.block!.id}
            data-to={to.block!.id}
            aria-hidden="true"
            style={
              {
                top: start,
                height: end - start,
                "--line-height": `${end - start}px`,
                "--line-from": colorFor(from.block!),
                "--line-to": colorFor(to.block!),
                "--line-elapsed": `${Math.max(0, Math.min(end - start, currentPosition - start))}px`,
                "--fade-start": `${Math.max(0, currentPosition - start - 28)}px`,
              } as CSSProperties
            }
          >
            <i />
          </span>
        ))}
        {items.map((item) => {
          const { block } = item;
          const progress = elapsedFraction(minute, item.start, item.end);
          if (!block) {
            return (
              <ConnectedGap
                key={item.key}
                item={item}
                progress={progress}
                currentPosition={currentPosition}
                onCreate={onCreate}
              />
            );
          }
          const task = block.category === "todo" ? tasks[block.sourceId ?? ""] : undefined;
          const habit =
            block.category === "habit"
              ? habits.find((habit) => habit.id === block.sourceId)
              : undefined;
          return (
            <ConnectedBlock
              key={item.key}
              item={item}
              block={block}
              task={task}
              habit={habit}
              date={date}
              progress={progress}
              currentPosition={currentPosition}
              onEdit={() => onEdit(block)}
            />
          );
        })}
        {showNow && (
          <div
            className="blocks-connected-now"
            style={{ top: currentPosition }}
            aria-label={`Current time ${formatTime(Math.floor(minute))}`}
          >
            <i />
            <time>{formatTime(Math.floor(minute))}</time>
          </div>
        )}
      </div>
    </div>
  );
}

function timelineStyle(
  item: ConnectedTimelineItem,
  progress: number,
  currentPosition: number,
): CSSProperties {
  return {
    top: item.top,
    height: item.height,
    "--elapsed": `${progress * 100}%`,
    "--icon-height": `${connectedIconHeight(item)}px`,
    "--icon-fade-start": `${Math.max(0, currentPosition - 28 - item.top - 8)}px`,
    "--icon-fade-end": `${currentPosition - item.top - 8}px`,
  } as CSSProperties;
}

function ConnectedGap({
  item,
  progress,
  currentPosition,
  onCreate,
}: {
  item: ConnectedTimelineItem;
  progress: number;
  currentPosition: number;
  onCreate: ConnectedTimelineProps["onCreate"];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: item.key,
    data: { minute: item.start },
  });
  const duration = item.end - item.start;
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn("blocks-connected-gap", { "is-over": isOver })}
      style={timelineStyle(item, progress, currentPosition)}
      aria-label={`Plan free time, ${formatTime(item.start)} to ${formatTime(item.end)}`}
      onClick={() => onCreate(item.start, Math.min(item.start + 30, item.end))}
    >
      {duration >= 30 && (
        <span>
          <Clock3 />
          {formatDuration(duration)} free
          <span>
            {formatTime(item.start)} – {formatTime(item.end)}
          </span>
        </span>
      )}
    </button>
  );
}

function ConnectedBlock({
  item,
  block,
  task,
  habit,
  date,
  progress,
  currentPosition,
  onEdit,
}: {
  item: ConnectedTimelineItem;
  block: TimeBlock;
  task?: Task;
  habit?: Habit;
  date: string;
  progress: number;
  currentPosition: number;
  onEdit: () => void;
}) {
  const title = task?.title ?? habit?.name ?? block.title;
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `connected-${item.key}`,
    disabled: Boolean(block.boundary),
    data: {
      category: block.category,
      block,
      title,
      duration: block.end - block.start,
    } satisfies BlockDragItem,
  });
  const marker = isInstantBlock(block);
  const terminal = task?.status === "done" || task?.status === "kill";
  const style = {
    ...timelineStyle(item, progress, currentPosition),
    "--block-color": blockColor(block, habit),
    ...(task ? { "--priority-color": PRIORITY_COLORS[task.priority] } : {}),
  } as CSSProperties;
  const icon = habit ? (habit.icon ?? "circle") : (block.icon ?? (marker ? "sun" : "utensils"));
  return (
    <div
      ref={setNodeRef}
      data-block-item
      data-block-id={block.id}
      data-elapsed={progress}
      className={cn("blocks-connected-block", `blocks-category-${block.category}`, {
        "is-dragging": isDragging,
        "is-done": terminal,
        "is-first": block.boundary === "morning",
        "is-last": block.boundary === "night",
        "is-boundary": Boolean(block.boundary),
      })}
      style={style}
      onPointerDown={(event) => {
        if (!event.currentTarget.contains(event.target as Node)) return;
        if ((event.target as HTMLElement).closest("[data-block-control]")) return;
        listeners?.onPointerDown?.(event);
      }}
    >
      <span className="blocks-connected-times">
        <time style={{ top: marker ? 32 : 12 }}>{formatTime(item.start)}</time>
        {!marker && (
          <time style={{ top: 4 + connectedIconHeight(item) }}>{formatTime(item.end)}</time>
        )}
      </span>
      <button
        className="blocks-connected-content"
        type="button"
        {...(block.boundary ? {} : attributes)}
        onKeyDown={(event) => listeners?.onKeyDown?.(event)}
        onClick={onEdit}
        aria-label={
          marker
            ? `Edit ${title}, at ${formatTime(block.start)}`
            : `Edit ${title}, ${formatTime(item.start)} to ${formatTime(item.end)}`
        }
      >
        <span className="blocks-connected-icon" aria-hidden="true">
          <i />
          {task ? <Check /> : <HabitIcon name={icon} />}
        </span>
        <span className="blocks-connected-details">
          <strong>
            {title}
            {block.repeatDaily && (
              <Repeat2 className="blocks-cycle-icon" aria-label="Repeats every day" />
            )}
          </strong>
          {!marker && (
            <span className="blocks-connected-timing">
              <span>{formatDuration(item.end - item.start)}</span>
            </span>
          )}
          {task && <TodoDetails task={task} />}
        </span>
      </button>
      <div className="blocks-connected-controls" data-block-control>
        {task && <TodoCompletion task={task} />}
        {habit && <ConnectedHabitLog habit={habit} date={date} />}
      </div>
    </div>
  );
}

function ConnectedHabitLog({ habit, date }: { habit: Habit; date: string }) {
  const value = useHabitStore((state) => state.logs[date]?.[habit.id]);
  const setLog = useHabitStore((state) => state.setLog);
  return (
    <span
      className="blocks-connected-habit-log"
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
