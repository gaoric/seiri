export type Priority = 0 | 1 | 2;

export type TaskStatus =
  | "not-started"
  | "in-progress"
  | "on-hold"
  | "done"
  | "kill";

export type EstimateUnit =
  | "minutes"
  | "hours"
  | "days"
  | "weeks"
  | "months";

export type Estimate = {
  amount: number;
  unit: EstimateUnit;
};

export type Task = {
  id: string;
  priority: Priority;
  title: string;
  status: TaskStatus;
  estimate: Estimate | null;
  dueOn: string | null;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskTab = "active" | "archive";

export type TaskSortKey =
  | "priority"
  | "title"
  | "status"
  | "estimate"
  | "due";

export type SortDirection = "asc" | "desc";
