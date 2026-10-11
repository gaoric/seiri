import { beforeEach, describe, expect, test } from "bun:test";
import {
  emptyBlockData,
  livePlanBlocks,
  migrateBlockData,
  useBlockStore,
} from "@/features/blocks/block-store";
import {
  blockColor,
  DEFAULT_BLOCK_COLOR,
  dayMinute,
  habitDuration,
  placementError,
  planBlocks,
  wakingWindow,
} from "@/features/blocks/block-utils";
import { withDayBoundaries } from "@/features/blocks/connected-timeline";
import type { TimeBlock } from "@/features/blocks/block-types";
import { useTaskStore } from "@/features/todo/todo-store";
import { useHabitStore } from "@/features/habits/habit-store";

const today = "2026-10-09";
const tomorrow = "2026-10-10";
const routine: TimeBlock = {
  id: "breakfast",
  category: "event",
  title: "Breakfast",
  start: 480,
  end: 510,
};

beforeEach(() => {
  useBlockStore.setState({ ...emptyBlockData, days: {}, repeatingEvents: [] });
  useTaskStore.getState().replaceStateForTests({ tasks: {}, activeOrder: [], archiveOrder: [] });
  useHabitStore.getState().replaceStateForTests({ habits: [], logs: {} });
  useBlockStore.getState().setWakingHours({ start: 480, end: 1560 });
});

describe("daily blocks", () => {
  test("uses one default color, inherits habit colors and persists overrides", () => {
    const store = useBlockStore.getState();
    for (const category of ["event", "todo"] as const) {
      expect(blockColor({ ...routine, category })).toBe(DEFAULT_BLOCK_COLOR);
    }
    const habitId = useHabitStore
      .getState()
      .addHabit({ name: "Read", icon: "book", color: "teal", logType: "checkbox" });
    const habit = useHabitStore.getState().habits.find((habit) => habit.id === habitId)!;
    expect(blockColor({ ...routine, category: "habit" }, habit)).toBe("#6ad4cf");
    expect(blockColor({ ...routine, color: "#aa6633" }, habit)).toBe("#aa6633");
    expect(store.saveBlock(today, { ...routine, color: "#aa6633" }, true)).toBeNull();
    expect(
      JSON.parse(localStorage.getItem("seiri.blocks.v1")!).state.repeatingEvents[0].color,
    ).toBe("#aa6633");
    expect(store.saveBlock(today, { ...routine, color: "invalid" }, true)).toContain("color");
    expect(useBlockStore.getState().repeatingEvents[0]?.color).toBe("#aa6633");
  });

  test("customized greetings keep their colors when waking hours change", () => {
    const store = useBlockStore.getState();
    const hours = store.wakingHours!;
    const night = withDayBoundaries(hours, []).at(-1)!;
    expect(store.saveBlock(today, { ...night, color: "#eeaa77" }, true)).toBeNull();
    expect(store.setWakingHours({ start: 450, end: 1440 })).toBeNull();
    expect(planBlocks(useBlockStore.getState(), tomorrow)[0]).toMatchObject({
      boundary: "night",
      start: 1440,
      end: 1440,
      color: "#eeaa77",
    });
  });
  test("instant events share times and can repeat at the sleep boundary", () => {
    const store = useBlockStore.getState();
    const marker: TimeBlock = {
      id: "wake",
      category: "event",
      title: "Wake up",
      icon: "sun",
      start: 480,
      end: 480,
    };
    expect(store.saveBlock(today, marker, true)).toBeNull();
    expect(store.saveBlock(today, routine, true)).toBeNull();
    expect(planBlocks(useBlockStore.getState(), tomorrow)).toHaveLength(2);
    expect(
      store.saveBlock(today, { ...marker, id: "sleep", title: "Sleep", start: 1560, end: 1560 }),
    ).toBeNull();
    expect(store.saveBlock(today, { ...marker, id: "invalid", end: 479 })).not.toBeNull();
    expect(
      planBlocks(useBlockStore.getState(), today).reduce(
        (sum, block) => sum + block.end - block.start,
        0,
      ),
    ).toBe(30);
  });

  test("habit estimates default to zero and editing details preserves the estimate and logs", () => {
    const store = useHabitStore.getState();
    const id = store.addHabit({ name: "Read", icon: "book", logType: "checkbox", color: "teal" })!;
    expect(useHabitStore.getState().habits[0]?.estimateMinutes).toBe(0);
    store.setLog(today, id, true);
    store.updateHabit(id, {
      name: "Read",
      icon: "book",
      logType: "checkbox",
      color: "teal",
      estimateMinutes: 45,
    });
    store.updateHabit(id, {
      name: "Read a book",
      icon: "book",
      logType: "checkbox",
      color: "teal",
    });
    expect(useHabitStore.getState().habits[0]?.estimateMinutes).toBe(45);
    expect(useHabitStore.getState().logs[today]?.[id]).toBe(true);
    store.updateHabit(id, {
      name: "Read a book",
      icon: "book",
      logType: "checkbox",
      color: "teal",
      estimateMinutes: 0,
    });
    expect(habitDuration(useHabitStore.getState().habits[0]!)).toBe(0);
    expect(
      habitDuration({ ...useHabitStore.getState().habits[0]!, estimateMinutes: undefined }),
    ).toBe(0);
  });

  test("zero-minute habits share occupied times without reserving any time", () => {
    const store = useBlockStore.getState();
    const sourceId = useHabitStore.getState().addHabit({
      name: "Read",
      icon: "book",
      logType: "checkbox",
      color: "teal",
    })!;
    const habit: TimeBlock = {
      id: "read",
      category: "habit",
      sourceId,
      title: "Read",
      start: 495,
      end: 495,
    };
    expect(store.saveBlock(today, routine)).toBeNull();
    expect(store.saveBlock(today, habit)).toBeNull();
    expect(store.saveBlock(today, { ...habit, end: 510 })).toBeNull();
    expect(store.saveBlock(today, { ...habit, end: 480 })).not.toBeNull();
    expect(placementError({ ...habit, category: "todo" }, { start: 480, end: 1560 })).toBeNull();
    expect(store.saveBlock(today, { ...habit, start: 510, end: 540 })).toBeNull();
    expect(store.saveBlock(today, { ...habit, start: 540, end: 540 })).toBeNull();
    expect(
      livePlanBlocks(useBlockStore.getState(), today).find((block) => block.id === "read"),
    ).toMatchObject({ start: 540, end: 540 });
  });

  test("represents midnight and overnight hours on the same waking day", () => {
    const hours = wakingWindow("08:00", "02:00");
    expect(hours).toEqual({ start: 480, end: 1560 });
    expect(dayMinute("00:00", hours)).toBe(1440);
    expect(dayMinute("01:30", hours)).toBe(1530);
    expect(placementError({ ...routine, start: 1500, end: 1560 }, hours)).toBeNull();
    expect(placementError({ ...routine, start: 1530, end: 1590 }, hours)).toContain("waking hours");
  });

  test("events repeat, while daily moves and omissions stay on their day", () => {
    const store = useBlockStore.getState();
    expect(store.saveBlock(today, routine, true)).toBeNull();
    expect(planBlocks(useBlockStore.getState(), tomorrow)).toEqual([
      { ...routine, repeatDaily: true },
    ]);
    expect(store.saveBlock(today, { ...routine, start: 540, end: 570 })).toBeNull();
    expect(planBlocks(useBlockStore.getState(), today)[0]?.start).toBe(540);
    expect(planBlocks(useBlockStore.getState(), tomorrow)[0]?.start).toBe(480);
    store.removeBlock(tomorrow, routine.id);
    expect(planBlocks(useBlockStore.getState(), tomorrow)).toEqual([]);
    expect(planBlocks(useBlockStore.getState(), "2026-10-11")).toEqual([
      { ...routine, repeatDaily: true },
    ]);
    store.removeBlock(today, routine.id, true);
    expect(planBlocks(useBlockStore.getState(), today)).toEqual([]);
    expect(useBlockStore.getState().repeatingEvents).toEqual([]);
  });

  test("allows overlapping events and todos across daily defaults and planned days", () => {
    const taskId = useTaskStore.getState().addTask();
    useTaskStore.getState().updateTask(taskId, { title: "Ship" });
    const todo: TimeBlock = {
      id: "ship",
      category: "todo",
      sourceId: taskId,
      title: "Ship",
      start: 540,
      end: 600,
    };
    const store = useBlockStore.getState();
    store.saveBlock(tomorrow, todo);
    expect(store.saveBlock(today, { ...routine, start: 540, end: 570 }, true)).toBeNull();
    expect(planBlocks(useBlockStore.getState(), tomorrow)).toHaveLength(2);
    expect(store.saveBlock(today, { ...routine, id: "overlap", start: 495, end: 525 })).toBeNull();
    expect(store.saveBlock(today, { ...routine, id: "adjacent", start: 510, end: 540 })).toBeNull();
  });

  test("keeps completed todos scheduled and frees time when a source is deleted", () => {
    const taskStore = useTaskStore.getState();
    const id = taskStore.addTask();
    taskStore.updateTask(id, { title: "Ship" });
    const block: TimeBlock = { ...routine, category: "todo", sourceId: id };
    const store = useBlockStore.getState();
    store.saveBlock(today, block);
    taskStore.updateTask(id, { status: "done" });
    expect(livePlanBlocks(useBlockStore.getState(), today)).toHaveLength(1);
    taskStore.deleteTask(id);
    expect(livePlanBlocks(useBlockStore.getState(), today)).toEqual([]);
    expect(store.saveBlock(today, { ...routine, id: "replacement" })).toBeNull();
  });

  test("validates waking hours without hiding existing plans and persists the data", () => {
    const store = useBlockStore.getState();
    expect(store.setWakingHours(wakingWindow("08:00", "08:00"))).not.toBeNull();
    store.saveBlock(today, routine, true);
    expect(store.setWakingHours({ start: 540, end: 1440 })).toContain("Move or remove");
    expect(useBlockStore.getState().wakingHours).toEqual({ start: 480, end: 1560 });
    const persisted = JSON.parse(localStorage.getItem("seiri.blocks.v1")!);
    expect(persisted.state.repeatingEvents).toEqual([{ ...routine, repeatDaily: true }]);
    expect(persisted.state.saveBlock).toBeUndefined();
  });

  test("migrates routines, markers and day-specific overrides without losing recurrence", () => {
    const legacy = {
      wakingHours: { start: 480, end: 1440 },
      routines: [{ ...routine, category: "routine" as const }],
      days: {
        [today]: {
          blocks: [
            { ...routine, category: "routine" as const, start: 510, end: 540 },
            { id: "wake", category: "marker" as const, title: "Wake", start: 480, end: 480 },
          ],
          omittedRoutineIds: [],
        },
        [tomorrow]: { blocks: [], omittedRoutineIds: [routine.id] },
      },
    };
    const migrated = migrateBlockData(legacy);
    expect(migrated.repeatingEvents[0]).toMatchObject({ category: "event", repeatDaily: true });
    expect(planBlocks(migrated, today)).toEqual([
      { id: "wake", category: "event", title: "Wake", start: 480, end: 480, repeatDaily: false },
      { ...routine, start: 510, end: 540, repeatDaily: true },
    ]);
    expect(planBlocks(migrated, tomorrow)).toEqual([]);
  });

  test("accepts exact minute durations and instant blocks of every category", () => {
    const hours = { start: 480, end: 1440 };
    for (const category of ["event", "todo", "habit"] as const) {
      expect(placementError({ ...routine, category, start: 487, end: 494 }, hours)).toBeNull();
      expect(placementError({ ...routine, category, start: 487, end: 487 }, hours)).toBeNull();
      expect(placementError({ ...routine, category, start: 487, end: 486 }, hours)).toContain(
        "at or after",
      );
    }
    const store = useBlockStore.getState();
    expect(store.saveBlock(today, routine, true)).toBeNull();
    expect(store.saveBlock(today, { ...routine, start: 487, end: 494 }, false)).toBeNull();
    expect(planBlocks(useBlockStore.getState(), tomorrow)).toEqual([]);
    expect(planBlocks(useBlockStore.getState(), today)[0]).toMatchObject({
      start: 487,
      end: 494,
      repeatDaily: false,
    });
  });
});
