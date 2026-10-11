import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useTaskStore } from "@/features/todo/todo-store";
import { useHabitStore } from "@/features/habits/habit-store";
import type { BlockData, DayPlan, TimeBlock, WakingHours } from "./block-types";
import { placementError, planBlocks } from "./block-utils";

type BlockState = BlockData & {
  timelineView: "grid" | "connected";
  setTimelineView: (view: "grid" | "connected") => void;
  setWakingHours: (hours: WakingHours) => string | null;
  saveBlock: (date: string, block: TimeBlock, recurring?: boolean) => string | null;
  removeBlock: (date: string, id: string, recurring?: boolean) => void;
};

type LegacyBlock = Omit<TimeBlock, "category"> & {
  category: TimeBlock["category"] | "routine" | "marker";
};
type LegacyData = {
  wakingHours: WakingHours | null;
  routines: LegacyBlock[];
  days: Record<string, { blocks: LegacyBlock[]; omittedRoutineIds: string[] }>;
  timelineView?: BlockState["timelineView"];
};

export const emptyBlockData: BlockData = { wakingHours: null, repeatingEvents: [], days: {} };

export function migrateBlockData(data: LegacyData): BlockData {
  const repeatingIds = new Set(data.routines.map((block) => block.id));
  const convert = (block: LegacyBlock): TimeBlock => ({
    ...block,
    category:
      block.category === "routine" || block.category === "marker" ? "event" : block.category,
    repeatDaily: repeatingIds.has(block.id),
  });
  return {
    wakingHours: data.wakingHours,
    repeatingEvents: data.routines.map(convert),
    days: Object.fromEntries(
      Object.entries(data.days).map(([date, day]) => [
        date,
        { blocks: day.blocks.map(convert), omittedEventIds: day.omittedRoutineIds },
      ]),
    ),
  };
}

export function sourceExists(block: TimeBlock) {
  if (block.category === "event") return true;
  if (block.category === "todo")
    return Boolean(useTaskStore.getState().tasks[block.sourceId ?? ""]);
  return useHabitStore.getState().habits.some((habit) => habit.id === block.sourceId);
}

export function livePlanBlocks(data: BlockData, date: string) {
  return planBlocks(data, date).filter(sourceExists);
}

export const useBlockStore = create<BlockState>()(
  persist(
    (set, get) => ({
      ...emptyBlockData,
      timelineView: "grid",
      setTimelineView: (timelineView) => set({ timelineView }),
      setWakingHours: (hours) => {
        const duration = hours.end - hours.start;
        if (
          !Number.isFinite(hours.start) ||
          !Number.isFinite(hours.end) ||
          hours.start < 0 ||
          hours.start >= 1440 ||
          duration <= 0 ||
          duration >= 1440
        ) {
          return "Choose different wake and sleep times.";
        }
        const state = get();
        const blocks = [
          ...state.repeatingEvents,
          ...Object.values(state.days).flatMap((day) => day.blocks),
        ].filter((block) => !block.boundary && sourceExists(block));
        if (blocks.some((block) => block.start < hours.start || block.end > hours.end)) {
          return "Move or remove blocks outside these hours before changing your waking hours.";
        }
        const updateBoundary = (block: TimeBlock): TimeBlock => {
          if (!block.boundary) return block;
          const minute = block.boundary === "morning" ? hours.start : hours.end;
          return { ...block, start: minute, end: minute };
        };
        set({
          wakingHours: hours,
          repeatingEvents: state.repeatingEvents.map(updateBoundary),
          days: Object.fromEntries(
            Object.entries(state.days).map(([date, day]) => [
              date,
              { ...day, blocks: day.blocks.map(updateBoundary) },
            ]),
          ),
        });
        return null;
      },
      saveBlock: (date, block, recurring) => {
        const state = get();
        if (!state.wakingHours) return "Set your waking hours first.";
        const error = placementError(block, state.wakingHours);
        if (error) return error;
        const day: DayPlan = state.days[date] ?? { blocks: [], omittedEventIds: [] };
        const saved = {
          ...block,
          repeatDaily: block.category === "event" && (recurring ?? block.repeatDaily ?? false),
        };
        if (recurring && block.category === "event") {
          set({
            repeatingEvents: [
              ...state.repeatingEvents.filter((event) => event.id !== block.id),
              saved,
            ],
            days: {
              ...state.days,
              [date]: {
                blocks: day.blocks.filter((item) => item.id !== block.id),
                omittedEventIds: day.omittedEventIds.filter((id) => id !== block.id),
              },
            },
          });
        } else {
          const days =
            recurring === false && block.category === "event"
              ? Object.fromEntries(
                  Object.entries(state.days).map(([key, plan]) => [
                    key,
                    {
                      ...plan,
                      blocks: plan.blocks.map((item) =>
                        item.id === block.id ? { ...item, repeatDaily: false } : item,
                      ),
                    },
                  ]),
                )
              : state.days;
          set({
            repeatingEvents:
              recurring === false && block.category === "event"
                ? state.repeatingEvents.filter((event) => event.id !== block.id)
                : state.repeatingEvents,
            days: {
              ...days,
              [date]: {
                blocks: [...day.blocks.filter((item) => item.id !== block.id), saved],
                omittedEventIds: day.omittedEventIds.filter((id) => id !== block.id),
              },
            },
          });
        }
        return null;
      },
      removeBlock: (date, id, recurring = false) => {
        const state = get();
        if (recurring) {
          set({
            repeatingEvents: state.repeatingEvents.filter((event) => event.id !== id),
            days: Object.fromEntries(
              Object.entries(state.days).map(([key, day]) => [
                key,
                {
                  blocks: day.blocks.filter((block) => block.id !== id),
                  omittedEventIds: day.omittedEventIds.filter((omitted) => omitted !== id),
                },
              ]),
            ),
          });
          return;
        }
        const day = state.days[date] ?? { blocks: [], omittedEventIds: [] };
        set({
          days: {
            ...state.days,
            [date]: {
              blocks: day.blocks.filter((block) => block.id !== id),
              omittedEventIds: [...new Set([...day.omittedEventIds, id])],
            },
          },
        });
      },
    }),
    {
      name: "seiri.blocks.v1",
      version: 2,
      migrate: (persistedState) => {
        const data = persistedState as LegacyData;
        return { ...migrateBlockData(data), timelineView: data.timelineView ?? "grid" };
      },
      partialize: ({ wakingHours, repeatingEvents, days, timelineView }) => ({
        wakingHours,
        repeatingEvents,
        days,
        timelineView,
      }),
    },
  ),
);
