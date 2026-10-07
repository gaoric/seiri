import { describe, expect, test } from "bun:test";
import type { Habit, HabitLogs } from "@/features/habits/habit-types";
import {
  habitDayProgress,
  habitMonthDays,
  habitPeriodStarts,
  habitWeekDays,
  isHabitLogComplete,
  localDateKey,
  moveMonth,
} from "@/features/habits/habit-utils";

describe("habit week utilities", () => {
  test("offers periods from the first Sunday of 2026 through the current period", () => {
    const weeks = habitPeriodStarts("week", new Date(2026, 2, 11));
    expect(localDateKey(weeks.at(-1)!)).toBe("2026-01-04");
    expect(localDateKey(weeks[0]!)).toBe("2026-03-08");
    expect(weeks.every((date) => date.getDay() === 0)).toBeTrue();
    const months = habitPeriodStarts("month", new Date(2026, 2, 11));
    expect(months.map(localDateKey)).toEqual(["2026-03-01", "2026-02-01", "2026-01-01"]);
  });
  test("builds a local Sunday through Saturday week", () => {
    const days = habitWeekDays(new Date(2026, 7, 19, 18, 30));

    expect(days).toHaveLength(7);
    expect(localDateKey(days[0])).toBe("2026-08-16");
    expect(localDateKey(days[6])).toBe("2026-08-22");
  });

  test("recognizes completion for every logging mode", () => {
    expect(isHabitLogComplete("checkbox", true)).toBeTrue();
    expect(isHabitLogComplete("checkbox", false)).toBeFalse();
    expect(isHabitLogComplete("level", 1)).toBeTrue();
    expect(isHabitLogComplete("level", 0)).toBeFalse();
    expect(isHabitLogComplete("number", 2.5)).toBeTrue();
    expect(isHabitLogComplete("number", 0)).toBeFalse();
    expect(isHabitLogComplete("text", " reflected ")).toBeTrue();
    expect(isHabitLogComplete("text", "   ")).toBeFalse();
  });

  test("daily completeness weights levels by their four quarter fills", () => {
    const habits: Habit[] = [
      { id: "check", name: "Check", icon: null, logType: "checkbox", createdAt: "" },
      { id: "level", name: "Level", icon: null, logType: "level", createdAt: "" },
    ];
    expect(habitDayProgress(habits, { "2026-10-06": { check: true, level: 2 } }, "2026-10-06")).toBe(75);
    expect(habitDayProgress(habits, { "2026-10-06": { level: 4 } }, "2026-10-06")).toBe(50);
  });

  test("builds calendar months including leap years and moves across year boundaries", () => {
    const leap = habitMonthDays(new Date(2024, 1, 29));
    expect(leap).toHaveLength(29);
    expect(localDateKey(leap[0])).toBe("2024-02-01");
    expect(localDateKey(leap[28])).toBe("2024-02-29");
    expect(habitMonthDays(new Date(2025, 1, 1))).toHaveLength(28);
    expect(habitMonthDays(new Date(2026, 3, 1))).toHaveLength(30);
    expect(habitMonthDays(new Date(2026, 0, 31))).toHaveLength(31);
    expect(localDateKey(moveMonth(new Date(2026, 0, 31), 1))).toBe("2026-02-01");
    expect(localDateKey(moveMonth(new Date(2026, 0, 31), -1))).toBe("2025-12-01");
    expect(localDateKey(moveMonth(new Date(2026, 11, 31), 1))).toBe("2027-01-01");
  });

  test("calculates daily completion as a percentage of habit columns", () => {
    const habits: Habit[] = [
      {
        id: "move",
        name: "Move",
        icon: "activity",
        logType: "checkbox",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "water",
        name: "Water",
        icon: "water",
        logType: "number",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const logs: HabitLogs = {
      "2026-08-22": { move: true, water: 0 },
    };

    expect(habitDayProgress(habits, logs, "2026-08-22")).toBe(50);
    expect(habitDayProgress([], logs, "2026-08-22")).toBe(0);
  });
});
