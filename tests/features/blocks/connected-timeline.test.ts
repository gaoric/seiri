import { describe, expect, test } from "bun:test";
import type { TimeBlock } from "@/features/blocks/block-types";
import {
  connectedTimelineItems,
  connectedTimelineConnections,
  connectedIconHeight,
  connectedTimePosition,
  elapsedFraction,
  minuteOnDate,
  withDayBoundaries,
} from "@/features/blocks/connected-timeline";

describe("connected timeline", () => {
  test("keeps every overlapping block and exact duration on the connected timeline", () => {
    const blocks: TimeBlock[] = [
      { id: "long", category: "event", title: "Work", start: 480, end: 540 },
      { id: "short", category: "todo", title: "Send", start: 490, end: 497 },
      { id: "instant", category: "todo", title: "Check", start: 499, end: 499 },
      { id: "later", category: "habit", title: "Read", start: 535, end: 550 },
    ];
    const items = connectedTimelineItems({ start: 480, end: 600 }, blocks);
    expect(
      items.filter((item) => item.block).map((item) => [item.block!.id, item.start, item.end]),
    ).toEqual(blocks.map((block) => [block.id, block.start, block.end]));
    expect(items.filter((item) => !item.block)).toHaveLength(1);
    expect(items.at(-1)).toMatchObject({ start: 550, end: 600 });
    let previous = 0;
    for (let minute = 480; minute <= 600; minute++) {
      const position = connectedTimePosition(items, minute);
      expect(position).toBeGreaterThanOrEqual(previous);
      previous = position;
    }
  });
  test("compresses large gaps while preserving their actual times", () => {
    const blocks: TimeBlock[] = [
      { id: "morning", category: "event", title: "Breakfast", start: 480, end: 510 },
      { id: "evening", category: "event", title: "Sleep", start: 1380, end: 1410 },
    ];
    const items = connectedTimelineItems({ start: 480, end: 1440 }, blocks);
    expect(items.map(({ start, end, height }) => ({ start, end, height }))).toEqual([
      { start: 480, end: 510, height: 80 },
      { start: 510, end: 1380, height: 72 },
      { start: 1380, end: 1410, height: 80 },
      { start: 1410, end: 1440, height: 72 },
    ]);
    expect(connectedTimePosition(items, 945)).toBe(116);
    expect(connectedTimePosition(items, 400)).toBe(0);
    expect(connectedTimePosition(items, 1500)).toBe(304);
  });

  test("keeps overlapping and instant events visible without creating false free time", () => {
    const blocks: TimeBlock[] = [
      { id: "work", category: "event", title: "Work", start: 480, end: 540 },
      { id: "marker", category: "event", title: "Pause", start: 510, end: 510 },
    ];
    const items = connectedTimelineItems({ start: 480, end: 540 }, blocks);
    expect(items.map(({ start, end }) => [start, end])).toEqual([
      [480, 540],
      [510, 510],
    ]);
    expect(connectedTimePosition(items, 510)).toBe(184);
    expect(connectedTimePosition(items, 525)).toBe(184);
    expect(elapsedFraction(510, 510, 510)).toBe(1);
    expect(elapsedFraction(509, 510, 510)).toBe(0);
  });

  test("short tasks share circular icons and greeting markers bracket the plan", () => {
    const blocks: TimeBlock[] = [
      { id: "short", category: "todo", title: "Write", start: 480, end: 495 },
    ];
    const plan = withDayBoundaries({ start: 480, end: 1440 }, blocks);
    expect(plan[0]).toMatchObject({ title: "Good Morning", start: 480, end: 480 });
    expect(plan.at(-1)).toMatchObject({ title: "Good Night", start: 1440, end: 1440 });
    const items = connectedTimelineItems({ start: 480, end: 1440 }, plan);
    expect(items.filter((item) => item.block).map(connectedIconHeight)).toEqual([48, 48, 48]);
    const night = { ...plan.at(-1)!, color: "#aabbcc", start: 1380, end: 1380 };
    const updated = withDayBoundaries({ start: 450, end: 1560 }, [night]);
    expect(updated.at(-1)).toMatchObject({ start: 1560, end: 1560, color: "#aabbcc" });
  });

  test("fills partially elapsed blocks and handles overnight dates", () => {
    expect(elapsedFraction(555, 540, 570)).toBe(0.5);
    expect(elapsedFraction(500, 540, 570)).toBe(0);
    expect(elapsedFraction(600, 540, 570)).toBe(1);
    expect(minuteOnDate("2026-10-10", new Date(2026, 9, 11, 0, 30, 30))).toBe(1470.5);
    expect(minuteOnDate("2026-10-11", new Date(2026, 9, 10, 23, 30))).toBe(-30);
    expect(minuteOnDate("2026-11-01", new Date(2026, 10, 2, 0, 30))).toBe(1470);
  });

  test("keeps short gaps compact and connects only adjacent icon edges", () => {
    const blocks: TimeBlock[] = [
      { id: "first", category: "event", title: "First", start: 480, end: 495 },
      { id: "second", category: "habit", title: "Second", start: 510, end: 525 },
      { id: "third", category: "event", title: "Third", start: 525, end: 540 },
    ];
    const items = connectedTimelineItems({ start: 480, end: 540 }, blocks);
    expect(items.map((item) => item.height)).toEqual([64, 8, 64, 64]);
    const connections = connectedTimelineConnections(items);
    expect(connections.map(({ start, end, dotted }) => ({ start, end, dotted }))).toEqual([
      { start: 56, end: 80, dotted: false },
      { start: 128, end: 144, dotted: false },
    ]);
    expect(connectedTimePosition(items, 495)).toBe(56);
    expect(connectedTimePosition(items, 502.5)).toBe(68);
    expect(connectedTimePosition(items, 510)).toBe(80);
    expect(connectedTimePosition(items, 517.5)).toBe(104);
    const gapped = connectedTimelineItems({ start: 480, end: 570 }, [
      blocks[0]!,
      { ...blocks[1]!, start: 555, end: 570 },
    ]);
    expect(connectedTimelineConnections(gapped)[0]!.dotted).toBe(true);
  });
});
