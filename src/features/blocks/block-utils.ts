import type { BlockData, TimeBlock, WakingHours } from "./block-types";
import type { Task } from "@/features/todo/todo-types";
import type { Habit } from "@/features/habits/habit-types";
import { habitColor } from "@/features/habits/habit-colors";

export const SLOT_MINUTES = 15;
export const SLOT_HEIGHT = 40;
export const DEFAULT_BLOCK_COLOR = "#8bbcff";

export function blockColor(block: TimeBlock, habit?: Habit) {
  return block.color ?? (habit ? habitColor(habit) : DEFAULT_BLOCK_COLOR);
}
export const CATEGORY_LABELS = {
  event: "Event",
  todo: "Todo",
  habit: "Habit",
};

export type TimelineRow = { minute: number; end: number; marker?: TimeBlock };
export type TimelineSegment = {
  start: number;
  end: number;
  row: number;
  rowCount: number;
};

export function isInstantBlock(block: TimeBlock) {
  return block.start === block.end;
}

export function timelineRows(hours: WakingHours, blocks: TimeBlock[]): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const markers = blocks.filter(isInstantBlock);
  const minutes = new Set([hours.start, hours.end]);
  for (let minute = hours.start; minute <= hours.end; minute += SLOT_MINUTES) {
    minutes.add(minute);
  }
  for (const block of blocks) {
    minutes.add(block.start);
    minutes.add(block.end);
  }
  const boundaries = [...minutes].sort((a, b) => a - b);
  for (const [index, minute] of boundaries.entries()) {
    for (const marker of markers.filter((block) => block.start === minute)) {
      rows.push({ minute, end: minute, marker });
    }
    const end = boundaries[index + 1];
    if (end !== undefined) rows.push({ minute, end });
  }
  return rows;
}

export function timelineSegments(block: TimeBlock, rows: TimelineRow[]): TimelineSegment[] {
  const segments: TimelineSegment[] = [];
  rows.forEach((row, index) => {
    if (isInstantBlock(block)) {
      if (row.marker?.id === block.id) {
        segments.push({ start: block.start, end: block.end, row: index, rowCount: 1 });
      }
      return;
    }
    if (row.marker || row.minute < block.start || row.minute >= block.end) return;
    const previous = segments.at(-1);
    if (previous && previous.row + previous.rowCount === index) {
      previous.rowCount += 1;
      previous.end = row.end;
    } else {
      segments.push({
        start: row.minute,
        end: row.end,
        row: index,
        rowCount: 1,
      });
    }
  });
  return segments;
}

export function taskDuration(task: Task) {
  if (!task.estimate) return 30;
  const multiplier = task.estimate.unit === "minutes" ? 1 : task.estimate.unit === "hours" ? 60 : 0;
  return multiplier ? Math.max(0, Math.round(task.estimate.amount * multiplier)) : 30;
}

export function habitDuration(habit: Habit) {
  return habit.estimateMinutes ?? 0;
}

export function timeInput(minutes: number) {
  const clock = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;
}

export function parseTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function wakingWindow(start: string, end: string): WakingHours {
  const from = parseTime(start);
  const to = parseTime(end);
  return { start: from, end: to <= from ? to + 1440 : to };
}

export function dayMinute(value: string, hours: WakingHours) {
  const minute = parseTime(value);
  return minute < hours.start ? minute + 1440 : minute;
}

export function formatTime(minutes: number) {
  const clock = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(clock / 60);
  const minute = clock % 60;
  return `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${hour < 12 ? "am" : "pm"}`;
}

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return [hours ? `${hours}h` : "", rest ? `${rest}m` : ""].filter(Boolean).join(" ") || "0m";
}

export function planBlocks(data: BlockData, date: string): TimeBlock[] {
  const day = data.days[date];
  const overrides = new Set(day?.blocks.map((block) => block.id));
  const omitted = new Set(day?.omittedEventIds);
  return [
    ...data.repeatingEvents.filter((block) => !overrides.has(block.id) && !omitted.has(block.id)),
    ...(day?.blocks ?? []),
  ].sort((a, b) => a.start - b.start);
}

export function placementError(block: TimeBlock, hours: WakingHours) {
  if (block.color && !/^#[\da-f]{6}$/i.test(block.color)) return "Choose a valid block color.";
  if (!Number.isFinite(block.start) || !Number.isFinite(block.end) || block.end < block.start) {
    return "Choose an end time at or after the start time.";
  }
  if (block.start < hours.start || block.end > hours.end) {
    return "Keep this block within your waking hours.";
  }
  return null;
}

// Count occupied time once, even when several blocks share it.
export function plannedDuration(blocks: TimeBlock[]) {
  let end = -Infinity;
  let total = 0;
  for (const block of [...blocks].sort((a, b) => a.start - b.start)) {
    total += Math.max(0, block.end - Math.max(end, block.start));
    end = Math.max(end, block.end);
  }
  return total;
}

export type BlockLane = { column: number; columns: number };

export function timelineLanes(blocks: TimeBlock[]) {
  const lanes = new Map<string, BlockLane>();
  const timed = blocks.filter((block) => !isInstantBlock(block)).sort((a, b) => a.start - b.start);
  let group: TimeBlock[] = [];
  let ends: number[] = [];
  function finishGroup() {
    for (const block of group) lanes.get(block.id)!.columns = ends.length;
    group = [];
    ends = [];
  }
  for (const block of timed) {
    if (ends.length && ends.every((end) => end <= block.start)) finishGroup();
    let column = ends.findIndex((end) => end <= block.start);
    if (column < 0) column = ends.length;
    ends[column] = block.end;
    group.push(block);
    lanes.set(block.id, { column, columns: 1 });
  }
  finishGroup();
  return lanes;
}
