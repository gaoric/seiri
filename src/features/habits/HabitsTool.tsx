import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter,
  useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  BarChart3,
  Check,
  CheckSquare2,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  Hash,
  Layers3,
  Plus,
  Type,
  X,
} from "lucide-react";
import {
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  HABIT_ICONS,
  HabitIcon,
  type HabitIconName,
} from "@/features/habits/habit-icons";
import { useHabitStore } from "@/features/habits/habit-store";
import {
  HABIT_COLORS,
  MAX_HABITS,
  habitColor,
  habitColorName,
  type HabitColorName,
} from "@/features/habits/habit-colors";
import { HabitWheel } from "@/features/habits/HabitWheel";
import { HabitData } from "@/features/habits/HabitData";
import { HabitProgressChart } from "@/features/habits/HabitProgressChart";
import { SortableHabit } from "@/features/habits/SortableHabit";
import type {
  Habit,
  HabitLogType,
  HabitLogValue,
} from "@/features/habits/habit-types";
import {
  formatWeekRange,
  HABIT_TRACKING_START,
  habitMonthDays,
  habitPeriodStarts,
  habitWeekDays,
  localDateKey,
  moveMonth,
  moveWeek,
  startOfHabitWeek,
} from "@/features/habits/habit-utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogActions,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/shared/ui/select";

const LOG_TYPES: Array<{
  type: HabitLogType;
  label: string;
  description: string;
  Icon: typeof CheckSquare2;
}> = [
  {
    type: "checkbox",
    label: "Check",
    description: "Done or not done",
    Icon: CheckSquare2,
  },
  {
    type: "level",
    label: "Levels",
    description: "Log from one to four",
    Icon: Layers3,
  },
  {
    type: "number",
    label: "Number",
    description: "Record an amount",
    Icon: Hash,
  },
];

export function HabitsTool() {
  const habits = useHabitStore((state) => state.habits);
  const logs = useHabitStore((state) => state.logs);
  const setLog = useHabitStore((state) => state.setLog);
  const reorderHabit = useHabitStore((state) => state.reorderHabit);
  const [dragId, setDragId] = useState<string | null>(null);
  const draggedHabit = habits.find((habit) => habit.id === dragId);
  const habitIds = useMemo(() => habits.map((habit) => habit.id), [habits]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState<"week" | "month" | "wheel">("week");
  const [section, setSection] = useState<"tracker" | "data">("tracker");
  const period = view === "week" ? "week" : "month";
  const [editor, setEditor] = useState<Habit | "new" | null>(null);
  const days = useMemo(
    () => view === "week" ? habitWeekDays(anchor) : habitMonthDays(anchor),
    [anchor, view],
  );
  const today = new Date();
  const trackingStart = new Date(2026, 0, 4);
  const todayKey = localDateKey(today);
  const availablePeriods = habitPeriodStarts(period, today);
  const earliestStart = availablePeriods[availablePeriods.length - 1]!;
  const currentStart = view === "week"
    ? startOfHabitWeek(today)
    : new Date(today.getFullYear(), today.getMonth(), 1);
  const isCurrentPeriod = days[0].getTime() >= currentStart.getTime();
  const isFirstPeriod = days[0].getTime() <= earliestStart.getTime();
  const periodLabel = view === "week"
    ? formatWeekRange(days)
    : anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const gridStyle = {
    "--habit-day-count": days.length,
    "--habit-day-width": view === "month" ? "22px" : "64px",
  } as CSSProperties;

  function navigate(direction: -1 | 1) {
    setAnchor((current) => {
      const next = view === "week" ? moveWeek(current, direction) : moveMonth(current, direction);
      const nextStart = view === "week" ? startOfHabitWeek(next) : habitMonthDays(next)[0];
      if (nextStart < earliestStart) return trackingStart;
      return nextStart > currentStart ? today : next;
    });
  }

  function finishDrag({ active, over }: DragEndEvent) {
    if (over) reorderHabit(String(active.id), String(over.id));
    setDragId(null);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={({ active }) => setDragId(String(active.id))}
      onDragEnd={finishDrag} onDragCancel={() => setDragId(null)}>
    <SortableContext items={habitIds} strategy={verticalListSortingStrategy}>
    <section className="habits-tool" aria-label="Habit tracker">
      <div className="habits-toolbar">
        {section === "data" ? <button type="button" className="habit-data-back" onClick={() => setSection("tracker")}>
          <ChevronLeft />Back to tracker
        </button> :
        <div className="habit-week-navigation">
          <button
            type="button"
            aria-label={`Previous ${period}`}
            title={`Previous ${period}`}
            disabled={isFirstPeriod}
            onClick={() => navigate(-1)}
          >
            <ChevronLeft />
          </button>
          <Select value={localDateKey(days[0])} onValueChange={(value) => {
            if (!value) return;
            const selected = availablePeriods.find((date) => localDateKey(date) === value)!;
            setAnchor(selected < trackingStart ? trackingStart : selected);
          }}>
            <SelectTrigger className="habit-week-label" aria-label={`Select ${period}`} showChevron={false}>
              {periodLabel}
            </SelectTrigger>
            <SelectContent className="habit-period-picker" aria-label={`Available ${period}s`}>
              {availablePeriods.map((date) => (
                <SelectItem key={localDateKey(date)} value={localDateKey(date)} indicator="line">
                  {period === "week" ? `${formatWeekRange(habitWeekDays(date))}, ${date.getFullYear()}`
                    : date.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            aria-label={`Next ${period}`}
            title={`Next ${period}`}
            disabled={isCurrentPeriod}
            onClick={() => navigate(1)}
          >
            <ChevronRight />
          </button>
        </div>
        }

        <div className="habits-toolbar-actions">
          <button type="button" className="habit-data-button" aria-pressed={section === "data"}
            onClick={() => setSection(current => current === "tracker" ? "data" : "tracker")}>
            <ChartNoAxesCombined />Data
          </button>
          {section === "tracker" && <>
          <div className="habit-view-switch" role="group" aria-label="Habit view">
            {(["week", "month", "wheel"] as const).map((option) => (
              <button
                type="button"
                key={option}
                aria-pressed={view === option}
                onClick={() => {
                  setView(option);
                  // Keep the selected period at or before today when switching views.
                  setAnchor((current) => current < trackingStart ? trackingStart
                    : current > new Date() ? new Date() : current);
                }}
              >
                {option === "week" ? "Weekly" : option === "month" ? "Monthly" : "Wheel"}
              </button>
            ))}
          </div>
          <button
            className="add-habit-button"
            type="button"
            aria-label="Add habit"
            disabled={habits.length >= MAX_HABITS}
            title={habits.length >= MAX_HABITS ? "12-habit limit reached" : undefined}
            onClick={() => setEditor("new")}
          >
            <Plus />
            <span>Habit</span>
          </button>
          </>}
        </div>
      </div>

      {section === "data" ? <HabitData habits={habits} logs={logs} /> : habits.length === 0 ? (
        <div className="habits-empty-state">
          <BarChart3 />
          <p>Build a week one small mark at a time.</p>
          <button type="button" onClick={() => setEditor("new")}>
            <Plus />
            Add a habit
          </button>
        </div>
      ) : view === "wheel" ? (
        <HabitWheel habits={habits} logs={logs} days={days} onChange={setLog} onEdit={setEditor} />
      ) : (
        <>
          <HabitProgressChart habits={habits} logs={logs} days={days} />
          <div className={view === "month" ? "habit-grid-scroll is-monthly" : "habit-grid-scroll"}>
            <div
              className="habit-grid"
              role="grid"
              aria-label={`Habits for ${periodLabel}`}
              style={gridStyle}
            >
              <div className="habit-grid-header" role="row">
                <span className="habit-day-heading" role="columnheader">
                  Habit
                </span>
                {days.map((day) => {
                  const dateKey = localDateKey(day);
                  const label = day.toLocaleDateString(undefined, {
                    weekday: "long", month: "long", day: "numeric", year: "numeric",
                  });
                  return (
                    <div
                      className={dateKey === todayKey ? "habit-day-label is-today" : "habit-day-label"}
                      role="columnheader"
                      key={dateKey}
                      aria-label={label}
                    >
                      <time dateTime={dateKey}>
                        <span>{day.toLocaleDateString(undefined, { weekday: "long" }).slice(0, 1)}</span>
                        <strong>{day.getDate()}</strong>
                      </time>
                    </div>
                  );
                })}
              </div>

              {habits.map((habit) => (
                <SortableHabit habit={habit} key={habit.id}>{(handle) => <>
                  <div className="habit-row-heading" role="rowheader">
                    {handle}
                    <button
                      type="button"
                      className="habit-edit-button"
                      aria-label={`Edit ${habit.name}`}
                      onClick={() => setEditor(habit)}
                    >
                      {habit.icon ? (
                        <HabitIcon name={habit.icon} />
                      ) : (
                        <span className="habit-initial">{habit.name.slice(0, 1).toUpperCase()}</span>
                      )}
                      <span>{habit.name}</span>
                    </button>
                  </div>
                  {days.map((day) => {
                    const dateKey = localDateKey(day);
                    return (
                      <HabitLogCell
                        key={dateKey}
                        habit={habit}
                        dateKey={dateKey}
                        isToday={dateKey === todayKey}
                        isFuture={dateKey > todayKey}
                        value={logs[dateKey]?.[habit.id]}
                        onChange={(value) => setLog(dateKey, habit.id, value)}
                      />
                    );
                  })}
                </>}</SortableHabit>
              ))}
            </div>
          </div>
        </>
      )}

      {editor !== null && (
        <HabitDialog
          habit={editor === "new" ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </section>
    </SortableContext>
    <DragOverlay dropAnimation={null}>
      {draggedHabit && <div className="habit-drag-preview" style={{ color: habitColor(draggedHabit) }}>
        {draggedHabit.icon && <HabitIcon name={draggedHabit.icon} />}
        <span>{draggedHabit.name}</span>
      </div>}
    </DragOverlay>
    </DndContext>
  );
}

type HabitLogCellProps = {
  habit: Habit;
  dateKey: string;
  value: HabitLogValue | undefined;
  isToday: boolean;
  isFuture: boolean;
  onChange: (value: HabitLogValue) => void;
};

function HabitLogCell({ habit, dateKey, value, isToday, isFuture, onChange }: HabitLogCellProps) {
  const label = `${habit.name} on ${dateKey}`;
  const className = isToday ? "habit-log-cell is-today" : "habit-log-cell";

  if (isFuture) {
    return <div className={className} role="gridcell" aria-disabled="true"
      aria-label={`${label}: future day`} />;
  }

  if (dateKey < HABIT_TRACKING_START) {
    return <div className={`${className} habit-log-unavailable`} role="gridcell"
      aria-label={`${label}: tracking starts January 4, 2026`}>—</div>;
  }

  if (habit.logType === "checkbox") {
    const checked = value === true;
    return (
      <div className={className} role="gridcell">
        <button
          className={checked ? "habit-check is-complete" : "habit-check"}
          type="button"
          role="checkbox"
          aria-label={label}
          aria-checked={checked}
          data-ui-sound={checked ? "close" : "open"}
          onClick={() => onChange(!checked)}
        >
          {checked && <Check />}
        </button>
      </div>
    );
  }

  if (habit.logType === "level") {
    const level = typeof value === "number" ? Math.min(4, Math.max(0, value)) : 0;
    return (
      <div className={className} role="gridcell">
        <button
          className="habit-level"
          type="button"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={level}
          title={`${level} of 4`}
          onClick={() => onChange((level + 1) % 5)}
        >
          <svg className="habit-level-fill" viewBox="0 0 20 20" aria-hidden="true">
            <circle className="habit-level-track" cx="10" cy="10" r="9" />
            {level === 4 ? <circle className="habit-level-value" cx="10" cy="10" r="9" />
              : level > 0 && <path className="habit-level-value"
                d={`M 10 10 L 10 1 A 9 9 0 ${level > 2 ? 1 : 0} 1 ${
                  10 + 9 * Math.sin(level * Math.PI / 2)
                } ${10 - 9 * Math.cos(level * Math.PI / 2)} Z`} />}
          </svg>
        </button>
      </div>
    );
  }

  if (habit.logType === "number") {
    return (
      <div className={className} role="gridcell">
        <input
          className="habit-number-input"
          type="number"
          min={0}
          inputMode="decimal"
          aria-label={label}
          placeholder="—"
          title={typeof value === "number" ? String(value) : undefined}
          value={typeof value === "number" && value !== 0 ? value : ""}
          onChange={(event) => onChange(Math.max(0, Number(event.currentTarget.value)))}
        />
      </div>
    );
  }

  return (
    <div className={className} role="gridcell">
      <input
        className="habit-text-input"
        type="text"
        aria-label={label}
        placeholder="…"
        title={typeof value === "string" ? value : undefined}
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  );
}

type HabitDialogProps = {
  habit?: Habit;
  onClose: () => void;
};

function HabitDialog({ habit, onClose }: HabitDialogProps) {
  const addHabit = useHabitStore((state) => state.addHabit);
  const updateHabit = useHabitStore((state) => state.updateHabit);
  const deleteHabit = useHabitStore((state) => state.deleteHabit);
  const habits = useHabitStore((state) => state.habits);
  const [name, setName] = useState(habit?.name ?? "");
  const [logType, setLogType] = useState<HabitLogType>(habit?.logType ?? "checkbox");
  const [icon, setIcon] = useState<HabitIconName | null>(habit ? habit.icon : "target");
  const [color, setColor] = useState<HabitColorName>(habit ? habitColorName(habit)
    : HABIT_COLORS.find((option) => !habits.some((existing) => habitColorName(existing) === option.name))?.name ?? "blue");
  const atLimit = !habit && habits.length >= MAX_HABITS;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || atLimit) return;
    if (habit) updateHabit(habit.id, { name, icon, logType, color });
    else if (addHabit({ name, icon, logType, color }) === null) return;
    onClose();
  }

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="habit-dialog-overlay" />
        <DialogPrimitive.Popup className="habit-dialog-panel">
          <form onSubmit={submit}>
            <div className="habit-dialog-header">
              <DialogPrimitive.Title>{habit ? "Edit habit" : "New habit"}</DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="habit-dialog-close"
                type="button"
                aria-label="Close habit editor"
              >
                <X />
              </DialogPrimitive.Close>
            </div>

            <label className="habit-name-field">
              <span>Name</span>
              <input
                autoFocus
                value={name}
                placeholder="Read, stretch, journal…"
                onChange={(event) => setName(event.currentTarget.value)}
              />
            </label>

            <fieldset className="habit-type-picker">
              <legend>Log with</legend>
              <div>
                {LOG_TYPES.map(({ type, label, description, Icon }) => (
                  <button
                    key={type}
                    className={logType === type ? "is-selected" : undefined}
                    type="button"
                    aria-label={`${label}: ${description}`}
                    aria-pressed={logType === type}
                    title={description}
                    onClick={() => setLogType(type)}
                  >
                    <Icon />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="habit-color-picker">
              <legend>Color</legend>
              <div>
                {HABIT_COLORS.map((option) => (
                  <button type="button" key={option.name} aria-label={`${option.label} color`}
                    aria-pressed={color === option.name} title={option.label}
                    style={{ "--habit-color": option.value } as CSSProperties}
                    onClick={() => setColor(option.name)}>
                    {color === option.name && <Check />}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="habit-icon-picker">
              <legend>Icon</legend>
              <div>
                <button
                  className={icon === null ? "is-selected" : undefined}
                  type="button"
                  aria-label="No icon"
                  aria-pressed={icon === null}
                  title="No icon"
                  onClick={() => setIcon(null)}
                >
                  <Type />
                </button>
                {HABIT_ICONS.map(({ name: iconName, label, Icon }) => (
                  <button
                    key={iconName}
                    className={icon === iconName ? "is-selected" : undefined}
                    type="button"
                    aria-label={label}
                    aria-pressed={icon === iconName}
                    title={label}
                    onClick={() => setIcon(iconName)}
                  >
                    <Icon />
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="habit-dialog-actions">
              {habit && (
                <AlertDialog>
                  <AlertDialogTrigger className="habit-editor-delete" type="button">
                    Delete habit
                  </AlertDialogTrigger>
                  <AlertDialogPrimitive.Portal>
                    <AlertDialogPrimitive.Backdrop className="dialog-overlay habit-delete-overlay" />
                    <AlertDialogPrimitive.Popup className="dialog-content habit-delete-dialog">
                      <AlertDialogTitle>Delete this habit?</AlertDialogTitle>
                      <AlertDialogDescription>
                        “{habit.name}” and all its logs will be permanently removed.
                        This cannot be undone.
                      </AlertDialogDescription>
                      <AlertDialogActions>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="danger"
                          onClick={() => {
                            deleteHabit(habit.id);
                            onClose();
                          }}
                        >
                          Delete permanently
                        </AlertDialogAction>
                      </AlertDialogActions>
                    </AlertDialogPrimitive.Popup>
                  </AlertDialogPrimitive.Portal>
                </AlertDialog>
              )}
              <DialogPrimitive.Close type="button" data-ui-sound="close">
                Cancel
              </DialogPrimitive.Close>
              <button type="submit" disabled={!name.trim() || atLimit}>
                {habit ? "Save changes" : "Add habit"}
              </button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
