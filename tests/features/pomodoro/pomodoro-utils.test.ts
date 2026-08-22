import { describe, expect, test } from "bun:test";
import {
  createPomodoroSessions,
  DEFAULT_POMODORO_SETTINGS,
  formatPomodoroTime,
  nextSessionIndex,
  POMODORO_SESSIONS,
} from "@/features/pomodoro/pomodoro-utils";

describe("pomodoro schedule", () => {
  test("runs four focus sessions with short breaks before a long break", () => {
    expect(
      POMODORO_SESSIONS.map(({ kind, durationSeconds }) => [
        kind,
        durationSeconds / 60,
      ]),
    ).toEqual([
      ["focus", 25],
      ["short-break", 5],
      ["focus", 25],
      ["short-break", 5],
      ["focus", 25],
      ["short-break", 5],
      ["focus", 25],
      ["long-break", 15],
    ]);
    expect(nextSessionIndex(7)).toBe(0);
  });

  test("formats the digital timer", () => {
    expect(formatPomodoroTime(25 * 60)).toBe("25:00");
    expect(formatPomodoroTime(5 * 60 + 3)).toBe("05:03");
  });

  test("builds a schedule from custom durations and rounds", () => {
    const sessions = createPomodoroSessions({
      ...DEFAULT_POMODORO_SETTINGS,
      focusMinutes: 40,
      shortBreakMinutes: 10,
      longBreakMinutes: 30,
      rounds: 2,
    });

    expect(sessions.map(({ kind, durationSeconds }) => [
      kind,
      durationSeconds / 60,
    ])).toEqual([
      ["focus", 40],
      ["short-break", 10],
      ["focus", 40],
      ["long-break", 30],
    ]);
    expect(nextSessionIndex(3, sessions.length)).toBe(0);
  });
});
