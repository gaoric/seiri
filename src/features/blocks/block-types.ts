import type { HabitIconName } from "@/features/habits/habit-icons";

export type BlockCategory = "event" | "todo" | "habit";

export type WakingHours = { start: number; end: number };

// Minutes are measured from midnight on the selected day; overnight times exceed 1440.
export type TimeBlock = {
  id: string;
  category: BlockCategory;
  title: string;
  sourceId?: string;
  icon?: HabitIconName;
  color?: string;
  repeatDaily?: boolean;
  boundary?: "morning" | "night";
  start: number;
  end: number;
};

export type BlockDraft = {
  category: BlockCategory;
  start: number;
  end: number;
  block?: TimeBlock;
  sourceId?: string;
  sourceOnly?: boolean;
};

export type BlockDragItem = {
  category: BlockCategory;
  sourceId?: string;
  block?: TimeBlock;
  title: string;
  duration: number;
};

export type DayPlan = {
  blocks: TimeBlock[];
  omittedEventIds: string[];
};

export type BlockData = {
  wakingHours: WakingHours | null;
  repeatingEvents: TimeBlock[];
  days: Record<string, DayPlan>;
};
