import { beforeEach, describe, expect, test } from "bun:test";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App } from "@/App";
import { UI_SOUND_EVENT } from "@/hooks/use-ui-sounds";
import { useTaskStore } from "@/store/task-store";
import type { Task } from "@/types";

const baseTask: Task = {
  id: "one",
  priority: 0,
  title: "A focused task",
  status: "in-progress",
  estimate: { amount: 2, unit: "hours" },
  dueOn: "2026-08-12",
  description: "Existing description",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  useTaskStore.getState().replaceStateForTests({
    tasks: { one: baseTask },
    activeOrder: ["one"],
    archiveOrder: [],
  });
});

describe("app interactions", () => {
  test("renders the dark-first task workspace", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "todo" })).toBeInTheDocument();
    expect(screen.getByText("A focused task")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Active/ })).toHaveAttribute(
      "data-active",
      "",
    );
    expect(screen.getByRole("article")).toHaveAttribute("data-ui-hover-sound");
  });

  test("offers compact create and demo actions in an empty workspace", () => {
    useTaskStore.getState().replaceStateForTests({
      tasks: {},
      activeOrder: [],
      archiveOrder: [],
    });
    render(<App />);

    const addTask = screen.getByRole("button", { name: "Add a task" });
    const tryDemo = screen.getByRole("button", { name: "Try demo" });
    expect(addTask).toHaveClass("empty-state-action");
    expect(tryDemo).toHaveClass("empty-state-action");

    fireEvent.click(tryDemo);
    expect(useTaskStore.getState().isDemoMode).toBeTrue();
    expect(screen.getByText("Click any field to edit it inline"))
      .toBeInTheDocument();
  });

  test("edits the title inline", () => {
    render(<App />);
    fireEvent.click(screen.getByText("A focused task"));
    const input = screen.getByLabelText("Task title");
    fireEvent.change(input, { target: { value: "Updated task" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("Updated task")).toBeInTheDocument();
  });

  test("opens and saves the description from the row surface", () => {
    render(<App />);
    const article = screen.getByRole("article");
    fireEvent.click(article);
    const editor = screen.getByLabelText("Task description");
    fireEvent.change(editor, { target: { value: "A better description" } });
    fireEvent.keyDown(editor, { key: "Enter", ctrlKey: true });
    expect(useTaskStore.getState().tasks.one.description).toBe(
      "A better description",
    );
  });

  test("sounds task disclosure as open and close", () => {
    const cues: string[] = [];
    const recordCue = (event: Event) => {
      cues.push((event as CustomEvent<string>).detail);
    };
    document.addEventListener(UI_SOUND_EVENT, recordCue);

    render(<App />);
    const article = screen.getByRole("article");
    fireEvent.click(article);
    fireEvent.click(article);

    expect(cues).toEqual(["open", "close"]);
    document.removeEventListener(UI_SOUND_EVENT, recordCue);
  });

  test("sounds every repeated estimate step in its direction", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "2 hours" }));

    const cues: string[] = [];
    const recordCue = (event: Event) => {
      cues.push((event as CustomEvent<string>).detail);
    };
    document.addEventListener(UI_SOUND_EVENT, recordCue);

    const amount = screen.getByLabelText("Estimate amount") as HTMLInputElement;
    const initialAmount = Number(amount.value);
    const increase = screen.getByLabelText("Increase estimate");
    await act(async () => {
      fireEvent.pointerDown(increase);
      await new Promise((resolve) => setTimeout(resolve, 470));
      fireEvent.pointerUp(increase);
    });

    const increasedBy = Number(amount.value) - initialAmount;
    expect(increasedBy).toBeGreaterThan(1);
    expect(cues).toEqual(Array.from({ length: increasedBy }, () => "open"));

    cues.length = 0;
    const decrease = screen.getByLabelText("Decrease estimate");
    fireEvent.pointerDown(decrease);
    fireEvent.pointerUp(decrease);
    expect(cues).toEqual(["close"]);
    document.removeEventListener(UI_SOUND_EVENT, recordCue);
  });

  test("archives via status and keeps permanent deletion out of Active", () => {
    render(<App />);
    expect(
      screen.queryByLabelText(/Delete .* permanently/),
    ).not.toBeInTheDocument();
    act(() => {
      useTaskStore.getState().updateTask("one", { status: "done" });
    });
    expect(useTaskStore.getState().archiveOrder).toEqual(["one"]);
  });

  test("sorts tasks in both directions from a column header", () => {
    const secondTask = { ...baseTask, id: "two", title: "Zebra task" };
    useTaskStore.getState().replaceStateForTests({
      tasks: { one: baseTask, two: secondTask },
      activeOrder: ["two", "one"],
      archiveOrder: [],
    });
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: "Sort by title ascending" }),
    );
    expect(screen.getAllByRole("article")[0]).toHaveTextContent(
      "A focused task",
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Sort by title descending" }),
    );
    expect(screen.getAllByRole("article")[0]).toHaveTextContent("Zebra task");

    fireEvent.click(
      screen.getByRole("button", { name: "Turn off title sorting" }),
    );
    expect(screen.getAllByRole("article")[0]).toHaveTextContent("Zebra task");
  });

  test("fades out a new untouched task after clicking outside its row", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    const createdId = useTaskStore.getState().activeOrder[0];
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    fireEvent.click(document.body);

    expect(document.querySelector(".task-life-cycle.is-canceling"))
      .toBeInTheDocument();
    await waitFor(() => {
      expect(useTaskStore.getState().activeOrder).toEqual(["one"]);
      expect(useTaskStore.getState().tasks[createdId]).toBeUndefined();
    });
  });

  test("does not treat the New task click as an outside click", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    const createdId = useTaskStore.getState().activeOrder[0];

    expect(useTaskStore.getState().tasks[createdId]).toBeDefined();
    expect(document.querySelector(".task-life-cycle.is-canceling"))
      .not.toBeInTheDocument();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(useTaskStore.getState().tasks[createdId]).toBeDefined();
  });

  test("keeps a blank new task while interacting with its fields", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    const createdId = useTaskStore.getState().activeOrder[0];
    const row = document.querySelector(`[data-task-id="${createdId}"]`)!;
    fireEvent.blur(screen.getByLabelText("Task title"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      fireEvent.click(
        row.querySelector('[role="combobox"][aria-label="Priority"]')!,
      );
      await Promise.resolve();
    });
    expect(useTaskStore.getState().tasks[createdId]).toBeDefined();
    fireEvent.click(row.querySelector(".title-button")!);
    expect(screen.getByLabelText("Task title")).toBeInTheDocument();
    expect(useTaskStore.getState().tasks[createdId]).toBeDefined();

    fireEvent.click(document.body);
    await waitFor(() => {
      expect(useTaskStore.getState().tasks[createdId]).toBeUndefined();
    });
  });

  test("keeps a blank new task after a non-title field changes", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    const createdId = useTaskStore.getState().activeOrder[0];
    const row = document.querySelector(`[data-task-id="${createdId}"]`)!;
    fireEvent.blur(screen.getByLabelText("Task title"));

    await act(async () => {
      fireEvent.click(row.querySelector(".estimate-trigger")!);
      await Promise.resolve();
    });
    const amount = screen.getByLabelText("Estimate amount");
    fireEvent.change(amount, { target: { value: "2" } });
    fireEvent.blur(amount);
    fireEvent.click(document.body);

    expect(useTaskStore.getState().tasks[createdId]).toBeDefined();
    expect(useTaskStore.getState().tasks[createdId].estimate).toEqual({
      amount: 2,
      unit: "days",
    });
  });

  test("toggles and remembers the sound preference", () => {
    const firstRender = render(<App />);
    const mute = screen.getByRole("button", { name: "Mute sounds" });
    fireEvent.click(mute);
    expect(localStorage.getItem("seiri.sounds.enabled")).toBe("false");
    expect(screen.getByRole("button", { name: "Enable sounds" }))
      .toHaveAttribute("aria-pressed", "false");

    firstRender.unmount();
    render(<App />);
    expect(screen.getByRole("button", { name: "Enable sounds" }))
      .toBeInTheDocument();
  });

  test("keeps an explicitly confirmed blank task", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    const title = screen.getByLabelText("Task title");
    fireEvent.keyDown(title, { key: "Enter" });

    const createdId = useTaskStore.getState().activeOrder.at(0);
    expect(createdId).toBeDefined();
    expect(useTaskStore.getState().tasks[createdId!].title).toBe("");
    expect(useTaskStore.getState().tasks[createdId!].estimate).toBeNull();
    expect(
      screen
        .getAllByRole("button", { name: "—" })
        .some((button) => button.classList.contains("title-button")),
    ).toBeTrue();
  });
});
