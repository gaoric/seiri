import type {
  Habit,
  HabitLogType,
  HabitLogValue,
  HabitLogs,
} from "@/features/habits/habit-types";

export const HABIT_TRACKING_START = "2026-01-04";

export function habitPeriodStarts(period: "week" | "month", today: Date) {
  const first = new Date(2026, 0, period === "week" ? 4 : 1);
  const latest = period === "week" ? startOfHabitWeek(today)
    : new Date(today.getFullYear(), today.getMonth(), 1);
  const starts: Date[] = [];
  for (let date = first; date <= latest; date = period === "week" ? moveWeek(date, 1) : moveMonth(date, 1)) {
    starts.push(date);
  }
  return starts.reverse();
}

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function startOfHabitWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - start.getDay());
  return start;
}

export function habitWeekDays(anchor: Date) {
  const start = startOfHabitWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function moveWeek(anchor: Date, direction: -1 | 1) {
  const next = new Date(anchor);
  next.setDate(next.getDate() + direction * 7);
  return next;
}

export function habitMonthDays(anchor: Date) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const count = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: count }, (_, index) => new Date(year, month, index + 1));
}

export function moveMonth(anchor: Date, direction: -1 | 1) {
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

export function formatWeekRange(days: Date[]) {
  const first = days[0];
  const last = days[days.length - 1];
  const firstLabel = first.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const lastLabel = last.toLocaleDateString(undefined, {
    month: first.getMonth() === last.getMonth() ? undefined : "short",
    day: "numeric",
    year: first.getFullYear() === last.getFullYear() ? undefined : "numeric",
  });
  return `${firstLabel}–${lastLabel}`;
}

export function isHabitLogComplete(
  type: HabitLogType,
  value: HabitLogValue | undefined,
) {
  if (type === "checkbox") return value === true;
  if (type === "level" || type === "number") {
    return typeof value === "number" && value > 0;
  }
  return typeof value === "string" && value.trim().length > 0;
}

export function habitDayProgress(
  habits: Habit[],
  logs: HabitLogs,
  dateKey: string,
) {
  if (habits.length === 0) return 0;
  const dayLogs = logs[dateKey] ?? {};
  const completed = habits.reduce((total, habit) => {
    const value = dayLogs[habit.id];
    if (habit.logType === "level") {
      return total + (typeof value === "number" ? Math.min(4, Math.max(0, value)) / 4 : 0);
    }
    return total + (isHabitLogComplete(habit.logType, value) ? 1 : 0);
  }, 0);
  return Math.round((completed / habits.length) * 100);
}
