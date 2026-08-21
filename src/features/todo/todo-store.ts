import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  demoTasks,
  emptyTaskState,
  isArchivedStatus,
  moveItem,
  sortTaskIds,
  tabForStatus,
} from "@/features/todo/todo-utils";
import type {
  SortDirection,
  Task,
  TaskSortKey,
  TaskStatus,
  TaskTab,
} from "@/features/todo/todo-types";

type PersistedState = {
  tasks: Record<string, Task>;
  activeOrder: string[];
  archiveOrder: string[];
};

type TaskState = PersistedState & {
  isDemoMode: boolean;
  userStateBeforeDemo: PersistedState | null;
  selectedId: string | null;
  expandedId: string | null;
  addTask: () => string;
  discardTaskDraft: (id: string) => boolean;
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
  setDemoMode: (enabled: boolean) => void;
  replaceStateForTests: (state: PersistedState) => void;
};

const initial = emptyTaskState();
const LEGACY_SAMPLE_IDS = new Set([
  "welcome",
  "shortcuts",
  "mobile",
  "archive-demo",
]);

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}`;
}

function removeFrom(items: string[], id: string) {
  return items.filter((item) => item !== id);
}

function persistedState(state: PersistedState): PersistedState {
  return {
    tasks: state.tasks,
    activeOrder: state.activeOrder,
    archiveOrder: state.archiveOrder,
  };
}

function migratePersistedState(
  persisted: unknown,
  version: number,
): PersistedState {
  const state = persisted as Partial<PersistedState>;
  const tasks = { ...(state.tasks ?? {}) };
  if (version < 2) {
    for (const id of LEGACY_SAMPLE_IDS) delete tasks[id];
  }
  return {
    tasks,
    activeOrder: (state.activeOrder ?? []).filter((id) => Boolean(tasks[id])),
    archiveOrder: (state.archiveOrder ?? []).filter((id) => Boolean(tasks[id])),
  };
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      ...initial,
      isDemoMode: false,
      userStateBeforeDemo: null,
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
          activeOrder: [id, ...state.activeOrder],
          selectedId: id,
        }));
        return id;
      },

      discardTaskDraft: (id) => {
        const task = get().tasks[id];
        if (!task || task.title.trim() || isArchivedStatus(task.status)) {
          return false;
        }
        set((state) => {
          const tasks = { ...state.tasks };
          delete tasks[id];
          const activeOrder = removeFrom(state.activeOrder, id);
          return {
            tasks,
            activeOrder,
            selectedId:
              state.selectedId === id
                ? activeOrder[0] ?? null
                : state.selectedId,
            expandedId: state.expandedId === id ? null : state.expandedId,
          };
        });
        return true;
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

      setDemoMode: (enabled) => {
        const state = get();
        if (enabled === state.isDemoMode) return;

        if (enabled) {
          const demo = demoTasks();
          set({
            ...demo,
            isDemoMode: true,
            userStateBeforeDemo: persistedState(state),
            selectedId: demo.activeOrder[0] ?? null,
            expandedId: null,
          });
          return;
        }

        const userState = state.userStateBeforeDemo ?? emptyTaskState();
        set({
          ...userState,
          isDemoMode: false,
          userStateBeforeDemo: null,
          selectedId:
            userState.activeOrder[0] ?? userState.archiveOrder[0] ?? null,
          expandedId: null,
        });
      },

      replaceStateForTests: (state) =>
        set({
          ...state,
          isDemoMode: false,
          userStateBeforeDemo: null,
          selectedId: state.activeOrder[0] ?? state.archiveOrder[0] ?? null,
          expandedId: null,
        }),
    }),
    {
      name: "seiri.tasks.v1",
      version: 2,
      partialize: (state): PersistedState =>
        state.isDemoMode && state.userStateBeforeDemo
          ? state.userStateBeforeDemo
          : persistedState(state),
      migrate: migratePersistedState,
    },
  ),
);
