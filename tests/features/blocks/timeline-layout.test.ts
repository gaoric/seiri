import { describe, expect, test } from "bun:test";
import {
  plannedDuration,
  timelineLanes,
  timelineRows,
  timelineSegments,
} from "@/features/blocks/block-utils";
import type { TimeBlock } from "@/features/blocks/block-types";

const hours = { start: 480, end: 540 };
const marker: TimeBlock = {
  id: "wake",
  category: "event",
  title: "Wake up",
  start: 480,
  end: 480,
};

describe("marker timeline layout", () => {
  test("lays out exact minute spans in separate lanes and counts occupied time once", () => {
    const blocks: TimeBlock[] = [
      { ...marker, id: "long", start: 487, end: 527 },
      { ...marker, id: "short", category: "todo", start: 493, end: 500 },
      { ...marker, id: "later", category: "habit", start: 503, end: 512 },
      { ...marker, id: "instant", category: "todo", start: 491, end: 491 },
    ];
    const rows = timelineRows(hours, blocks);
    for (const block of blocks) {
      const segments = timelineSegments(block, rows);
      expect(segments.length).toBeGreaterThan(0);
      expect(segments.reduce((total, segment) => total + segment.end - segment.start, 0)).toBe(
        block.end - block.start,
      );
    }
    const lanes = timelineLanes(blocks);
    expect(lanes.get("long")).toEqual({ column: 0, columns: 2 });
    expect(lanes.get("short")).toEqual({ column: 1, columns: 2 });
    expect(lanes.get("later")).toEqual({ column: 1, columns: 2 });
    expect(plannedDuration(blocks)).toBe(40);
  });
  test("zero-minute habits stay visible without consuming a routine's time", () => {
    const habit: TimeBlock = { ...marker, id: "read", category: "habit", start: 495, end: 495 };
    const routine: TimeBlock = {
      id: "work",
      category: "event",
      title: "Work",
      start: 480,
      end: 540,
    };
    const rows = timelineRows(hours, [routine, habit]);
    expect(timelineSegments(habit, rows)).toEqual([{ start: 495, end: 495, row: 1, rowCount: 1 }]);
    expect(
      timelineSegments(routine, rows).reduce(
        (total, segment) => total + segment.end - segment.start,
        0,
      ),
    ).toBe(60);
  });
  test("inserts a visual row without advancing the clock or shortening a scheduled block", () => {
    const rows = timelineRows(hours, [marker]);
    expect(rows.map((row) => row.minute)).toEqual([480, 480, 495, 510, 525]);
    expect(timelineSegments(marker, rows)).toEqual([{ start: 480, end: 480, row: 0, rowCount: 1 }]);
    const routine: TimeBlock = {
      id: "breakfast",
      category: "event",
      title: "Breakfast",
      start: 480,
      end: 510,
    };
    expect(timelineSegments(routine, rows)).toEqual([
      { start: 480, end: 510, row: 1, rowCount: 2 },
    ]);
  });

  test("splits a spanning block around markers while preserving every minute", () => {
    const middle = { ...marker, start: 495, end: 495 };
    const routine: TimeBlock = {
      id: "work",
      category: "event",
      title: "Work",
      start: 480,
      end: 540,
    };
    const segments = timelineSegments(routine, timelineRows(hours, [middle]));
    expect(segments).toEqual([
      { start: 480, end: 495, row: 0, rowCount: 1 },
      { start: 495, end: 540, row: 2, rowCount: 3 },
    ]);
    expect(segments.reduce((total, part) => total + part.end - part.start, 0)).toBe(60);
  });

  test("keeps multiple markers and markers at the sleep boundary in their own rows", () => {
    const second = { ...marker, id: "start" };
    const sleep = { ...marker, id: "sleep", start: 540, end: 540 };
    const rows = timelineRows(hours, [marker, second, sleep]);
    expect(rows.map((row) => row.minute)).toEqual([480, 480, 480, 495, 510, 525, 540]);
    expect(timelineSegments(second, rows)[0]?.row).toBe(1);
    expect(timelineSegments(sleep, rows)).toEqual([{ start: 540, end: 540, row: 6, rowCount: 1 }]);
  });
});
