import type { Habit, HabitLogs } from "@/features/habits/habit-types";
import { HABIT_TRACKING_START, isHabitLogComplete, localDateKey } from "@/features/habits/habit-utils";

function logCredit(habit: Habit, logs: HabitLogs, key: string) {
  const value = logs[key]?.[habit.id];
  return habit.logType === "level"
    ? typeof value === "number" ? Math.min(4, Math.max(0, value)) / 4 : 0
    : isHabitLogComplete(habit.logType, value) ? 1 : 0;
}

function dateFromKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

function dateRange(first: Date, last: Date) {
  const days: Date[] = [];
  for (const day = new Date(first); day <= last; day.setDate(day.getDate() + 1)) {
    days.push(new Date(day));
  }
  return days;
}

export function habitInsights(habits: Habit[], logs: HabitLogs, range: number, today: Date) {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const endKey = localDateKey(end);
  const start = new Date(end);
  start.setDate(start.getDate() - range + 1);
  const logKeys = Object.keys(logs).filter(key => key >= HABIT_TRACKING_START && key <= endKey).sort();
  const starts = new Map(habits.map(habit => {
    const created = localDateKey(new Date(habit.createdAt));
    const firstLog = logKeys.find(key => logCredit(habit, logs, key) > 0);
    const first = firstLog && firstLog < created ? firstLog : created;
    return [habit.id, first < HABIT_TRACKING_START ? HABIT_TRACKING_START : first];
  }));
  const firstKey = [...starts.values()].sort()[0];
  const history = firstKey ? dateRange(dateFromKey(firstKey), end) : [];
  const allDays = history.map(date => {
    const key = localDateKey(date);
    const eligible = habits.filter(habit => starts.get(habit.id)! <= key);
    const credits = eligible.map(habit => logCredit(habit, logs, key));
    const credit = credits.reduce((total, value) => total + value, 0);
    return { date, key, eligible: eligible.length, credit,
      progress: eligible.length ? Math.round(credit / eligible.length * 100) : 0,
      logged: credits.filter(value => value > 0).length,
      full: eligible.length > 0 && credits.every(value => value === 1) };
  });
  const days = allDays.filter(day => day.date >= start);
  const possible = days.reduce((total, day) => total + day.eligible, 0);
  const earned = days.reduce((total, day) => total + day.credit, 0);
  const previousStart = new Date(start);
  previousStart.setDate(start.getDate() - range);
  const previousDays = allDays.filter(day => day.date >= previousStart && day.date < start);
  const previousPossible = previousDays.reduce((total, day) => total + day.eligible, 0);
  const previousEarned = previousDays.reduce((total, day) => total + day.credit, 0);
  const rows = habits.map(habit => {
    const eligibleDays = days.filter(day => day.key >= starts.get(habit.id)!);
    const credit = eligibleDays.reduce((total, day) => total + logCredit(habit, logs, day.key), 0);
    let currentStreak = 0, bestStreak = 0, streak = 0;
    for (const day of allDays.filter(day => day.key >= starts.get(habit.id)!)) {
      streak = logCredit(habit, logs, day.key) === 1 ? streak + 1 : 0;
      bestStreak = Math.max(bestStreak, streak);
      currentStreak = streak;
    }
    return { habit, eligible: eligibleDays.length,
      consistency: eligibleDays.length ? Math.round(credit / eligibleDays.length * 100) : 0,
      logged: eligibleDays.filter(day => logCredit(habit, logs, day.key) > 0).length,
      currentStreak, bestStreak,
      total: eligibleDays.reduce((total, day) => {
        const value = logs[day.key]?.[habit.id];
        return total + (typeof value === "number" ? value : 0);
      }, 0) };
  });
  return { days, rows, end,
    consistency: possible ? Math.round(earned / possible * 100) : 0,
    previousConsistency: previousDays.length === range && previousPossible
      ? Math.round(previousEarned / previousPossible * 100) : null,
    loggedDays: days.filter(day => day.logged > 0).length,
    fullDays: days.filter(day => day.full).length,
    loggedEntries: rows.reduce((total, row) => total + row.logged, 0),
    possible, earned };
}
