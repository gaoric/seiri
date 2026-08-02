import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  isArchivedStatus,
  moveItem,
  seedTasks,
  sortTaskIds,
  tabForStatus,
} from "@/lib/task-utils";
import type {
  SortDirection,
  Task,
  TaskSortKey,
  TaskStatus,
  TaskTab,
} from "@/types";

type PersistedState = {
  tasks: Record<string, Task>;
  activeOrder: string[];
  archiveOrder: string[];
};

type TaskState = PersistedState & {
  selectedId: string | null;
  expandedId: string | null;
  addTask: () => string;
  updateTask: (id: string, changes: Partial<Task>) => void;
  restoreTask: (id: string) => void;
  deleteTask: (id: string) => boolean;
  reorderTask: (tab: TaskTab, activeId: string, overId: string) => void;
  moveTask: (tab: TaskTab, id: string, direction: -1 | 1) => void;
  sortTasks: (
    tab: TaskTab,
    key: TaskSortKey,
    direction: SortDirection,
  ) => void;
  restoreTaskOrder: (tab: TaskTab, order: string[]) => void;
  setSelectedId: (id: string | null) => void;
  setExpandedId: (id: string | null) => void;
  replaceStateForTests: (state: PersistedState) => void;
};

const initial = seedTasks();

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}`;
}

function removeFrom(items: string[], id: string) {
  return items.filter((item) => item !== id);
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      ...initial,
      selectedId: initial.activeOrder[0] ?? null,
      expandedId: null,

      addTask: () => {
        const id = newId();
        const now = new Date().toISOString();
        const task: Task = {
          id,
          priority: 1,
          title: "",
          status: "not-started",
          estimate: null,
          dueOn: null,
          description: "",
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          tasks: { ...state.tasks, [id]: task },
          activeOrder: [...state.activeOrder, id],
          selectedId: id,
        }));
        return id;
      },

      updateTask: (id, changes) => {
        const current = get().tasks[id];
        if (!current) return;
        const nextStatus = (changes.status ?? current.status) as TaskStatus;
        const previousTab = tabForStatus(current.status);
        const nextTab = tabForStatus(nextStatus);
        const nextTask: Task = {
          ...current,
          ...changes,
          updatedAt: new Date().toISOString(),
        };

        set((state) => {
          if (previousTab === nextTab) {
            return { tasks: { ...state.tasks, [id]: nextTask } };
          }

          return {
            tasks: { ...state.tasks, [id]: nextTask },
            activeOrder:
              nextTab === "active"
                ? [...removeFrom(state.activeOrder, id), id]
                : removeFrom(state.activeOrder, id),
            archiveOrder:
              nextTab === "archive"
                ? [...removeFrom(state.archiveOrder, id), id]
                : removeFrom(state.archiveOrder, id),
            selectedId: id,
            expandedId: null,
          };
        });
      },

      restoreTask: (id) => {
        const task = get().tasks[id];
        if (!task || !isArchivedStatus(task.status)) return;
        get().updateTask(id, { status: "not-started" });
      },

      deleteTask: (id) => {
        const task = get().tasks[id];
        if (!task || !isArchivedStatus(task.status)) return false;
        set((state) => {
          const tasks = { ...state.tasks };
          delete tasks[id];
          return {
            tasks,
            archiveOrder: removeFrom(state.archiveOrder, id),
            selectedId: state.selectedId === id ? null : state.selectedId,
            expandedId: state.expandedId === id ? null : state.expandedId,
          };
        });
        return true;
      },

      reorderTask: (tab, activeId, overId) => {
        if (activeId === overId) return;
        set((state) => {
          const key = tab === "active" ? "activeOrder" : "archiveOrder";
          const order = state[key];
          const from = order.indexOf(activeId);
          const to = order.indexOf(overId);
          if (from < 0 || to < 0) return {};
          return { [key]: moveItem(order, from, to) };
        });
      },

      moveTask: (tab, id, direction) => {
        set((state) => {
          const key = tab === "active" ? "activeOrder" : "archiveOrder";
          const order = state[key];
          const from = order.indexOf(id);
          if (from < 0) return {};
          const to = Math.min(order.length - 1, Math.max(0, from + direction));
          if (from === to) return {};
          return { [key]: moveItem(order, from, to) };
        });
      },

      sortTasks: (tab, key, direction) => {
        set((state) => {
          const orderKey =
            tab === "active" ? "activeOrder" : "archiveOrder";
          return {
            [orderKey]: sortTaskIds(
              state[orderKey],
              state.tasks,
              key,
              direction,
            ),
          };
        });
      },

      restoreTaskOrder: (tab, order) => {
        set((state) => {
          const orderKey =
            tab === "active" ? "activeOrder" : "archiveOrder";
          const currentOrder = state[orderKey];
          const currentIds = new Set(currentOrder);
          const restored = order.filter((id) => currentIds.has(id));
          const restoredIds = new Set(restored);
          return {
            [orderKey]: [
              ...restored,
              ...currentOrder.filter((id) => !restoredIds.has(id)),
            ],
          };
        });
      },

      setSelectedId: (selectedId) => set({ selectedId }),
      setExpandedId: (expandedId) => set({ expandedId }),

      replaceStateForTests: (state) =>
        set({
          ...state,
          selectedId: state.activeOrder[0] ?? state.archiveOrder[0] ?? null,
          expandedId: null,
        }),
    }),
    {
      name: "seiri.tasks.v1",
      version: 1,
      partialize: (state): PersistedState => ({
        tasks: state.tasks,
        activeOrder: state.activeOrder,
        archiveOrder: state.archiveOrder,
      }),
      migrate: (persisted) => persisted as TaskState,
    },
  ),
);
