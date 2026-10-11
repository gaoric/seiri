import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  ArrowDown,
  ArrowUp,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListTree,
  Pencil,
  Plus,
  Repeat2,
} from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import { toast } from "sonner";
import { useTaskStore } from "@/features/todo/todo-store";
import type { SortDirection, TaskSortKey } from "@/features/todo/todo-types";
import { sortTaskIds } from "@/features/todo/todo-utils";
import { useHabitStore } from "@/features/habits/habit-store";
import { localDateKey } from "@/features/habits/habit-utils";
import { livePlanBlocks, useBlockStore } from "./block-store";
import { CalendarPopoverContent } from "@/shared/ui/calendar";
import { Popover, PopoverTrigger } from "@/shared/ui/popover";
import { BlockEditor, EditorDialog, WakingHoursForm } from "./BlockEditor";
import { HabitCard, ScheduledBlock, TodoCard } from "./BlockCards";
import { ConnectedTimeline } from "./ConnectedTimeline";
import type { BlockCategory, BlockDraft, BlockDragItem, TimeBlock } from "./block-types";
import {
  SLOT_HEIGHT,
  formatDuration,
  formatTime,
  habitDuration,
  plannedDuration,
  taskDuration,
  timelineRows,
  timelineSegments,
  timelineLanes,
} from "./block-utils";
import "./blocks.css";

export function BlocksTool() {
  const data = useBlockStore();
  const tasks = useTaskStore((state) => state.tasks);
  const taskOrder = useTaskStore((state) => state.activeOrder);
  const isDemoMode = useTaskStore((state) => state.isDemoMode);
  const habits = useHabitStore((state) => state.habits);
  const [anchor, setAnchor] = useState(() => new Date());
  const [draft, setDraft] = useState<BlockDraft | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [sortKey, setSortKey] = useState<TaskSortKey>("priority");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragged, setDragged] = useState<BlockDragItem | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const selectionStart = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );
  const date = localDateKey(anchor);
  const today = localDateKey(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayLabel =
    date === today
      ? "Today"
      : date === localDateKey(tomorrow)
        ? "Tomorrow"
        : anchor.toLocaleDateString(undefined, { weekday: "long" });
  const hours = data.wakingHours;
  const blocks = livePlanBlocks(data, date);
  const gridBlocks = blocks.filter((block) => !block.boundary);
  const rows = hours ? timelineRows(hours, gridBlocks) : [];
  const lanes = timelineLanes(gridBlocks);
  const laneCount = Math.max(1, ...[...lanes.values()].map((lane) => lane.columns));
  const plannedMinutes = plannedDuration(blocks);
  const sortedTodoIds = sortTaskIds(
    taskOrder.filter((id) => tasks[id]?.title.trim()),
    tasks,
    sortKey,
    sortDirection,
  );
  function sourceTitle(block: TimeBlock) {
    if (block.category === "todo") {
      return tasks[block.sourceId ?? ""]?.title ?? block.title;
    }
    if (block.category === "habit") {
      return habits.find((habit) => habit.id === block.sourceId)?.name ?? block.title;
    }
    return block.title;
  }

  function newDraft(category: BlockCategory = "event", sourceId?: string) {
    if (!hours) return;
    const habit = habits.find((item) => item.id === sourceId);
    let duration = 30;
    if (category === "habit") duration = habit ? habitDuration(habit) : 0;
    if (category === "todo" && sourceId && tasks[sourceId]) {
      duration = taskDuration(tasks[sourceId]);
    }
    const start = hours.start;
    setDraft({ category, sourceId, start, end: Math.min(start + duration, hours.end) });
  }

  function minuteAt(event: PointerEvent<HTMLDivElement>) {
    const top = event.currentTarget.getBoundingClientRect().top;
    const index = Math.max(
      0,
      Math.min(rows.length - 1, Math.floor((event.clientY - top) / SLOT_HEIGHT)),
    );
    return Math.min(hours!.end - 15, rows[index]!.minute);
  }

  function finishDrag({ active, over }: DragEndEvent) {
    setDragged(null);
    const item = active.data.current as BlockDragItem | undefined;
    if (!item || !over || !hours) return;
    const start = over.data.current?.minute as number;
    if (!Number.isFinite(start)) return;
    const end = start + item.duration;
    if (end > hours.end) {
      toast.error("There isn’t enough room before your sleep time.");
      return;
    }
    if (item.block) {
      const error = data.saveBlock(date, { ...item.block, start, end });
      if (error) toast.error(error);
    } else {
      const block: TimeBlock = {
        id: crypto.randomUUID(),
        category: item.category,
        sourceId: item.sourceId,
        title: item.title,
        start,
        end,
      };
      if (item.category === "todo" && isDemoMode) {
        toast.error("Exit Todo demo mode before planning your real tasks.");
        return;
      }
      const error = data.saveBlock(date, block);
      if (error) toast.error(error);
    }
  }

  if (!hours)
    return (
      <section className="blocks-tool" aria-label="Daily time blocks">
        <div className="blocks-onboarding">
          <span className="blocks-intro-icon">
            <Clock3 />
          </span>
          <h2>Make room for your day.</h2>
          <p>
            Start with your waking hours. Keep a few daily events, then give your todos and habits a
            place in today.
          </p>
          <WakingHoursForm onSaved={() => {}} />
          <span className="blocks-note">
            A fresh plan each day. A familiar structure to start from.
          </span>
        </div>
      </section>
    );

  const selectionRow = selection
    ? rows.findIndex((row) => !row.marker && row.minute === selection.start)
    : 0;
  const selectionEndRow = selection ? rows.findIndex((row) => row.minute >= selection.end) : 0;
  return (
    <section className="blocks-tool" aria-label="Daily time blocks">
      <div className="blocks-toolbar">
        <div className="blocks-month-control">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              render={
                <button className="blocks-month-button" type="button" aria-label="Choose day" />
              }
            >
              {anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              <ChevronDown />
            </PopoverTrigger>
            <CalendarPopoverContent
              className="blocks-calendar"
              aria-label="Choose a day"
              selected={anchor}
              onSelect={(selected) => {
                setAnchor(selected);
                setCalendarOpen(false);
              }}
            >
              <button
                className="blocks-calendar-today"
                type="button"
                onClick={() => {
                  setAnchor(new Date());
                  setCalendarOpen(false);
                }}
              >
                Go to today
              </button>
            </CalendarPopoverContent>
          </Popover>
        </div>
        <div className="blocks-day-navigation">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() =>
              setAnchor((current) => {
                const next = new Date(current);
                next.setDate(next.getDate() - 1);
                return next;
              })
            }
          >
            <ChevronLeft />
          </button>
          <div className="blocks-day-display">
            <h2
              aria-label={dayLabel}
              title={anchor.toLocaleDateString(undefined, { dateStyle: "full" })}
            >
              <span>{anchor.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <strong>{anchor.getDate()}</strong>
            </h2>
            {date === today && <span className="blocks-current-day">Today</span>}
          </div>
          <button
            type="button"
            aria-label="Next day"
            onClick={() =>
              setAnchor((current) => {
                const next = new Date(current);
                next.setDate(next.getDate() + 1);
                return next;
              })
            }
          >
            <ChevronRight />
          </button>
          <div className="blocks-view-switch" role="group" aria-label="Timeline view">
            <button
              type="button"
              aria-label="Grid timeline"
              aria-pressed={data.timelineView === "grid"}
              title="Grid timeline"
              onClick={() => data.setTimelineView("grid")}
            >
              <CalendarRange />
            </button>
            <button
              type="button"
              aria-label="Connected timeline"
              aria-pressed={data.timelineView === "connected"}
              title="Connected timeline"
              onClick={() => data.setTimelineView("connected")}
            >
              <ListTree />
            </button>
          </div>
          {date !== today && (
            <button className="blocks-today" type="button" onClick={() => setAnchor(new Date())}>
              Today
            </button>
          )}
        </div>
        <div className="blocks-hours-control">
          <button
            className="blocks-hours-button"
            type="button"
            onClick={() => setSettingsOpen(true)}
          >
            <Clock3 />
            {formatTime(hours.start)} – {formatTime(hours.end)}
            <Pencil />
          </button>
          <button className="blocks-new-button" type="button" onClick={() => newDraft()}>
            <Plus />
            New block
          </button>
        </div>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={(args) =>
          args.pointerCoordinates ? pointerWithin(args) : closestCenter(args)
        }
        onDragStart={({ active }) => setDragged(active.data.current as BlockDragItem)}
        onDragEnd={finishDrag}
        onDragCancel={() => setDragged(null)}
      >
        <div className="blocks-layout">
          <SourceTray
            category="todo"
            count={sortedTodoIds.length}
            onAdd={() => newDraft("todo")}
            controls={
              <div className="blocks-sort-controls">
                <label>
                  Sort by
                  <select
                    aria-label="Sort todos by"
                    value={sortKey}
                    onChange={(event) => setSortKey(event.target.value as TaskSortKey)}
                  >
                    {(
                      [
                        ["priority", "Priority"],
                        ["title", "Title"],
                        ["status", "Status"],
                        ["estimate", "Estimate"],
                        ["due", "Due date"],
                      ] as const
                    ).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  aria-label={`Sort ${sortDirection === "asc" ? "descending" : "ascending"}`}
                  title={
                    sortDirection === "asc"
                      ? "Ascending · click to reverse"
                      : "Descending · click to reverse"
                  }
                  onClick={() =>
                    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                  }
                >
                  {sortDirection === "asc" ? <ArrowUp /> : <ArrowDown />}
                </button>
              </div>
            }
          >
            {isDemoMode ? (
              <p className="blocks-empty">Exit Todo demo mode to schedule your real tasks.</p>
            ) : (
              sortedTodoIds.map((id) => (
                <TodoCard
                  key={id}
                  task={tasks[id]!}
                  scheduled={blocks.some(
                    (block) => block.sourceId === id && block.category === "todo",
                  )}
                  onEdit={() =>
                    setDraft({
                      category: "todo",
                      sourceId: id,
                      sourceOnly: true,
                      start: hours.start,
                      end: hours.start + 30,
                    })
                  }
                  onSchedule={() => newDraft("todo", id)}
                />
              ))
            )}
            {!isDemoMode && !sortedTodoIds.length && (
              <p className="blocks-empty">Your active todos live here. Add one here or in Todo.</p>
            )}
          </SourceTray>
          <div className="blocks-timeline-panel">
            {data.timelineView === "connected" ? (
              <ConnectedTimeline
                hours={hours}
                blocks={blocks}
                date={date}
                tasks={tasks}
                habits={habits}
                onEdit={(block) =>
                  setDraft({
                    category: block.category,
                    block,
                    sourceId: block.sourceId,
                    start: block.start,
                    end: block.end,
                  })
                }
                onCreate={(start, end) => setDraft({ category: "event", start, end })}
              />
            ) : (
              <div className="blocks-timeline-scroll">
                <div
                  className="blocks-timeline"
                  style={{
                    height: rows.length * SLOT_HEIGHT,
                    minWidth: laneCount > 2 ? 54 + laneCount * 130 : undefined,
                  }}
                  onPointerDown={(event) => {
                    if (
                      event.button !== 0 ||
                      event.pointerType === "touch" ||
                      !event.currentTarget.contains(event.target as Node) ||
                      (event.target as HTMLElement).closest("[data-block-item]")
                    )
                      return;
                    suppressClick.current = false;
                    selectionStart.current = minuteAt(event);
                    setSelection({
                      start: selectionStart.current,
                      end: selectionStart.current + 15,
                    });
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={(event) => {
                    if (selectionStart.current === null) return;
                    const minute = minuteAt(event);
                    setSelection({
                      start: Math.min(minute, selectionStart.current),
                      end: Math.max(minute, selectionStart.current) + 15,
                    });
                  }}
                  onPointerUp={(event) => {
                    if (selectionStart.current === null) return;
                    const minute = minuteAt(event);
                    setDraft({
                      category: "event",
                      start: Math.min(minute, selectionStart.current),
                      end: Math.min(
                        Math.max(minute, selectionStart.current) +
                          (minute === selectionStart.current ? 30 : 15),
                        hours.end,
                      ),
                    });
                    selectionStart.current = null;
                    suppressClick.current = true;
                    setTimeout(() => {
                      suppressClick.current = false;
                    }, 0);
                    setSelection(null);
                  }}
                  onPointerCancel={() => {
                    selectionStart.current = null;
                    setSelection(null);
                  }}
                >
                  {rows.map((row, index) => {
                    const { minute, marker } = row;
                    return (
                      <TimeSlot
                        key={marker?.id ?? minute}
                        markerId={marker?.id}
                        minute={minute}
                        index={index}
                        showLabel={
                          Boolean(marker || rows[index - 1]?.marker) ||
                          index === 0 ||
                          minute % 60 === 0
                        }
                        onCreate={() => {
                          if (suppressClick.current) {
                            suppressClick.current = false;
                            return;
                          }
                          setDraft({
                            category: "event",
                            start: minute,
                            end: Math.min(minute + 30, hours.end),
                          });
                        }}
                      />
                    );
                  })}
                  <span className="blocks-end-label">{formatTime(hours.end)}</span>
                  {gridBlocks.flatMap((block) =>
                    timelineSegments(block, rows).map((segment) => (
                      <ScheduledBlock
                        key={`${block.id}-${segment.row}`}
                        block={block}
                        segment={segment}
                        lane={lanes.get(block.id)}
                        title={sourceTitle(block)}
                        date={date}
                        task={block.category === "todo" ? tasks[block.sourceId ?? ""] : undefined}
                        habit={
                          block.category === "habit"
                            ? habits.find((habit) => habit.id === block.sourceId)
                            : undefined
                        }
                        onEdit={() =>
                          setDraft({
                            category: block.category,
                            block,
                            sourceId: block.sourceId,
                            start: block.start,
                            end: block.end,
                          })
                        }
                      />
                    )),
                  )}
                  {selection && (
                    <div
                      className="blocks-selection"
                      style={{
                        top: selectionRow * SLOT_HEIGHT,
                        height:
                          ((selectionEndRow < 0 ? rows.length : selectionEndRow) - selectionRow) *
                          SLOT_HEIGHT,
                      }}
                    >
                      {formatTime(selection.start)} – {formatTime(selection.end)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <SourceTray category="habit" count={habits.length} onAdd={() => newDraft("habit")}>
            {habits.map((habit) => (
              <HabitCard
                key={habit.id}
                habit={habit}
                scheduled={blocks.some(
                  (block) => block.sourceId === habit.id && block.category === "habit",
                )}
                onEdit={() =>
                  setDraft({
                    category: "habit",
                    sourceId: habit.id,
                    sourceOnly: true,
                    start: hours.start,
                    end: hours.start + habitDuration(habit),
                  })
                }
              />
            ))}
            {!habits.length && (
              <p className="blocks-empty">
                Small things, made intentional. Add a habit to give it time.
              </p>
            )}
          </SourceTray>
        </div>
        <DragOverlay style={{ pointerEvents: "none" }}>
          {dragged && (
            <div className={`blocks-drag-preview blocks-category-${dragged.category}`}>
              {dragged.title}
              <span>{formatDuration(dragged.duration)}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <div className="blocks-footer">
        <div className="blocks-summary">
          <span>{formatDuration(plannedMinutes)} planned</span>
          <span>{formatDuration(hours.end - hours.start - plannedMinutes)} open</span>
        </div>
        <span className="blocks-routine-note">
          <Repeat2 />
          Repeat events every day to keep a familiar structure.
        </span>
      </div>
      {draft && (
        <BlockEditor
          key={`${draft.block?.id ?? draft.sourceId ?? "new"}-${draft.start}`}
          draft={draft}
          date={date}
          hours={hours}
          onClose={() => setDraft(null)}
        />
      )}
      {settingsOpen && (
        <EditorDialog title="Waking hours" onClose={() => setSettingsOpen(false)}>
          <p className="blocks-editor-hint">
            Your default window for each day, including days that end after midnight.
          </p>
          <WakingHoursForm hours={hours} onSaved={() => setSettingsOpen(false)} />
        </EditorDialog>
      )}
    </section>
  );
}

function TimeSlot({
  minute,
  markerId,
  index,
  showLabel,
  onCreate,
}: {
  minute: number;
  markerId?: string;
  index: number;
  showLabel: boolean;
  onCreate: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: markerId ? `marker-slot-${markerId}` : minute,
    data: { minute },
  });
  return (
    <div
      className={`blocks-slot-row ${showLabel ? "is-hour" : ""}`}
      style={{ top: index * SLOT_HEIGHT }}
    >
      {showLabel && <span className="blocks-time-label">{formatTime(minute)}</span>}
      <button
        ref={setNodeRef}
        type="button"
        className={`blocks-slot ${isOver ? "is-over" : ""}`}
        aria-label={
          markerId ? `Marker time ${formatTime(minute)}` : `Create block at ${formatTime(minute)}`
        }
        onClick={onCreate}
      />
    </div>
  );
}

function SourceTray({
  category,
  count,
  onAdd,
  children,
  controls,
}: {
  category: "todo" | "habit";
  count: number;
  onAdd: () => void;
  children: React.ReactNode;
  controls?: React.ReactNode;
}) {
  return (
    <section
      className={`blocks-tray blocks-category-${category}`}
      aria-label={category === "todo" ? "Todos to schedule" : "Habits to schedule"}
    >
      <header>
        <h3>
          <i />
          {category === "todo" ? "Todos" : "Habits"}
          <span>{count}</span>
        </h3>
        <button type="button" aria-label={`New ${category}`} onClick={onAdd}>
          <Plus />
        </button>
      </header>
      {controls}
      <p className="blocks-tray-hint">
        {category === "habit" ? "Drag a habit onto your day" : "Drag a todo onto your day"}
      </p>
      <div className="blocks-tray-items">{children}</div>
    </section>
  );
}
