import type { Habit } from "@/features/habits/habit-types";

export const MAX_HABITS = 12;

export const HABIT_COLORS = [
  { name: "blue", label: "Blue", value: "#8bbcff" },
  { name: "teal", label: "Teal", value: "#6ad4cf" },
  { name: "mint", label: "Mint", value: "#88d8ab" },
  { name: "lime", label: "Lime", value: "#bfd781" },
  { name: "gold", label: "Gold", value: "#e6c575" },
  { name: "peach", label: "Peach", value: "#eeab80" },
  { name: "coral", label: "Coral", value: "#e98d91" },
  { name: "rose", label: "Rose", value: "#de9dbf" },
  { name: "lavender", label: "Lavender", value: "#b7a3e8" },
  { name: "violet", label: "Violet", value: "#a59cf3" },
  { name: "sky", label: "Sky", value: "#91cedf" },
  { name: "stone", label: "Stone", value: "#b8b9bd" },
] as const;

export type HabitColorName = (typeof HABIT_COLORS)[number]["name"];

export function habitColorName(habit: Habit): HabitColorName {
  if (habit.color && HABIT_COLORS.some((color) => color.name === habit.color)) return habit.color;
  // Give older saved habits a stable palette color without changing their logs.
  const hash = Array.from(habit.id).reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
  return HABIT_COLORS[hash % HABIT_COLORS.length]!.name;
}

export function habitColor(habit: Habit) {
  return HABIT_COLORS.find((color) => color.name === habitColorName(habit))!.value;
}
