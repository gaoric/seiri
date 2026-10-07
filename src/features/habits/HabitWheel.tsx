import { Dialog } from "@base-ui/react/dialog";
import { useId, useState, type FormEvent } from "react";
import { habitColor } from "@/features/habits/habit-colors";
import type { Habit, HabitLogs, HabitLogValue } from "@/features/habits/habit-types";
import { HABIT_TRACKING_START, isHabitLogComplete, localDateKey } from "@/features/habits/habit-utils";
import { requestUiSound } from "@/shared/sound/use-ui-sounds";
import { SortableHabit } from "@/features/habits/SortableHabit";

const CENTER = { x: 430, y: 350 };
const OUTER = 270;
const INNER = 92;
const SWEEP = 270;

function point(radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return { x: CENTER.x + radius * Math.cos(radians), y: CENTER.y + radius * Math.sin(radians) };
}

function sector(inner: number, outer: number, start: number, end: number) {
  const a = point(outer, start);
  const b = point(outer, end);
  const c = point(inner, end);
  const d = point(inner, start);
  return `M ${a.x} ${a.y} A ${outer} ${outer} 0 0 1 ${b.x} ${b.y} L ${c.x} ${c.y} A ${inner} ${inner} 0 0 0 ${d.x} ${d.y} Z`;
}

type WheelEntry = { habit: Habit; dateKey: string; value: HabitLogValue | undefined };

function entryDescription({ habit, value }: WheelEntry) {
  if (value === undefined || value === false || value === "") return "Not logged";
  if (habit.logType === "level") return `${value} / 4`;
  if (habit.logType === "checkbox") return "Complete";
  return String(value);
}

export function HabitWheel({ habits, logs, days, onChange, onEdit }: {
  habits: Habit[];
  logs: HabitLogs;
  days: Date[];
  onChange: (dateKey: string, habitId: string, value: HabitLogValue) => void;
  onEdit: (habit: Habit) => void;
}) {
  const wheelId = useId();
  const outlineFilterId = `${wheelId}-outline-smoothing`;
  const [hovered, setHovered] = useState<WheelEntry | null>(null);
  const [editing, setEditing] = useState<WheelEntry | null>(null);
  const ringWidth = (OUTER - INNER) / habits.length;
  const step = SWEEP / days.length;
  const todayKey = localDateKey(new Date());
  const todayIndex = days.findIndex((day) => localDateKey(day) === todayKey);

  function activate(entry: WheelEntry) {
    if (entry.dateKey < HABIT_TRACKING_START || entry.dateKey > todayKey) return;
    if (entry.habit.logType === "checkbox") {
      requestUiSound(entry.value === true ? "close" : "open");
      onChange(entry.dateKey, entry.habit.id, entry.value !== true);
    } else if (entry.habit.logType === "level") {
      const level = typeof entry.value === "number" ? Math.min(4, Math.max(0, entry.value)) : 0;
      onChange(entry.dateKey, entry.habit.id, (level + 1) % 5);
    } else {
      setEditing(entry);
    }
    setHovered(null);
  }

  return (
    <div className="habit-wheel-panel">
      <div className="habit-wheel-scroll">
        <svg className="habit-wheel" viewBox="130 35 610 620" aria-label="Monthly habit wheel"
          onMouseDown={(event) => { if (event.detail > 1) event.preventDefault(); }}>
          <defs>
            <filter id={outlineFilterId} x="-20%" y="-20%" width="140%" height="140%"
              colorInterpolationFilters="sRGB">
              {/* Feather only the outlines by a fraction of a pixel; fills and text stay sharp. */}
              <feGaussianBlur stdDeviation="0.18" />
            </filter>
          </defs>
          <text className="habit-wheel-caption" x="155" y="54">DAILY HABITS</text>
          {habits.map((habit, habitIndex) => {
            const outer = OUTER - habitIndex * ringWidth;
            const inner = outer - ringWidth;
            const color = habitColor(habit);
            return (
              <g className="habit-wheel-row" key={habit.id}>
                <foreignObject className="habit-wheel-label-slot" x="155" y={CENTER.y - outer}
                  width={CENTER.x - 160} height={ringWidth}>
                  <SortableHabit habit={habit} wheel>{(handle) => <>
                    {handle}
                    <button type="button" className="habit-wheel-edit" aria-label={`Edit ${habit.name}`}
                      onClick={() => onEdit(habit)}>
                      <span className="habit-wheel-color-dot" />
                      <span>{habit.name}</span>
                    </button>
                  </>}</SortableHabit>
                </foreignObject>
                {days.map((day, dayIndex) => {
                  const dateKey = localDateKey(day);
                  const unavailable = dateKey < HABIT_TRACKING_START || dateKey > todayKey;
                  const value = unavailable ? undefined : logs[dateKey]?.[habit.id];
                  const entry = { habit, dateKey, value };
                  const start = -90 + dayIndex * step + 0.2;
                  const end = start + step - 0.4;
                  const complete = isHabitLogComplete(habit.logType, value);
                  const level = habit.logType === "level" && typeof value === "number" ? Math.min(4, Math.max(0, value)) : 0;
                  const cellPath = sector(inner + 0.6, outer - 0.6, start, end);
                  return (
                    <g className="habit-wheel-cell"
                      key={dateKey} role={habit.logType === "checkbox" ? "checkbox" : "button"}
                      tabIndex={unavailable ? -1 : 0} aria-label={`${habit.name} on ${dateKey}`}
                      aria-disabled={unavailable || undefined}
                      aria-description={entryDescription(entry)}
                      aria-checked={habit.logType === "checkbox" ? complete : undefined}
                      aria-valuenow={habit.logType === "level" ? level : undefined}
                      aria-valuemin={habit.logType === "level" ? 0 : undefined}
                      aria-valuemax={habit.logType === "level" ? 4 : undefined}
                      onClick={() => activate(entry)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(entry); }
                      }}
                      onMouseEnter={() => setHovered(entry)} onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(entry)} onBlur={() => setHovered(null)}>
                      <path className="habit-wheel-space" d={cellPath}
                        fill={habit.logType !== "level" && complete ? color : "#25262a"} />
                      {habit.logType === "level" && level > 0 && (
                        <path className="habit-wheel-level-fill" fill={color}
                          d={level === 4 ? cellPath : sector(
                            outer - 0.6 - (outer - inner - 1.2) * level / 4,
                            outer - 0.6, start, end)} />
                      )}
                      <path className="habit-wheel-cell-outline" aria-hidden="true"
                        filter={`url(#${outlineFilterId})`} d={cellPath} />
                    </g>
                  );
                })}
              </g>
            );
          })}
          {todayIndex >= 0 && (
            <path className="habit-wheel-today-slice" aria-hidden="true"
              filter={`url(#${outlineFilterId})`}
              d={sector(INNER, OUTER, -90 + todayIndex * step, -90 + (todayIndex + 1) * step)} />
          )}
          {days.map((day, index) => {
            const label = point(OUTER + 18, -90 + (index + 0.5) * step);
            return <text key={index} className={localDateKey(day) === todayKey ? "habit-wheel-date is-today" : "habit-wheel-date"}
              x={label.x} y={label.y + 3} textAnchor="middle">{day.getDate()}</text>;
          })}
          <text className="habit-wheel-month" x={CENTER.x} y={CENTER.y - 5} textAnchor="middle">
            {days[0]!.toLocaleDateString(undefined, { month: "long" })}
          </text>
          <text className="habit-wheel-year" x={CENTER.x} y={CENTER.y + 19} textAnchor="middle">
            {days[0]!.getFullYear()}
          </text>
        </svg>
      </div>
      <p className="habit-wheel-hint">Click a cell to log. Click a habit to edit. Drag handles to reorder.</p>
      {hovered && (
        <div className="habit-wheel-tooltip" role="tooltip">
          <span style={{ color: habitColor(hovered.habit) }}>{hovered.habit.name}</span>
          <span>{hovered.dateKey}</span>
          <strong>{entryDescription(hovered)}</strong>
        </div>
      )}
      {editing && (
        <WheelLogDialog entry={editing} onClose={() => setEditing(null)}
          onSave={(value) => onChange(editing.dateKey, editing.habit.id, value)} />
      )}
    </div>
  );
}

function WheelLogDialog({ entry, onClose, onSave }: {
  entry: WheelEntry;
  onClose: () => void;
  onSave: (value: HabitLogValue) => void;
}) {
  const isNumber = entry.habit.logType === "number";
  const [draft, setDraft] = useState(
    typeof entry.value === "number" || typeof entry.value === "string" ? String(entry.value) : "",
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(isNumber ? Math.max(0, Number(draft)) : draft);
    onClose();
  }
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="habit-dialog-overlay" />
        <Dialog.Popup className="habit-dialog-panel habit-wheel-log-dialog">
          <form onSubmit={submit}>
            <div className="habit-dialog-header"><Dialog.Title>{entry.habit.name}</Dialog.Title></div>
            <Dialog.Description className="habit-wheel-log-date">{entry.dateKey}</Dialog.Description>
            <label className="habit-name-field">
              <span>{isNumber ? "Amount" : "Note"}</span>
              <input autoFocus type={isNumber ? "number" : "text"} min={isNumber ? 0 : undefined}
                step={isNumber ? "any" : undefined} value={draft}
                onChange={(event) => setDraft(event.currentTarget.value)} />
            </label>
            <div className="habit-dialog-actions">
              <button className="habit-editor-delete" type="button" onClick={() => {
                onSave(isNumber ? 0 : ""); onClose();
              }}>Clear entry</button>
              <Dialog.Close type="button">Cancel</Dialog.Close>
              <button type="submit">Save entry</button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
