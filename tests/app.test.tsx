import { beforeEach, describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { App } from "@/App";
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

  test("keeps a newly created task with a blank title", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "New task" }));
    const title = screen.getByLabelText("Task title");
    fireEvent.blur(title);

    const createdId = useTaskStore.getState().activeOrder.at(-1);
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
