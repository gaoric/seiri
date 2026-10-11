import { Dialog } from "@base-ui/react/dialog";
import { CalendarDays, Check, CheckSquare2, Hash, Layers3, Type } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useTaskStore } from "@/features/todo/todo-store";
import { useHabitStore } from "@/features/habits/habit-store";
import {
  HABIT_COLORS,
  MAX_HABITS,
  habitColor,
  habitColorName,
  habitColorSelection,
  type HabitColor,
} from "@/features/habits/habit-colors";
import { HABIT_ICONS, type HabitIconName } from "@/features/habits/habit-icons";
import type { HabitLogType } from "@/features/habits/habit-types";
import type { Priority, TaskStatus, EstimateUnit } from "@/features/todo/todo-types";
import {
  ESTIMATE_BOUNDS,
  STATUS_LABELS,
  normalizeEstimateAmount,
} from "@/features/todo/todo-utils";
import { useBlockStore } from "./block-store";
import { ItemEditor } from "../../shared/ui/item-editor";
import { ColorPicker } from "../../shared/ui/color-picker";
import type { BlockCategory, BlockDraft, TimeBlock, WakingHours } from "./block-types";
import {
  CATEGORY_LABELS,
  DEFAULT_BLOCK_COLOR,
  dayMinute,
  formatDuration,
  parseTime,
  placementError,
  timeInput,
  wakingWindow,
} from "./block-utils";

export function EditorDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <ItemEditor title={title} onClose={onClose} className="blocks-editor">
      {children}
    </ItemEditor>
  );
}

export function WakingHoursForm({ hours, onSaved }: { hours?: WakingHours; onSaved: () => void }) {
  const [start, setStart] = useState(timeInput(hours?.start ?? 480));
  const [end, setEnd] = useState(timeInput(hours?.end ?? 1440));
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="blocks-form"
      onSubmit={(event) => {
        event.preventDefault();
        const error = useBlockStore.getState().setWakingHours(wakingWindow(start, end));
        setError(error);
        if (!error) onSaved();
      }}
    >
      <div className="blocks-time-fields">
        <label>
          Wake up
          <input
            aria-label="Wake up"
            type="time"
            step={60}
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          Go to sleep
          <input
            aria-label="Go to sleep"
            type="time"
            step={60}
            required
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
      </div>
      <p className="blocks-editor-hint">
        {parseTime(end) <= parseTime(start) ? "Sleep time is the following day. " : ""}
        {formatDuration(wakingWindow(start, end).end - parseTime(start))} to shape your day.
      </p>
      {error && (
        <p className="blocks-error" role="alert">
          {error}
        </p>
      )}
      <button className="blocks-primary" type="submit">
        {hours ? "Save waking hours" : "Start planning"}
      </button>
    </form>
  );
}

export function BlockEditor({
  draft,
  date,
  hours,
  onClose,
}: {
  draft: BlockDraft;
  date: string;
  hours: WakingHours;
  onClose: () => void;
}) {
  const taskState = useTaskStore();
  const habitState = useHabitStore();
  const blockState = useBlockStore();
  const [category, setCategory] = useState(draft.category);
  const [sourceId, setSourceId] = useState(draft.sourceId ?? "");
  const sourceTask = taskState.tasks[sourceId];
  const sourceHabit = habitState.habits.find((habit) => habit.id === sourceId);
  const [title, setTitle] = useState(
    sourceTask?.title ?? sourceHabit?.name ?? draft.block?.title ?? "",
  );
  const [description, setDescription] = useState(sourceTask?.description ?? "");
  const [priority, setPriority] = useState<Priority>(sourceTask?.priority ?? 1);
  const [status, setStatus] = useState<TaskStatus>(sourceTask?.status ?? "not-started");
  const [estimateAmount, setEstimateAmount] = useState(sourceTask?.estimate?.amount ?? 30);
  const [estimateUnit, setEstimateUnit] = useState<EstimateUnit>(
    sourceTask?.estimate?.unit ?? "minutes",
  );
  const [dueOn, setDueOn] = useState(sourceTask ? (sourceTask.dueOn ?? "") : date);
  const [estimateMinutes, setEstimateMinutes] = useState(
    draft.block?.category === "habit"
      ? draft.block.end - draft.block.start
      : (sourceHabit?.estimateMinutes ?? 0),
  );
  const [icon, setIcon] = useState<HabitIconName | null>(
    sourceHabit
      ? sourceHabit.icon
      : (draft.block?.icon ?? (draft.category === "event" ? "sun" : "circle")),
  );
  const [logType, setLogType] = useState<HabitLogType>(sourceHabit?.logType ?? "checkbox");
  const [color, setColor] = useState<HabitColor>(
    sourceHabit ? (sourceHabit.color ?? habitColorName(sourceHabit)) : "blue",
  );
  const [customColor, setCustomColor] = useState(draft.block?.color);
  const defaultColor =
    category === "habit" ? habitColor({ id: sourceHabit?.id ?? "", color }) : DEFAULT_BLOCK_COLOR;
  const boundary = draft.block?.boundary;
  const [start, setStart] = useState(timeInput(draft.start));
  const [end, setEnd] = useState(timeInput(draft.end));
  const [recurring, setRecurring] = useState(Boolean(boundary || draft.block?.repeatDaily));
  const [error, setError] = useState<string | null>(null);

  function selectSource(id: string, nextCategory = category) {
    setSourceId(id);
    setCustomColor(undefined);
    const task = nextCategory === "todo" ? taskState.tasks[id] : undefined;
    const habit =
      nextCategory === "habit" ? habitState.habits.find((item) => item.id === id) : undefined;
    setTitle(task?.title ?? habit?.name ?? "");
    setDescription(task?.description ?? "");
    setPriority(task?.priority ?? 1);
    setStatus(task?.status ?? "not-started");
    setEstimateAmount(task?.estimate?.amount ?? 30);
    setEstimateUnit(task?.estimate?.unit ?? "minutes");
    setDueOn(task ? (task.dueOn ?? "") : date);
    setEstimateMinutes(habit?.estimateMinutes ?? 0);
    if (nextCategory === "habit" && !draft.sourceOnly && !draft.block) {
      setEnd(
        timeInput(Math.min(dayMinute(start, hours) + (habit?.estimateMinutes ?? 0), hours.end)),
      );
    }
    setIcon(habit ? habit.icon : nextCategory === "event" ? "sun" : "circle");
    setLogType(habit?.logType ?? "checkbox");
    setColor(habit ? (habit.color ?? habitColorName(habit)) : "blue");
    setError(null);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setError("Give this item a name.");
      return;
    }
    if (category === "todo" && taskState.isDemoMode) {
      setError("Exit Todo demo mode before changing or scheduling real tasks.");
      return;
    }
    if (category === "habit" && !sourceId && habitState.habits.length >= MAX_HABITS) {
      setError(`You can keep up to ${MAX_HABITS} habits. Edit an existing habit instead.`);
      return;
    }
    if (
      sourceId &&
      ((category === "todo" && !sourceTask) || (category === "habit" && !sourceHabit))
    ) {
      setError("This item has been removed. Choose another item.");
      return;
    }
    const block: TimeBlock = {
      id: draft.block?.id ?? crypto.randomUUID(),
      category,
      sourceId: sourceId || undefined,
      title: title.trim(),
      icon: icon ?? undefined,
      color: customColor,
      boundary,
      start: dayMinute(start, hours),
      end: dayMinute(end, hours),
      repeatDaily: category === "event" && recurring,
    };
    if (!draft.sourceOnly) {
      const error = placementError(block, hours);
      if (error) {
        setError(error);
        return;
      }
      if (category === "event") {
        const error = blockState.saveBlock(date, block, recurring);
        if (error) {
          setError(error);
          return;
        }
      }
    }
    if (category === "todo") {
      const id = sourceId || taskState.addTask();
      taskState.updateTask(id, {
        title: title.trim(),
        description,
        priority,
        status,
        dueOn: dueOn || null,
        estimate: {
          amount: normalizeEstimateAmount(estimateAmount, estimateUnit),
          unit: estimateUnit,
        },
      });
      block.sourceId = id;
    }
    if (category === "habit") {
      const fields = { name: title.trim(), logType, color, icon, estimateMinutes };
      const id = sourceId || habitState.addHabit(fields);
      if (!id) {
        setError(`You can keep up to ${MAX_HABITS} habits.`);
        return;
      }
      if (sourceId) habitState.updateHabit(id, fields);
      block.sourceId = id;
    }
    if (!draft.sourceOnly && (category === "todo" || category === "habit"))
      blockState.saveBlock(date, block);
    onClose();
  }

  return (
    <EditorDialog
      title={
        draft.sourceOnly
          ? `Edit ${CATEGORY_LABELS[category].toLowerCase()}`
          : draft.block
            ? "Edit block"
            : "New block"
      }
      onClose={onClose}
    >
      <form className="blocks-form" onSubmit={save}>
        {!draft.block && !draft.sourceOnly && (
          <fieldset className="blocks-option-picker">
            <legend>Block type</legend>
            <div role="group" aria-label="Block category">
              {(["event", "todo", "habit"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`blocks-category-${option}`}
                  aria-pressed={category === option}
                  onClick={() => {
                    setCategory(option);
                    selectSource("", option);
                    setRecurring(false);
                    if (draft.end - draft.start <= 30)
                      setEnd(
                        timeInput(
                          Math.min(
                            dayMinute(start, hours) + (option === "habit" ? 0 : 30),
                            hours.end,
                          ),
                        ),
                      );
                  }}
                >
                  {option === "event" ? (
                    <CalendarDays />
                  ) : option === "todo" ? (
                    <Check />
                  ) : (
                    <Layers3 />
                  )}
                  <span>{CATEGORY_LABELS[option]}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {(category === "todo" || category === "habit") && !draft.block && !draft.sourceOnly && (
          <label>
            Use an existing {CATEGORY_LABELS[category].toLowerCase()}
            <select
              aria-label="Existing item"
              value={sourceId}
              onChange={(event) => selectSource(event.target.value)}
            >
              <option value="">Create new {CATEGORY_LABELS[category].toLowerCase()}</option>
              {category === "todo"
                ? taskState.activeOrder
                    .filter((id) => taskState.tasks[id]?.title.trim())
                    .map((id) => (
                      <option key={id} value={id}>
                        {taskState.tasks[id]!.title}
                      </option>
                    ))
                : habitState.habits.map((habit) => (
                    <option key={habit.id} value={habit.id}>
                      {habit.name}
                    </option>
                  ))}
            </select>
          </label>
        )}
        <label className="blocks-name-field">
          Name
          <input
            aria-label="Block name"
            autoFocus
            required
            maxLength={200}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={
              category === "event"
                ? "Breakfast, work, wind down…"
                : category === "todo"
                  ? "What needs doing?"
                  : "Read, stretch, journal…"
            }
          />
        </label>
        {category === "todo" && (
          <>
            <div className="blocks-time-fields">
              <label>
                Priority
                <select
                  aria-label="Todo priority"
                  value={priority}
                  onChange={(event) => setPriority(Number(event.target.value) as Priority)}
                >
                  <option value={0}>0 · High</option>
                  <option value={1}>1 · Medium</option>
                  <option value={2}>2 · Low</option>
                </select>
              </label>
              <label>
                Status
                <select
                  aria-label="Todo status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as TaskStatus)}
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="blocks-time-fields">
              <label>
                Estimate
                <input
                  aria-label="Todo estimate"
                  type="number"
                  min={ESTIMATE_BOUNDS[estimateUnit][0]}
                  max={ESTIMATE_BOUNDS[estimateUnit][1]}
                  required
                  value={estimateAmount}
                  onChange={(event) => setEstimateAmount(Number(event.target.value))}
                />
              </label>
              <label>
                Unit
                <select
                  aria-label="Todo estimate unit"
                  value={estimateUnit}
                  onChange={(event) => {
                    const unit = event.target.value as EstimateUnit;
                    setEstimateUnit(unit);
                    setEstimateAmount(normalizeEstimateAmount(estimateAmount, unit));
                  }}
                >
                  {(["minutes", "hours", "days", "weeks", "months"] as const).map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Due date
              <input
                aria-label="Todo due date"
                type="date"
                value={dueOn}
                onChange={(event) => setDueOn(event.target.value)}
              />
            </label>
            <label>
              Description
              <textarea
                aria-label="Todo description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
              />
            </label>
          </>
        )}
        {category === "habit" && (
          <fieldset className="blocks-option-picker">
            <legend>Log with</legend>
            <div role="group" aria-label="Habit logging type">
              {[
                { type: "checkbox", label: "Check", Icon: CheckSquare2 },
                { type: "level", label: "Levels", Icon: Layers3 },
                { type: "number", label: "Number", Icon: Hash },
                ...(logType === "text" ? [{ type: "text", label: "Text", Icon: Type }] : []),
              ].map(({ type, label, Icon }) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={logType === type}
                  onClick={() => setLogType(type as HabitLogType)}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {category === "habit" && (
          <label>
            Time estimate (minutes)
            <input
              aria-label="Habit time estimate"
              type="number"
              min={0}
              max={1440}
              step={1}
              required
              value={estimateMinutes}
              onChange={(event) => {
                const minutes = Number(event.target.value);
                setEstimateMinutes(minutes);
                if (!draft.sourceOnly) {
                  setEnd(timeInput(Math.min(dayMinute(start, hours) + minutes, hours.end)));
                }
              }}
            />
          </label>
        )}
        {(!draft.sourceOnly || category === "habit") && (
          <ColorPicker
            value={customColor ?? defaultColor}
            options={HABIT_COLORS.filter((option) => option.name !== "lavender")}
            hexLabel="Block color"
            onReset={!draft.sourceOnly ? () => setCustomColor(undefined) : undefined}
            onChange={(value) => {
              if (draft.sourceOnly && category === "habit") setColor(habitColorSelection(value));
              if (!draft.sourceOnly) setCustomColor(value);
            }}
          />
        )}
        {category !== "todo" && (
          <fieldset className="blocks-icon-picker">
            <legend>Icon</legend>
            <div>
              <button
                type="button"
                aria-label="No icon"
                title="No icon"
                aria-pressed={icon === null}
                onClick={() => setIcon(null)}
              >
                <Type />
              </button>
              {HABIT_ICONS.map(({ name, label, Icon }) => (
                <button
                  key={name}
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-pressed={icon === name}
                  onClick={() => setIcon(name)}
                >
                  <Icon />
                </button>
              ))}
            </div>
          </fieldset>
        )}
        {!draft.sourceOnly && !boundary && (
          <div className="blocks-time-fields">
            <label>
              Start
              <input
                aria-label="Block start"
                type="time"
                step={60}
                required
                value={start}
                onChange={(event) => {
                  setStart(event.target.value);
                  if (category === "habit") {
                    setEnd(
                      timeInput(
                        Math.min(dayMinute(event.target.value, hours) + estimateMinutes, hours.end),
                      ),
                    );
                  }
                }}
              />
            </label>
            <label>
              End
              <input
                aria-label="Block end"
                type="time"
                step={60}
                required
                value={end}
                onChange={(event) => {
                  setEnd(event.target.value);
                  if (category === "habit") {
                    setEstimateMinutes(
                      dayMinute(event.target.value, hours) - dayMinute(start, hours),
                    );
                  }
                }}
              />
            </label>
          </div>
        )}
        {!boundary && category === "event" && (
          <label className="blocks-check-label">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(event) => setRecurring(event.target.checked)}
            />
            Repeat every day
          </label>
        )}
        <p className="blocks-editor-hint">
          {boundary
            ? `Follows your ${boundary === "morning" ? "wake" : "sleep"} time. Changes apply to your daily default.`
            : category === "event"
              ? recurring
                ? "Repeats every day. Dragging a block adjusts this day only."
                : "For this day only. Matching start and end times create a point in your day."
              : `Edits also appear in ${category === "todo" ? "Todo" : "Habits"}. ${draft.sourceOnly ? "" : "Timing applies to this day only."}`}
        </p>
        {error && (
          <p className="blocks-error" role="alert">
            {error}
          </p>
        )}
        <div className="blocks-editor-actions">
          {draft.block && !boundary && (
            <button
              className="blocks-remove"
              type="button"
              onClick={() => {
                blockState.removeBlock(date, draft.block!.id, category === "event" && recurring);
                onClose();
              }}
            >
              {category === "event" && recurring ? "Remove daily default" : "Remove from day"}
            </button>
          )}
          <Dialog.Close type="button">Cancel</Dialog.Close>
          <button className="blocks-primary" type="submit">
            {draft.sourceOnly || draft.block ? "Save changes" : "Create block"}
          </button>
        </div>
      </form>
    </EditorDialog>
  );
}
