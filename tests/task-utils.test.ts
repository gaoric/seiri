import { describe, expect, test } from "bun:test";
import {
  daysUntil,
  formatEstimate,
  isArchivedStatus,
  moveItem,
  normalizeEstimateAmount,
  relativeDueLabel,
  sortTaskIds,
} from "@/lib/task-utils";
import type { Task } from "@/types";

const timestamp = "2026-01-01T00:00:00.000Z";
const sortableTasks: Record<string, Task> = {
  a: {
    id: "a",
    priority: 2,
    title: "Zebra",
    status: "on-hold",
    estimate: { amount: 30, unit: "minutes" },
    dueOn: "2026-02-01",
    description: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  b: {
    id: "b",
    priority: 0,
    title: "Alpha",
    status: "in-progress",
    estimate: { amount: 2, unit: "hours" },
    dueOn: "2026-01-01",
    description: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  c: {
    id: "c",
    priority: 1,
    title: "",
    status: "not-started",
    estimate: null,
    dueOn: null,
    description: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  },
};

describe("estimate normalization", () => {
  test("rounds decimals and clamps every unit", () => {
    expect(normalizeEstimateAmount("4.6", "hours")).toBe(5);
    expect(normalizeEstimateAmount(0, "minutes")).toBe(1);
    expect(normalizeEstimateAmount(72, "minutes")).toBe(60);
    expect(normalizeEstimateAmount(100, "days")).toBe(7);
    expect(normalizeEstimateAmount(-3, "weeks")).toBe(1);
    expect(normalizeEstimateAmount(99, "months")).toBe(60);
  });

  test("uses the minimum for non-numeric input", () => {
    expect(normalizeEstimateAmount("", "hours")).toBe(1);
    expect(normalizeEstimateAmount("nope", "days")).toBe(1);
  });

  test("uses singular units for an amount of one", () => {
    expect(formatEstimate({ amount: 1, unit: "minutes" })).toBe("1 minute");
    expect(formatEstimate({ amount: 2, unit: "minutes" })).toBe("2 minutes");
  });
});

describe("task utilities", () => {
  test("derives archive state from done and kill", () => {
    expect(isArchivedStatus("done")).toBeTrue();
    expect(isArchivedStatus("kill")).toBeTrue();
    expect(isArchivedStatus("on-hold")).toBeFalse();
  });

  test("calculates calendar days without elapsed-hour drift", () => {
    const today = new Date(2026, 2, 7, 23, 55);
    expect(daysUntil("2026-03-08", today)).toBe(1);
    expect(daysUntil("2026-03-06", today)).toBe(-1);
    expect(relativeDueLabel("2026-03-08", today)).toBe("1 day");
    expect(relativeDueLabel("2026-03-07", today)).toBe("today");
  });

  test("moves items without mutating the source", () => {
    const source = ["a", "b", "c"];
    expect(moveItem(source, 0, 2)).toEqual(["b", "c", "a"]);
    expect(source).toEqual(["a", "b", "c"]);
  });

  test("sorts every displayed property and leaves blanks last", () => {
    const ids = ["a", "b", "c"];
    expect(sortTaskIds(ids, sortableTasks, "priority", "asc")).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(sortTaskIds(ids, sortableTasks, "title", "asc")).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(sortTaskIds(ids, sortableTasks, "status", "asc")).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(sortTaskIds(ids, sortableTasks, "estimate", "asc")).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(sortTaskIds(ids, sortableTasks, "due", "desc")).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
