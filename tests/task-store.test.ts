import { beforeEach, describe, expect, test } from "bun:test";
import { useTaskStore } from "@/store/task-store";
import type { Task } from "@/types";

function task(id: string, status: Task["status"]): Task {
  const timestamp = "2026-01-01T00:00:00.000Z";
  return {
    id,
    priority: 1,
    title: id,
    status,
    estimate: { amount: 1, unit: "days" },
    dueOn: null,
    description: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

beforeEach(() => {
  useTaskStore.getState().replaceStateForTests({
    tasks: {
      active: task("active", "not-started"),
      other: task("other", "in-progress"),
      archived: task("archived", "done"),
    },
    activeOrder: ["active", "other"],
    archiveOrder: ["archived"],
  });
});

describe("task store", () => {
  test("creates new tasks at the top of Active", () => {
    const addedId = useTaskStore.getState().addTask();
    expect(useTaskStore.getState().activeOrder).toEqual([
      addedId,
      "active",
      "other",
    ]);
  });

  test("discards only untitled active drafts", () => {
    const addedId = useTaskStore.getState().addTask();
    expect(useTaskStore.getState().discardTaskDraft(addedId)).toBeTrue();
    expect(useTaskStore.getState().tasks[addedId]).toBeUndefined();
    expect(useTaskStore.getState().activeOrder).toEqual(["active", "other"]);
    expect(useTaskStore.getState().discardTaskDraft("active")).toBeFalse();
  });

  test("moves done and killed tasks into archive", () => {
    useTaskStore.getState().updateTask("active", { status: "done" });
    expect(useTaskStore.getState().activeOrder).toEqual(["other"]);
    expect(useTaskStore.getState().archiveOrder).toEqual([
      "archived",
      "active",
    ]);
  });

  test("restores archived tasks as not started", () => {
    useTaskStore.getState().restoreTask("archived");
    expect(useTaskStore.getState().tasks.archived.status).toBe("not-started");
    expect(useTaskStore.getState().archiveOrder).toEqual([]);
    expect(useTaskStore.getState().activeOrder).toEqual([
      "active",
      "other",
      "archived",
    ]);
  });

  test("refuses to permanently delete an active task", () => {
    expect(useTaskStore.getState().deleteTask("active")).toBeFalse();
    expect(useTaskStore.getState().tasks.active).toBeDefined();
    expect(useTaskStore.getState().deleteTask("archived")).toBeTrue();
    expect(useTaskStore.getState().tasks.archived).toBeUndefined();
  });

  test("reorders only the requested tab", () => {
    useTaskStore.getState().reorderTask("active", "active", "other");
    expect(useTaskStore.getState().activeOrder).toEqual(["other", "active"]);
    expect(useTaskStore.getState().archiveOrder).toEqual(["archived"]);
  });

  test("sorts only the requested tab", () => {
    useTaskStore.getState().sortTasks("active", "title", "desc");
    expect(useTaskStore.getState().activeOrder).toEqual(["other", "active"]);
    expect(useTaskStore.getState().archiveOrder).toEqual(["archived"]);
  });

  test("restores the pre-sort order and appends newer tasks", () => {
    useTaskStore.getState().sortTasks("active", "title", "desc");
    const addedId = useTaskStore.getState().addTask();
    useTaskStore.getState().restoreTaskOrder("active", ["active", "other"]);
    expect(useTaskStore.getState().activeOrder).toEqual([
      "active",
      "other",
      addedId,
    ]);
  });

  test("keeps demo changes ephemeral and restores the real workspace", () => {
    useTaskStore.getState().setDemoMode(true);
    expect(useTaskStore.getState().isDemoMode).toBeTrue();
    expect(useTaskStore.getState().activeOrder.length).toBeGreaterThanOrEqual(7);
    expect(useTaskStore.getState().archiveOrder.length).toBeGreaterThanOrEqual(2);

    const demoId = useTaskStore.getState().activeOrder[0];
    useTaskStore.getState().updateTask(demoId, { title: "Changed in demo" });
    const stored = JSON.parse(localStorage.getItem("seiri.tasks.v1")!);
    expect(stored.state.activeOrder).toEqual(["active", "other"]);
    expect(stored.state.tasks[demoId]).toBeUndefined();

    useTaskStore.getState().setDemoMode(false);
    expect(useTaskStore.getState().isDemoMode).toBeFalse();
    expect(useTaskStore.getState().activeOrder).toEqual(["active", "other"]);
    expect(useTaskStore.getState().archiveOrder).toEqual(["archived"]);
  });
});
