import type { HabitIconName } from "@/features/habits/habit-icons";
import type { HabitColorName } from "@/features/habits/habit-colors";

export type HabitLogType = "checkbox" | "level" | "number" | "text";
export type HabitLogValue = boolean | number | string;

export type Habit = {
  id: string;
  name: string;
  icon: HabitIconName | null;
  logType: HabitLogType;
  createdAt: string;
  color?: HabitColorName;
};

export type HabitLogs = Record<string, Record<string, HabitLogValue>>;
