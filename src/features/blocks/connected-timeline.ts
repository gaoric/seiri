import type { TimeBlock, WakingHours } from "./block-types";
import { isInstantBlock } from "./block-utils";

export type ConnectedTimelineItem = {
  key: string;
  block?: TimeBlock;
  start: number;
  end: number;
  top: number;
  height: number;
};

export function withDayBoundaries(hours: WakingHours, blocks: TimeBlock[]): TimeBlock[] {
  const morning: TimeBlock = {
    id: "blocks-good-morning",
    category: "event",
    repeatDaily: true,
    boundary: "morning",
    title: "Good Morning",
    icon: "sun",
    ...blocks.find((block) => block.boundary === "morning"),
    start: hours.start,
    end: hours.start,
  };
  const night: TimeBlock = {
    id: "blocks-good-night",
    category: "event",
    repeatDaily: true,
    boundary: "night",
    title: "Good Night",
    icon: "moon",
    ...blocks.find((block) => block.boundary === "night"),
    start: hours.end,
    end: hours.end,
  };
  return [morning, ...blocks.filter((block) => !block.boundary), night].sort(
    (a, b) => a.start - b.start,
  );
}

export function connectedIconHeight(item: ConnectedTimelineItem) {
  return item.end - item.start <= 15 ? 48 : item.height - 16;
}

export function connectedTimelineConnections(items: ConnectedTimelineItem[]) {
  const scheduled = items.filter((item) => item.block);
  return scheduled.slice(1).map((to, index) => {
    const from = scheduled[index]!;
    const start = from.top + 8 + connectedIconHeight(from);
    const end = to.top + 8;
    return { from, to, start, end, dotted: to.start - from.end > 15 };
  });
}

export function connectedTimelineItems(hours: WakingHours, blocks: TimeBlock[]) {
  const items: ConnectedTimelineItem[] = [];
  let top = 0;
  let occupiedUntil = hours.start;
  function addItem(start: number, end: number, height: number, block?: TimeBlock) {
    items.push({
      key: `${block?.id ?? "gap"}-${start}-${items.length}`,
      block,
      start,
      end,
      top,
      height,
    });
    top += height;
  }
  for (const block of [...blocks].sort((a, b) => a.start - b.start)) {
    if (block.start > occupiedUntil) {
      addItem(occupiedUntil, block.start, block.start - occupiedUntil > 15 ? 72 : 8);
    }
    const duration = block.end - block.start;
    const minimumHeight = block.category === "todo" ? 104 : duration <= 15 ? 64 : 80;
    const height = isInstantBlock(block)
      ? 64
      : Math.max(minimumHeight, Math.min(200, duration * 2));
    addItem(block.start, block.end, height, block);
    occupiedUntil = Math.max(occupiedUntil, block.end);
  }
  if (occupiedUntil < hours.end) {
    addItem(occupiedUntil, hours.end, hours.end - occupiedUntil > 15 ? 72 : 8);
  }
  return items;
}

export function elapsedFraction(minute: number, start: number, end: number) {
  if (end === start) return minute >= start ? 1 : 0;
  return Math.max(0, Math.min(1, (minute - start) / (end - start)));
}

export function connectedTimePosition(items: ConnectedTimelineItem[], minute: number) {
  if (!items.length) return 0;
  if (minute < items[0]!.start) return items[0]!.top;
  // Follow the latest starting item so overlaps never move the clock backwards.
  let index = 0;
  for (let next = 1; next < items.length && items[next]!.start <= minute; next++) index = next;
  const item = items[index]!;
  if (minute < item.end) {
    const previous = items[index - 1];
    const next = items[index + 1];
    const start = item.block
      ? item.top + 8
      : previous?.block
        ? previous.top + 8 + connectedIconHeight(previous)
        : item.top;
    const end = item.block
      ? start + connectedIconHeight(item)
      : next?.block
        ? next.top + 8
        : item.top + item.height;
    return start + elapsedFraction(minute, item.start, item.end) * (end - start);
  }
  return item.top + item.height;
}

// Calendar-day arithmetic keeps overnight plans correct across daylight-saving changes.
export function minuteOnDate(date: string, now: Date) {
  const [year, month, day] = date.split("-").map(Number);
  const selectedDay = Date.UTC(year!, month! - 1, day!);
  const currentDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const days = (currentDay - selectedDay) / 86_400_000;
  return days * 1440 + now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}
