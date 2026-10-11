import { beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "@/app/App";
import { emptyBlockData, useBlockStore } from "@/features/blocks/block-store";
import { useTaskStore } from "@/features/todo/todo-store";
import { useHabitStore } from "@/features/habits/habit-store";
import { localDateKey } from "@/features/habits/habit-utils";
import type { TaskSortKey, TaskStatus } from "@/features/todo/todo-types";

beforeEach(() => {
  useBlockStore.setState({
    ...emptyBlockData,
    days: {},
    repeatingEvents: [],
    timelineView: "grid",
  });
  useTaskStore.getState().replaceStateForTests({ tasks: {}, activeOrder: [], archiveOrder: [] });
  useHabitStore.getState().replaceStateForTests({ habits: [], logs: {} });
});

async function openBlocks() {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "blocks" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Start planning" }));
  });
}

async function openNew(category: "Event" | "Todo" | "Habit", time: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: `Create block at ${time}` }));
  });
  fireEvent.click(screen.getByRole("button", { name: category }));
}

describe("Blocks integration", () => {
  test("defaults event and todo spans to 30 minutes and creates an instant event at an occupied time", async () => {
    await openBlocks();
    await openNew("Event", "8am");
    expect(screen.getByLabelText("Block end")).toHaveValue("08:30");
    fireEvent.change(screen.getByLabelText("Block name"), { target: { value: "Breakfast" } });
    fireEvent.click(screen.getByRole("button", { name: "Create block" }));
    await openNew("Event", "8am");
    fireEvent.change(screen.getByLabelText("Block end"), { target: { value: "08:00" } });
    fireEvent.change(screen.getByLabelText("Block name"), { target: { value: "Wake up" } });
    fireEvent.click(screen.getByRole("button", { name: "Create block" }));
    expect(screen.getByRole("button", { name: "Edit Wake up, at 8am" })).toBeVisible();
    expect(useBlockStore.getState().days[localDateKey(new Date())]?.blocks[1]).toMatchObject({
      category: "event",
      start: 480,
      end: 480,
    });
    expect(screen.getByText("30m planned")).toBeVisible();
    await openNew("Todo", "9am");
    expect(screen.getByLabelText("Block end")).toHaveValue("09:30");
    expect(screen.getByLabelText("Todo estimate")).toHaveValue(30);
  });

  test("sorts todo cards by all five fields without changing the Todo app's manual order", async () => {
    const taskStore = useTaskStore.getState();
    const ids = ["Zeta", "Alpha", "Beta"].map(() => taskStore.addTask());
    const names = ["Zeta", "Alpha", "Beta"];
    const statuses: TaskStatus[] = ["on-hold", "not-started", "in-progress"];
    for (let index = 0; index < ids.length; index++)
      taskStore.updateTask(ids[index]!, {
        title: names[index]!,
        priority: ([2, 0, 1] as const)[index]!,
        status: statuses[index]!,
        estimate: { amount: [60, 15, 30][index]!, unit: "minutes" },
        dueOn: ["2026-10-13", "2026-10-11", "2026-10-12"][index]!,
      });
    const manualOrder = [...useTaskStore.getState().activeOrder];
    await openBlocks();
    const tray = screen.getByRole("region", { name: "Todos to schedule" });
    const expected: Record<TaskSortKey, string[]> = {
      priority: ["Alpha", "Beta", "Zeta"],
      title: ["Alpha", "Beta", "Zeta"],
      status: ["Beta", "Alpha", "Zeta"],
      estimate: ["Alpha", "Beta", "Zeta"],
      due: ["Alpha", "Beta", "Zeta"],
    };
    for (const key of Object.keys(expected) as TaskSortKey[]) {
      fireEvent.change(screen.getByLabelText("Sort todos by"), { target: { value: key } });
      expect(
        within(tray)
          .getAllByRole("article")
          .map((card) =>
            within(card)
              .getByRole("button", { name: /^Edit / })
              .getAttribute("aria-label"),
          ),
      ).toEqual(expected[key].map((name) => `Edit ${name}`));
    }
    fireEvent.click(screen.getByRole("button", { name: "Sort descending" }));
    expect(
      within(tray)
        .getAllByRole("article")
        .map((card) =>
          within(card)
            .getByRole("button", { name: /^Edit / })
            .getAttribute("aria-label"),
        ),
    ).toEqual(["Edit Zeta", "Edit Beta", "Edit Alpha"]);
    expect(useTaskStore.getState().activeOrder).toEqual(manualOrder);
  });

  test.each(["grid", "connected"] as const)(
    "timeline completion in %s updates Todo and all habit log types",
    async (view) => {
      const date = localDateKey(new Date());
      const taskStore = useTaskStore.getState();
      const taskId = taskStore.addTask();
      taskStore.updateTask(taskId, { title: "Ship" });
      const habitStore = useHabitStore.getState();
      const check = habitStore.addHabit({
        name: "Read",
        icon: "book",
        color: "teal",
        logType: "checkbox",
      })!;
      const level = habitStore.addHabit({
        name: "Energy",
        icon: "zap",
        color: "violet",
        logType: "level",
      })!;
      const number = habitStore.addHabit({
        name: "Water",
        icon: "water",
        color: "blue",
        logType: "number",
      })!;
      const blockStore = useBlockStore.getState();
      blockStore.setWakingHours({ start: 480, end: 1440 });
      for (const [id, category, sourceId, start] of [
        ["todo", "todo", taskId, 480],
        ["check", "habit", check, 510],
        ["level", "habit", level, 525],
        ["number", "habit", number, 540],
      ] as const) {
        blockStore.saveBlock(date, { id, category, sourceId, title: id, start, end: start + 15 });
      }
      blockStore.setTimelineView(view);
      render(<App />);
      fireEvent.click(screen.getByRole("tab", { name: "blocks" }));
      fireEvent.click(screen.getByRole("button", { name: "Complete Ship" }));
      expect(useTaskStore.getState().tasks[taskId]?.status).toBe("done");
      fireEvent.click(screen.getByRole("button", { name: "Restore Ship" }));
      fireEvent.click(screen.getByRole("button", { name: "Kill Ship" }));
      expect(useTaskStore.getState().tasks[taskId]?.status).toBe("kill");
      fireEvent.click(screen.getByRole("checkbox", { name: `Read on ${date}` }));
      expect(useHabitStore.getState().logs[date]?.[check]).toBe(true);
      const control = screen.getByRole("button", { name: `Energy on ${date}` });
      for (let level = 0; level < 3; level++) fireEvent.click(control);
      fireEvent.change(screen.getByLabelText(`Water on ${date}`), { target: { value: "8" } });
      expect(useHabitStore.getState().logs[date]?.[level]).toBe(3);
      expect(useHabitStore.getState().logs[date]?.[number]).toBe(8);
    },
  );

  test("requires waking hours first and creates a todo that appears in Todo", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "blocks" }));
    expect(screen.getByRole("heading", { name: "Make room for your day." })).toBeVisible();
    expect(screen.queryByRole("button", { name: "New block" })).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start planning" }));
    });
    await openNew("Todo", "9am");
    fireEvent.change(screen.getByLabelText("Block name"), { target: { value: "Write the brief" } });
    fireEvent.change(screen.getByLabelText("Todo description"), {
      target: { value: "Outline the launch" },
    });
    fireEvent.change(screen.getByLabelText("Block end"), { target: { value: "10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Create block" }));
    expect(screen.getByRole("button", { name: "Edit Write the brief, 9am to 10am" })).toBeVisible();
    const task = Object.values(useTaskStore.getState().tasks)[0]!;
    expect(task).toMatchObject({
      title: "Write the brief",
      description: "Outline the launch",
      estimate: { amount: 30, unit: "minutes" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "todo" }));
    expect(screen.getByText("Write the brief")).toBeVisible();
  });

  test("creates and edits habits through shared data, and removing a block preserves the habit", async () => {
    await openBlocks();
    await openNew("Habit", "8am");
    fireEvent.change(screen.getByLabelText("Block name"), { target: { value: "Read" } });
    fireEvent.click(screen.getByRole("button", { name: "Number" }));
    fireEvent.click(screen.getByRole("button", { name: "Create block" }));
    expect(useHabitStore.getState().habits[0]).toMatchObject({ name: "Read", logType: "number" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Edit Read" }));
    });
    fireEvent.change(screen.getByLabelText("Block name"), { target: { value: "Read a book" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("button", { name: "Edit Read a book, at 8am" })).toBeVisible();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Edit Read a book, at 8am" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove from day" }));
    expect(useHabitStore.getState().habits).toHaveLength(1);
    fireEvent.click(screen.getByRole("tab", { name: "habits" }));
    expect(screen.getByRole("button", { name: "Edit Read a book" })).toBeVisible();
  });

  test("daily events repeat and reject negative durations before creating shared todos", async () => {
    await openBlocks();
    await openNew("Event", "8am");
    fireEvent.change(screen.getByLabelText("Block name"), { target: { value: "Breakfast" } });
    fireEvent.change(screen.getByLabelText("Block end"), { target: { value: "09:00" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Repeat every day" }));
    fireEvent.click(screen.getByRole("button", { name: "Create block" }));
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(screen.getByRole("button", { name: "Edit Breakfast, 8am to 9am" })).toBeVisible();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "New todo" }));
    });
    fireEvent.change(screen.getByLabelText("Block name"), {
      target: { value: "Conflicting task" },
    });
    fireEvent.change(screen.getByLabelText("Block start"), { target: { value: "08:30" } });
    fireEvent.change(screen.getByLabelText("Block end"), { target: { value: "08:29" } });
    fireEvent.click(screen.getByRole("button", { name: "Create block" }));
    expect(screen.getByRole("alert")).toHaveTextContent("at or after");
    expect(Object.keys(useTaskStore.getState().tasks)).toHaveLength(0);
    expect(within(screen.getByRole("dialog")).getByLabelText("Block name")).toHaveValue(
      "Conflicting task",
    );
  });
});
