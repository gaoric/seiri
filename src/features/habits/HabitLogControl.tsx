import { Check } from "lucide-react";
import type { Habit, HabitLogValue } from "./habit-types";

export function HabitLogControl({
  habit,
  label,
  value,
  disabled = false,
  onChange,
}: {
  habit: Habit;
  label: string;
  value: HabitLogValue | undefined;
  disabled?: boolean;
  onChange: (value: HabitLogValue) => void;
}) {
  if (habit.logType === "checkbox") {
    const checked = value === true;
    return (
      <button
        className={checked ? "habit-check is-complete" : "habit-check"}
        type="button"
        role="checkbox"
        aria-label={label}
        aria-checked={checked}
        disabled={disabled}
        data-ui-sound={checked ? "close" : "open"}
        onClick={() => onChange(!checked)}
      >
        {checked && <Check />}
      </button>
    );
  }
  if (habit.logType === "level") {
    const level = typeof value === "number" ? Math.min(4, Math.max(0, value)) : 0;
    return (
      <button
        className="habit-level"
        type="button"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={level}
        disabled={disabled}
        title={`${level} of 4`}
        onClick={() => onChange((level + 1) % 5)}
      >
        <svg className="habit-level-fill" viewBox="0 0 20 20" aria-hidden="true">
          <circle className="habit-level-track" cx="10" cy="10" r="9" />
          {level === 4 ? (
            <circle className="habit-level-value" cx="10" cy="10" r="9" />
          ) : (
            level > 0 && (
              <path
                className="habit-level-value"
                d={`M 10 10 L 10 1 A 9 9 0 ${level > 2 ? 1 : 0} 1 ${
                  10 + 9 * Math.sin((level * Math.PI) / 2)
                } ${10 - 9 * Math.cos((level * Math.PI) / 2)} Z`}
              />
            )
          )}
        </svg>
      </button>
    );
  }
  const numeric = habit.logType === "number";
  return (
    <input
      className={numeric ? "habit-number-input" : "habit-text-input"}
      type={numeric ? "number" : "text"}
      min={numeric ? 0 : undefined}
      inputMode={numeric ? "decimal" : undefined}
      aria-label={label}
      disabled={disabled}
      placeholder={numeric ? "—" : "…"}
      title={value === undefined ? undefined : String(value)}
      value={
        numeric
          ? typeof value === "number" && value !== 0
            ? value
            : ""
          : typeof value === "string"
            ? value
            : ""
      }
      onChange={(event) =>
        onChange(
          numeric ? Math.max(0, Number(event.currentTarget.value)) : event.currentTarget.value,
        )
      }
    />
  );
}
