import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CircleHelp,
  ListTodo,
  Plus,
} from "lucide-react";
import { AnimatePresence, MotionConfig } from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Toaster } from "sonner";
import { TaskRow } from "@/components/TaskRow";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { relativeDueLabel, STATUS_LABELS } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/store/task-store";
import type {
  SortDirection,
  Task,
  TaskSortKey,
  TaskTab,
} from "@/types";

const COLUMNS: Array<{ key: TaskSortKey; label: string }> = [
  { key: "priority", label: "pri" },
  { key: "title", label: "title" },
  { key: "status", label: "status" },
  { key: "estimate", label: "estimate" },
  { key: "due", label: "due" },
];

type ActiveSort = {
  key: TaskSortKey;
  direction: SortDirection;
};

function TaskDragPreview({ task }: { task: Task }) {
  return (
    <div className="task-drag-preview" aria-hidden="true">
      <div className="task-main">
        <span className="drag-spacer" />
        <div className="priority-cell">
          <span
            className={cn(
              "priority-trigger",
              `priority-${task.priority}`,
            )}
          >
            {task.priority}
          </span>
        </div>
        <div className="title-cell">
          <span className={cn("title-button", !task.title && "is-empty")}>
            {task.title || "—"}
          </span>
        </div>
        <div className="status-cell">
          <span
            className={cn("status-trigger", `status-${task.status}`)}
          >
            {STATUS_LABELS[task.status]}
          </span>
        </div>
        <div className="estimate-cell">
          <span className="property-trigger estimate-trigger">
            {task.estimate
              ? `${task.estimate.amount} ${task.estimate.unit}`
              : "—"}
          </span>
        </div>
        <div className="due-cell">
          <span className="property-trigger due-trigger">
            {task.dueOn ? relativeDueLabel(task.dueOn) : "—"}
          </span>
        </div>
        <span className="row-actions" />
      </div>
    </div>
  );
}

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.closest(
      "input, textarea, select, [contenteditable='true'], [role='dialog'], [role='listbox']",
    ),
  );
}

export function App() {
  const tasks = useTaskStore((state) => state.tasks);
  const activeOrder = useTaskStore((state) => state.activeOrder);
  const archiveOrder = useTaskStore((state) => state.archiveOrder);
  const selectedId = useTaskStore((state) => state.selectedId);
  const expandedId = useTaskStore((state) => state.expandedId);
  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const reorderTask = useTaskStore((state) => state.reorderTask);
  const moveTask = useTaskStore((state) => state.moveTask);
  const sortTasks = useTaskStore((state) => state.sortTasks);
  const restoreTaskOrder = useTaskStore((state) => state.restoreTaskOrder);
  const setSelectedId = useTaskStore((state) => state.setSelectedId);
  const setExpandedId = useTaskStore((state) => state.setExpandedId);
  const [tab, setTab] = useState<TaskTab>("active");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [sorts, setSorts] = useState<Record<TaskTab, ActiveSort | null>>({
    active: null,
    archive: null,
  });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const defaultOrders = useRef<Partial<Record<TaskTab, string[]>>>({});

  const ids = tab === "active" ? activeOrder : archiveOrder;
  const sort = sorts[tab];
  const activeDragTask = activeDragId ? tasks[activeDragId] : null;
  const visibleIds = useMemo(
    () => ids.filter((id) => Boolean(tasks[id])),
    [ids, tasks],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const createTask = useCallback(() => {
    const id = addTask();
    setTab("active");
    setEditingTitleId(id);
  }, [addTask]);

  const clearSort = useCallback((targetTab: TaskTab) => {
    delete defaultOrders.current[targetTab];
    setSorts((current) => ({ ...current, [targetTab]: null }));
  }, []);

  useEffect(() => {
    if (selectedId && visibleIds.includes(selectedId)) return;
    setSelectedId(visibleIds[0] ?? null);
  }, [selectedId, setSelectedId, visibleIds]);

  useEffect(
    () => () => document.body.classList.remove("is-dragging-task"),
    [],
  );

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();

      if (key === "n") {
        event.preventDefault();
        createTask();
        return;
      }

      if (!selectedId) return;
      const index = visibleIds.indexOf(selectedId);

      if (key === "j" || key === "k") {
        event.preventDefault();
        const delta = key === "j" ? 1 : -1;
        const next = visibleIds[
          Math.min(visibleIds.length - 1, Math.max(0, index + delta))
        ];
        if (next) {
          setSelectedId(next);
          document
            .querySelector<HTMLElement>(`[data-task-id="${next}"]`)
            ?.querySelector<HTMLElement>(".task-card")
            ?.focus();
        }
      } else if (key === "e") {
        event.preventDefault();
        setEditingTitleId(selectedId);
      } else if (event.key === "Enter") {
        event.preventDefault();
        setExpandedId(expandedId === selectedId ? null : selectedId);
      } else if (
        event.shiftKey &&
        (event.key === "ArrowUp" || event.key === "ArrowDown")
      ) {
        event.preventDefault();
        clearSort(tab);
        moveTask(tab, selectedId, event.key === "ArrowUp" ? -1 : 1);
      } else if (event.shiftKey && event.key === "Delete") {
        event.preventDefault();
        updateTask(selectedId, { status: "kill" });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clearSort,
    createTask,
    expandedId,
    moveTask,
    selectedId,
    setExpandedId,
    setSelectedId,
    tab,
    updateTask,
    visibleIds,
  ]);

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(`${event.active.id}`);
    document.body.classList.add("is-dragging-task");
  }

  function finishDrag() {
    setActiveDragId(null);
    document.body.classList.remove("is-dragging-task");
  }

  function handleDragEnd(event: DragEndEvent) {
    finishDrag();
    if (!event.over) return;
    clearSort(tab);
    reorderTask(tab, `${event.active.id}`, `${event.over.id}`);
  }

  function handleTabChange(value: TaskTab) {
    setTab(value);
  }

  function handleSort(key: TaskSortKey) {
    if (sort?.key === key && sort.direction === "desc") {
      restoreTaskOrder(tab, defaultOrders.current[tab] ?? visibleIds);
      clearSort(tab);
      return;
    }

    if (!sort) defaultOrders.current[tab] = [...visibleIds];
    const direction =
      sort?.key === key && sort.direction === "asc" ? "desc" : "asc";
    sortTasks(tab, key, direction);
    setSorts((current) => ({
      ...current,
      [tab]: { key, direction },
    }));
  }

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delay={350}>
        <main className="app-shell">
          <section className="workspace" aria-label="Todo list">
            <header className="workspace-header">
              <h1>todo</h1>
            </header>

            <Tabs
              value={tab}
              onValueChange={(value) => handleTabChange(value as TaskTab)}
            >
              <div className="tab-row">
                <TabsList aria-label="Task views">
                  <TabsTrigger value="active">
                    <ListTodo />
                    Active
                    <span>{activeOrder.length}</span>
                  </TabsTrigger>
                  <TabsTrigger value="archive">
                    <Archive />
                    Archive
                    <span>{archiveOrder.length}</span>
                  </TabsTrigger>
                </TabsList>
                <div className="tab-actions">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          className="shortcut-help"
                          type="button"
                          aria-label="Keyboard shortcuts"
                        >
                          <CircleHelp />
                        </button>
                      }
                    />
                    <TooltipContent
                      side="bottom"
                      align="end"
                      className="shortcut-tooltip"
                    >
                      <strong>Keyboard</strong>
                      <span>N · new task</span>
                      <span>J / K · move</span>
                      <span>Enter · description</span>
                      <span>E · edit title</span>
                      <span>Shift + ↑ / ↓ · reorder</span>
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    size="sm"
                    className="new-task-button"
                    onClick={createTask}
                  >
                    <Plus />
                    New task
                  </Button>
                </div>
              </div>

              <div className="column-labels">
                <span />
                {COLUMNS.map(({ key, label }) => {
                  const active = sort?.key === key;
                  const nextDirection = !active
                    ? "ascending"
                    : sort.direction === "asc"
                      ? "descending"
                      : "off";
                  return (
                    <button
                      key={key}
                      type="button"
                      className={active ? "is-sorted" : undefined}
                      aria-label={
                        nextDirection === "off"
                          ? `Turn off ${label} sorting`
                          : `Sort by ${label} ${nextDirection}`
                      }
                      onClick={() => handleSort(key)}
                    >
                      {label}
                      <span className="sort-indicator" aria-hidden="true">
                        {active &&
                          (sort.direction === "asc" ? (
                            <ArrowUp />
                          ) : (
                            <ArrowDown />
                          ))}
                      </span>
                    </button>
                  );
                })}
                <span />
              </div>

              <TabsContent value={tab} className="task-list">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={finishDrag}
                >
                  <SortableContext
                    items={visibleIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <AnimatePresence initial={false} mode="popLayout">
                      {visibleIds.map((id) => {
                        const task = tasks[id];
                        if (!task) return null;
                        return (
                          <div key={id} data-task-id={id}>
                            <TaskRow
                              task={task}
                              tab={tab}
                              selected={selectedId === id}
                              expanded={expandedId === id}
                              editTitleRequested={editingTitleId === id}
                              onEditTitleHandled={() =>
                                setEditingTitleId(null)
                              }
                            />
                          </div>
                        );
                      })}
                    </AnimatePresence>
                  </SortableContext>
                  <DragOverlay
                    adjustScale={false}
                    dropAnimation={{ duration: 160, easing: "ease-out" }}
                  >
                    {activeDragTask ? (
                      <TaskDragPreview task={activeDragTask} />
                    ) : null}
                  </DragOverlay>
                </DndContext>

                {visibleIds.length === 0 && (
                  <div className="empty-state">
                    {tab === "active" ? <ListTodo /> : <Archive />}
                    <p>
                      {tab === "active"
                        ? "Nothing active. Enjoy the quiet."
                        : "The archive is empty."}
                    </p>
                    {tab === "active" && (
                      <Button variant="subtle" size="sm" onClick={createTask}>
                        <Plus />
                        Add a task
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <footer>
              <span>Stored on this device</span>
              <span aria-hidden="true">·</span>
              <span>Made with simplicity in mind</span>
            </footer>
          </section>
        </main>
        <Toaster
          theme="dark"
          position="bottom-center"
          toastOptions={{
            style: {
              background: "#222326",
              border: "1px solid rgba(255,255,255,.1)",
              color: "#f4f4f5",
            },
          }}
        />
      </TooltipProvider>
    </MotionConfig>
  );
}
