import { describe, expect, test } from "bun:test";
import { habitInsights } from "@/features/habits/habit-insights";
import type { Habit } from "@/features/habits/habit-types";

const habits: Habit[] = ["Read", "Move", "Water"].map((name, index) => ({ id: name, name, icon: null,
  logType: (["checkbox", "level", "number"] as const)[index]!, createdAt: "2026-10-01T12:00:00Z" }));
const today = new Date(2026, 9, 7, 12);

describe("habit insights", () => {
  test("weights partial levels, distinguishes logged and full days, and excludes today and future logs", () => {
    const result = habitInsights(habits, {
      "2026-10-01": { Read: true, Move: 4, Water: 5 },
      "2026-10-02": { Move: 2, Water: 3 },
      "2026-10-03": { Read: true },
      "2026-10-05": { Move: 4 },
      "2026-10-06": { Read: true, Move: 4, Water: 2 },
      "2026-10-07": { Read: true, Move: 4, Water: 100 },
      "2026-10-08": { Read: true, Move: 4, Water: 100 },
    }, 30, today);
    expect(result.consistency).toBe(53);
    expect(result.days).toHaveLength(6);
    expect(result.loggedDays).toBe(5);
    expect(result.fullDays).toBe(2);
    expect(result.loggedEntries).toBe(10);
    expect(result.rows[1]).toMatchObject({ consistency: 58, logged: 4, currentStreak: 2, bestStreak: 2 });
    expect(result.rows[2]).toMatchObject({ total: 10, consistency: 50, currentStreak: 1, bestStreak: 2 });
    expect(result.previousConsistency).toBeNull();
  });

  test("does not penalize days before a habit exists and includes backfilled history", () => {
    const later = { ...habits[0]!, createdAt: "2026-10-05T12:00:00Z" };
    expect(habitInsights([later], {}, 7, today).rows[0]).toMatchObject({ eligible: 2, consistency: 0 });
    const backfilled = habitInsights([later], { "2026-10-03": { Read: true }, "2026-10-06": { Read: true } }, 7, today);
    expect(backfilled.rows[0]).toMatchObject({ eligible: 4, consistency: 50 });
    expect(backfilled.days[0]!.key).toBe("2026-10-03");
    const shortBaseline = habitInsights([{ ...later, createdAt: "2026-09-29T12:00:00Z" }], {}, 7, today);
    expect(shortBaseline.previousConsistency).toBeNull();
  });

  test("compares equal periods, counts missing logs as missed days, and retains streaks beyond the chosen range", () => {
    const habit = { ...habits[0]!, createdAt: "2026-09-20T12:00:00Z" };
    const logs = Object.fromEntries(Array.from({ length: 14 }, (_, index) => {
      const day = new Date(2026, 8, 23 + index);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      return [key, { Read: true }];
    }));
    const result = habitInsights([habit], logs, 7, today);
    expect(result.consistency).toBe(100);
    expect(result.previousConsistency).toBe(100);
    expect(result.rows[0]).toMatchObject({ currentStreak: 14, bestStreak: 14 });
    delete logs["2026-10-06"];
    expect(habitInsights([habit], logs, 7, today).rows[0]).toMatchObject({ currentStreak: 0, bestStreak: 13 });
  });

  test("handles no habits and a first habit created today without fabricating history", () => {
    expect(habitInsights([], {}, 30, today)).toMatchObject({ days: [], rows: [], consistency: 0 });
    expect(habitInsights([{ ...habits[0]!, createdAt: today.toISOString() }], {}, 30, today).days).toEqual([]);
    const early = habitInsights([{ ...habits[0]!, createdAt: "2025-12-01T12:00:00Z" }], {
      "2026-01-03": { Read: true }, "2026-01-04": { Read: true },
    }, 30, new Date(2026, 0, 5, 12));
    expect(early.days.map(day => day.key)).toEqual(["2026-01-04"]);
    expect(early.consistency).toBe(100);
  });
});
