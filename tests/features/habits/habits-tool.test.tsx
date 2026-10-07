import { beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "@/app/App";
import { useHabitStore } from "@/features/habits/habit-store";
import { HABIT_COLORS, MAX_HABITS } from "@/features/habits/habit-colors";
import type { Habit } from "@/features/habits/habit-types";
import { habitMonthDays, localDateKey, moveMonth, moveWeek } from "@/features/habits/habit-utils";
import { UI_SOUND_EVENT } from "@/shared/sound/use-ui-sounds";

const createdAt = "2026-01-01T00:00:00.000Z";

beforeEach(() => {
  useHabitStore.getState().replaceStateForTests({ habits: [], logs: {} });
});

describe("habit tracker", () => {
  test("creates an icon habit with a selected logging mode", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "habits" }));

    expect(screen.getByText("Build a week one small mark at a time."))
      .toBeVisible();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add habit" }));
      await Promise.resolve();
    });

    const dialog = screen.getByRole("dialog", { name: "New habit" });
    expect(dialog).toBeVisible();
    expect(screen.queryByRole("button", { name: "Text: Write a short note" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Read, stretch, journal…"), {
      target: { value: "Read" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Number: Record an amount" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reading" }));
    fireEvent.click(screen.getByRole("button", { name: "Add habit" }));

    expect(screen.getByRole("button", { name: "Edit Read" })).toBeVisible();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    const row = screen.getByRole("button", { name: "Edit Read" }).closest('[role="row"]')!;
    expect(within(row as HTMLElement).getAllByRole("gridcell")).toHaveLength(7);
    expect(screen.queryByRole("columnheader", { name: "Completed" })).not.toBeInTheDocument();
    expect(useHabitStore.getState().habits[0]).toMatchObject({
      name: "Read",
      icon: "book",
      logType: "number",
    });
    expect(localStorage.getItem("seiri.habits.v1")).not.toBeNull();
  });

  test("logs check, level, number, and text cells into daily progress", () => {
    const habits: Habit[] = [
      { id: "check", name: "Move", icon: "activity", logType: "checkbox", createdAt },
      { id: "level", name: "Energy", icon: "zap", logType: "level", createdAt },
      { id: "number", name: "Water", icon: "water", logType: "number", createdAt },
      { id: "text", name: "Reflect", icon: "notes", logType: "text", createdAt },
    ];
    useHabitStore.getState().replaceStateForTests({ habits, logs: {} });
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "habits" }));

    const dateKey = localDateKey(new Date());
    fireEvent.click(screen.getByRole("checkbox", { name: `Move on ${dateKey}` }));
    fireEvent.click(screen.getByRole("button", { name: `Energy on ${dateKey}` }));
    fireEvent.change(screen.getByLabelText(`Water on ${dateKey}`), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText(`Reflect on ${dateKey}`), {
      target: { value: "Calm" },
    });

    expect(screen.getByLabelText(`${dateKey} completeness: 81%`)).toBeInTheDocument();
    expect(useHabitStore.getState().logs[dateKey]).toEqual({
      check: true,
      level: 1,
      number: 8,
      text: "Calm",
    });
    fireEvent.click(screen.getByRole("checkbox", { name: `Move on ${dateKey}` }));
    expect(screen.getByLabelText(`${dateKey} completeness: 56%`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(screen.queryByLabelText(`${dateKey} completeness: 56%`)).not.toBeInTheDocument();
    expect(screen.getByLabelText(`${localDateKey(moveWeek(new Date(), -1))} completeness: 0%`)).toBeInTheDocument();
  });

  test("moves between weeks and stops at the current week", () => {
    useHabitStore.getState().replaceStateForTests({
      habits: [
        { id: "check", name: "Move", icon: "activity", logType: "checkbox", createdAt },
      ],
      logs: {},
    });
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "habits" }));

    const currentWeek = screen.getByRole("combobox", {
      name: "Select week",
    }).textContent;
    expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByRole("combobox", { name: "Select week" }).textContent)
      .toBe(currentWeek);
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    expect(screen.getByRole("button", { name: "Next week" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Select week" }).textContent)
      .not.toBe(currentWeek);
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Select week" }).textContent)
      .toBe(currentWeek);
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }));
    fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    expect(screen.getByRole("combobox", { name: "Select week" }).textContent)
      .toBe(currentWeek);
  });

  test("confirms deletion and removes only that habit and its logs from every week", async () => {
    const today = localDateKey(new Date());
    const previous = localDateKey(moveWeek(new Date(), -1));
    const habits: Habit[] = [
      { id: "move", name: "Move", icon: "activity", logType: "checkbox", createdAt },
      { id: "read", name: "Read", icon: "book", logType: "checkbox", createdAt },
    ];
    useHabitStore.getState().replaceStateForTests({
      habits,
      logs: { [today]: { move: true, read: true }, [previous]: { move: true } },
    });
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "habits" }));
    expect(screen.queryByRole("button", { name: "Delete Move" })).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Edit Move" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete habit" }));
    });
    expect(screen.getByRole("alertdialog", { name: "Delete this habit?" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(useHabitStore.getState().habits).toHaveLength(2);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete habit" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect(screen.queryByRole("button", { name: "Edit Move" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Read" })).toBeVisible();
    expect(useHabitStore.getState().logs).toEqual({ [today]: { read: true } });
    expect(JSON.parse(localStorage.getItem("seiri.habits.v1")!).state).toEqual({
      habits: [habits[1]], logs: { [today]: { read: true } },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Edit Read" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete habit" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect(screen.getByText("Build a week one small mark at a time.")).toBeVisible();
  });

  test("edits habit details, preserves saved logs, and discards canceled edits", async () => {
    const dateKey = localDateKey(new Date());
    const habit: Habit = { id: "read", name: "Read", icon: null, logType: "number", createdAt };
    useHabitStore.getState().replaceStateForTests({ habits: [habit], logs: { [dateKey]: { read: 5 } } });
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "habits" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Edit Read" }));
    });
    expect(screen.getByRole("dialog", { name: "Edit habit" })).toBeVisible();
    expect(screen.getByRole("button", { name: "No icon" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Pages" } });
    fireEvent.click(screen.getByRole("button", { name: "Reading" }));
    fireEvent.click(screen.getByRole("button", { name: "Coral color" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("button", { name: "Edit Pages" })).toBeVisible();
    expect(screen.getByLabelText(`Pages on ${dateKey}`)).toHaveValue(5);
    expect(useHabitStore.getState().habits).toEqual([{ ...habit, name: "Pages", icon: "book", color: "coral" }]);
    expect(JSON.parse(localStorage.getItem("seiri.habits.v1")!).state.logs).toEqual({ [dateKey]: { read: 5 } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Edit Pages" }));
    });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Discard me" } });
    fireEvent.click(screen.getByRole("button", { name: "Check: Done or not done" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(useHabitStore.getState().habits[0]).toMatchObject({ name: "Pages", logType: "number" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Edit Pages" }));
    });
    fireEvent.click(screen.getByRole("button", { name: "Levels: Log from one to four" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(useHabitStore.getState().habits[0].logType).toBe("level");
    expect(useHabitStore.getState().logs[dateKey]?.read).toBe(5);
  });

  test("switches to a full month with initials, shared logs, and no future navigation", () => {
    const today = new Date();
    const dateKey = localDateKey(today);
    const monthDays = habitMonthDays(today);
    const previousMonthKey = localDateKey(moveMonth(today, -1));
    useHabitStore.getState().replaceStateForTests({
      habits: [{ id: "move", name: "Move", icon: "activity", logType: "checkbox", createdAt }],
      logs: { [dateKey]: { move: true }, [previousMonthKey]: { move: true } },
    });
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "habits" }));
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("checkbox")).toHaveLength(new Date().getDate());
    const dayHeaders = screen.getAllByRole("columnheader").slice(1);
    expect(dayHeaders).toHaveLength(monthDays.length);
    dayHeaders.forEach((header, index) => {
      expect(header.querySelector("span")?.textContent).toBe(
        monthDays[index].toLocaleDateString(undefined, { weekday: "long" }).slice(0, 1),
      );
      expect(header).toHaveAttribute("aria-label", expect.stringContaining(`${monthDays[index].getDate()}`));
    });
    expect(screen.getByLabelText(`${dateKey} completeness: 100%`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox", { name: `Move on ${dateKey}` }));
    expect(screen.getByLabelText(`${dateKey} completeness: 0%`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("button", { name: "Next month" })).toBeEnabled();
    expect(screen.getByLabelText(`${previousMonthKey} completeness: 100%`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    while (!(screen.getByRole("button", { name: "Next week" }) as HTMLButtonElement).disabled) {
      fireEvent.click(screen.getByRole("button", { name: "Next week" }));
    }
    expect(screen.getByRole("checkbox", { name: `Move on ${dateKey}` })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();
  });

  test("wheel toggles checks, fills levels from each cell's outer edge inward, and edits numeric and text entries", async () => {
    const dateKey = localDateKey(new Date());
    const habits: Habit[] = [
      { id: "move", name: "Move", icon: null, logType: "checkbox", color: "coral", createdAt },
      { id: "energy", name: "Energy", icon: null, logType: "level", color: "gold", createdAt },
      { id: "water", name: "Water", icon: null, logType: "number", color: "blue", createdAt },
      { id: "reflect", name: "Reflect", icon: null, logType: "text", color: "mint", createdAt },
    ];
    useHabitStore.getState().replaceStateForTests({ habits, logs: {} });
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "habits" }));
    fireEvent.click(screen.getByRole("button", { name: "Wheel" }));
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
    const check = screen.getByRole("checkbox", { name: `Move on ${dateKey}` });
    fireEvent.keyDown(check, { key: " " });
    expect(check).toHaveAttribute("aria-checked", "true");
    expect(check.querySelector("path")).toHaveAttribute("fill", HABIT_COLORS[6].value);
    const level = screen.getByRole("button", { name: `Energy on ${dateKey}` });
    for (let step = 1; step <= 4; step++) {
      fireEvent.click(level);
      expect(level).toHaveAttribute("aria-valuenow", String(step));
      expect(useHabitStore.getState().logs[dateKey]?.energy).toBe(step);
      const radii = (selector: string) => [...level.querySelector(selector)!.getAttribute("d")!.matchAll(/A ([\d.]+) /g)]
        .map((match) => Number(match[1]));
      const [outer, inner] = radii(".habit-wheel-space");
      const [filledOuter, filledInner] = radii(".habit-wheel-level-fill");
      expect(filledOuter).toBeCloseTo(outer!);
      expect(filledInner).toBeCloseTo(outer! - (outer! - inner!) * step / 4);
    }
    expect(level.querySelector(".habit-wheel-level-fill")?.getAttribute("d"))
      .toBe(level.querySelector(".habit-wheel-space")?.getAttribute("d"));
    fireEvent.click(level);
    expect(level).toHaveAttribute("aria-valuenow", "0");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: `Water on ${dateKey}` })); });
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: `Water on ${dateKey}` }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("2.5");
    expect(screen.getByRole("button", { name: `Water on ${dateKey}` }).querySelector("path"))
      .toHaveAttribute("fill", HABIT_COLORS[0].value);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: `Reflect on ${dateKey}` })); });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "A calm morning" } });
    fireEvent.click(screen.getByRole("button", { name: "Save entry" }));
    fireEvent.mouseEnter(screen.getByRole("button", { name: `Reflect on ${dateKey}` }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("A calm morning");
    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));
    expect(screen.getByLabelText(`Water on ${dateKey}`)).toHaveValue(2.5);
    expect(screen.getByLabelText(`Reflect on ${dateKey}`)).toHaveValue("A calm morning");
    expect(screen.getByLabelText(`${dateKey} completeness: 75%`)).toBeInTheDocument();
  });

  test("wheel checkbox clicks and keyboard toggles request the table's checked and unchecked sounds", () => {
    const dateKey = localDateKey(new Date());
    useHabitStore.getState().replaceStateForTests({
      habits: [{ id: "move", name: "Move", icon: null, logType: "checkbox", createdAt }], logs: {},
    });
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "habits" }));
    fireEvent.click(screen.getByRole("button", { name: "Wheel" }));
    const cues: string[] = [];
    const record = (event: Event) => cues.push((event as CustomEvent<string>).detail);
    document.addEventListener(UI_SOUND_EVENT, record);
    try {
      const check = screen.getByRole("checkbox", { name: `Move on ${dateKey}` });
      fireEvent.click(check);
      fireEvent.click(check);
      fireEvent.keyDown(check, { key: " " });
      fireEvent.keyDown(check, { key: "Enter" });
      expect(cues).toEqual(["open", "close", "open", "close"]);
    } finally {
      document.removeEventListener(UI_SOUND_EVENT, record);
    }
  });

  test("rejects tracking before the first Sunday of 2026 without removing existing logs", () => {
    useHabitStore.getState().replaceStateForTests({ habits: [], logs: { "2026-01-01": { old: true } } });
    useHabitStore.getState().setLog("2026-01-03", "move", true);
    expect(useHabitStore.getState().logs["2026-01-03"]).toBeUndefined();
    useHabitStore.getState().setLog("2026-01-04", "move", true);
    expect(useHabitStore.getState().logs["2026-01-04"]).toEqual({ move: true });
    expect(useHabitStore.getState().logs["2026-01-01"]).toEqual({ old: true });
  });

  test("persists habit order without changing saved logs and ignores invalid moves", () => {
    const habits: Habit[] = ["Read", "Move", "Water"].map((name) => ({
      id: name, name, icon: null, logType: "checkbox", createdAt,
    }));
    const logs = { "2026-01-04": { Read: true, Water: true } };
    useHabitStore.getState().replaceStateForTests({ habits, logs });
    useHabitStore.getState().reorderHabit("Read", "Water");
    expect(useHabitStore.getState().habits.map((habit) => habit.name)).toEqual(["Move", "Water", "Read"]);
    expect(useHabitStore.getState().logs).toEqual(logs);
    expect(JSON.parse(localStorage.getItem("seiri.habits.v1")!).state.habits.map((habit: Habit) => habit.name))
      .toEqual(["Move", "Water", "Read"]);
    useHabitStore.getState().reorderHabit("Read", "missing");
    useHabitStore.getState().reorderHabit("missing", "Read");
    useHabitStore.getState().reorderHabit("Read", "Read");
    expect(useHabitStore.getState().habits.map((habit) => habit.name)).toEqual(["Move", "Water", "Read"]);
  });

  test("enforces the 12-habit limit in both the UI and store and allows adding after deletion", () => {
    const habits: Habit[] = Array.from({ length: MAX_HABITS }, (_, index) => ({
      id: `habit-${index}`, name: `Habit ${index}`, icon: null, logType: "checkbox", createdAt,
    }));
    useHabitStore.getState().replaceStateForTests({ habits, logs: {} });
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "habits" }));
    expect(screen.getByRole("button", { name: "Add habit" })).toBeDisabled();
    let result: string | null = "";
    act(() => { result = useHabitStore.getState().addHabit({ name: "Too many", icon: null, logType: "checkbox" }); });
    expect(result).toBeNull();
    expect(useHabitStore.getState().habits).toHaveLength(MAX_HABITS);
    act(() => { useHabitStore.getState().deleteHabit(habits[0]!.id); });
    expect(screen.getByRole("button", { name: "Add habit" })).toBeEnabled();
    act(() => { result = useHabitStore.getState().addHabit({ name: "New", icon: null, logType: "checkbox", color: "teal" }); });
    expect(result).not.toBeNull();
    expect(useHabitStore.getState().habits).toHaveLength(MAX_HABITS);
    expect(JSON.parse(localStorage.getItem("seiri.habits.v1")!).state.habits.at(-1).color).toBe("teal");
  });
});
