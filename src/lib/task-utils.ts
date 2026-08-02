import type {
  Estimate,
  EstimateUnit,
  SortDirection,
  Task,
  TaskSortKey,
  TaskStatus,
  TaskTab,
} from "@/types";

export const ESTIMATE_BOUNDS: Record<EstimateUnit, readonly [number, number]> = {
  minutes: [1, 60],
  hours: [1, 24],
  days: [1, 7],
  weeks: [1, 52],
  months: [1, 60],
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  "on-hold": "On hold",
  done: "Done",
  kill: "Kill",
};

export const ESTIMATE_UNITS: EstimateUnit[] = [
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
];

export function normalizeEstimateAmount(
  value: string | number,
  unit: EstimateUnit,
) {
  const parsed = typeof value === "number" ? value : Number(value.trim());
  const [min, max] = ESTIMATE_BOUNDS[unit];
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function formatEstimate(estimate: Estimate) {
  const unit = estimate.amount === 1
    ? estimate.unit.slice(0, -1)
    : estimate.unit;
  return `${estimate.amount} ${unit}`;
}

export function isArchivedStatus(status: TaskStatus) {
  return status === "done" || status === "kill";
}

export function tabForStatus(status: TaskStatus): TaskTab {
  return isArchivedStatus(status) ? "archive" : "active";
}

export function dateToKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function keyToDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dayOrdinal(date: Date) {
  return Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000,
  );
}

export function daysUntil(dateKey: string, today = new Date()) {
  return dayOrdinal(keyToDate(dateKey)) - dayOrdinal(today);
}

export function relativeDueLabel(dateKey: string, today = new Date()) {
  const days = daysUntil(dateKey, today);
  if (days === 0) return "today";
  return `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"}`;
}

export function exactDateLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(keyToDate(dateKey));
}

export function dueAriaLabel(dateKey: string, today = new Date()) {
  const days = daysUntil(dateKey, today);
  const relative =
    days < 0
      ? `${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} overdue`
      : days === 0
        ? "due today"
        : `due in ${days} ${days === 1 ? "day" : "days"}`;
  return `${relative}, ${exactDateLabel(dateKey)}`;
}

export function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

const ESTIMATE_MINUTES: Record<EstimateUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1_440,
  weeks: 10_080,
  months: 43_200,
};

function compareText(left: string, right: string) {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function compareTasks(left: Task, right: Task, key: TaskSortKey) {
  if (key === "priority") return left.priority - right.priority;

  if (key === "title") return compareText(left.title, right.title);

  if (key === "status") {
    return compareText(STATUS_LABELS[left.status], STATUS_LABELS[right.status]);
  }

  if (key === "estimate") {
    if (!left.estimate || !right.estimate) return 0;
    return (
      left.estimate.amount * ESTIMATE_MINUTES[left.estimate.unit] -
      right.estimate.amount * ESTIMATE_MINUTES[right.estimate.unit]
    );
  }

  if (!left.dueOn || !right.dueOn) return 0;
  return left.dueOn.localeCompare(right.dueOn);
}

function isBlankForSort(task: Task, key: TaskSortKey) {
  if (key === "title") return !task.title;
  if (key === "estimate") return !task.estimate;
  if (key === "due") return !task.dueOn;
  return false;
}

export function sortTaskIds(
  ids: string[],
  tasks: Record<string, Task>,
  key: TaskSortKey,
  direction: SortDirection,
) {
  return ids
    .map((id, index) => ({ id, index, task: tasks[id] }))
    .filter((item): item is { id: string; index: number; task: Task } =>
      Boolean(item.task),
    )
    .sort((left, right) => {
      const leftBlank = isBlankForSort(left.task, key);
      const rightBlank = isBlankForSort(right.task, key);
      if (leftBlank !== rightBlank) return leftBlank ? 1 : -1;
      const comparison = compareTasks(left.task, right.task, key);
      return (direction === "asc" ? comparison : -comparison) ||
        left.index - right.index;
    })
    .map(({ id }) => id);
}

function offsetDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateToKey(date);
}

export function seedTasks(): {
  tasks: Record<string, Task>;
  activeOrder: string[];
  archiveOrder: string[];
} {
  const now = new Date().toISOString();
  const list: Task[] = [
    {
      id: "welcome",
      priority: 0,
      title: "Shape the first version",
      status: "in-progress",
      estimate: { amount: 2, unit: "days" },
      dueOn: offsetDate(2),
      description:
        "Keep the first version quiet, useful, and intentionally small.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "shortcuts",
      priority: 1,
      title: "Try the keyboard shortcuts",
      status: "not-started",
      estimate: { amount: 45, unit: "minutes" },
      dueOn: offsetDate(5),
      description: "Press J or K to move, then Enter to open a task.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "mobile",
      priority: 2,
      title: "Check the mobile layout",
      status: "on-hold",
      estimate: { amount: 3, unit: "hours" },
      dueOn: offsetDate(-1),
      description: "Resize the window and make sure every control stays usable.",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "archive-demo",
      priority: 1,
      title: "Archive a completed task",
      status: "done",
      estimate: { amount: 1, unit: "hours" },
      dueOn: offsetDate(-3),
      description: "Archived tasks can still be edited, restored, or deleted.",
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    tasks: Object.fromEntries(list.map((task) => [task.id, task])),
    activeOrder: ["welcome", "shortcuts", "mobile"],
    archiveOrder: ["archive-demo"],
  };
}
