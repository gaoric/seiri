import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MAX_HABITS } from "@/features/habits/habit-colors";
import { HABIT_TRACKING_START } from "@/features/habits/habit-utils";
import type {
  Habit,
  HabitLogValue,
  HabitLogs,
} from "@/features/habits/habit-types";

type PersistedHabitState = {
  habits: Habit[];
  logs: HabitLogs;
};

type HabitState = PersistedHabitState & {
  addHabit: (habit: Pick<Habit, "name" | "icon" | "logType" | "color">) => string | null;
  updateHabit: (habitId: string, changes: Pick<Habit, "name" | "icon" | "logType" | "color">) => void;
  deleteHabit: (habitId: string) => void;
  reorderHabit: (habitId: string, overId: string) => void;
  setLog: (dateKey: string, habitId: string, value: HabitLogValue) => void;
  replaceStateForTests: (state: PersistedHabitState) => void;
};

function newHabitId() {
  return globalThis.crypto?.randomUUID?.() ?? `habit-${Date.now()}`;
}

export const useHabitStore = create<HabitState>()(
  persist(
    (set, get) => ({
      habits: [],
      logs: {},

      addHabit: ({ name, icon, logType, color }) => {
        if (get().habits.length >= MAX_HABITS) return null;
        const id = newHabitId();
        const habit: Habit = {
          id,
          name: name.trim(),
          icon,
          logType,
          color,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ habits: [...state.habits, habit] }));
        return id;
      },

      updateHabit: (habitId, changes) =>
        set((state) => ({
          habits: state.habits.map((habit) => habit.id === habitId
            ? { ...habit, ...changes, name: changes.name.trim() }
            : habit),
        })),

      deleteHabit: (habitId) =>
        set((state) => {
          const logs: HabitLogs = {};
          for (const [dateKey, dayLogs] of Object.entries(state.logs)) {
            const remaining = { ...dayLogs };
            delete remaining[habitId];
            if (Object.keys(remaining).length > 0) logs[dateKey] = remaining;
          }
          return {
            habits: state.habits.filter((habit) => habit.id !== habitId),
            logs,
          };
        }),

      reorderHabit: (habitId, overId) => {
        const habits = [...get().habits];
        const from = habits.findIndex((habit) => habit.id === habitId);
        const to = habits.findIndex((habit) => habit.id === overId);
        if (from < 0 || to < 0 || from === to) return;
        const [moved] = habits.splice(from, 1);
        habits.splice(to, 0, moved!);
        set({ habits });
      },

      setLog: (dateKey, habitId, value) => {
        if (dateKey < HABIT_TRACKING_START) return;
        set((state) => ({
          logs: {
            ...state.logs,
            [dateKey]: {
              ...(state.logs[dateKey] ?? {}),
              [habitId]: value,
            },
          },
        }));
      },

      replaceStateForTests: (state) => set(state),
    }),
    {
      name: "seiri.habits.v1",
      version: 1,
      partialize: ({ habits, logs }): PersistedHabitState => ({ habits, logs }),
    },
  ),
);
