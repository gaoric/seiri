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
  Sparkles,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useAnimate,
  useReducedMotion,
} from "motion/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { TaskRow } from "@/features/todo/components/TaskRow";
import { Button } from "@/shared/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/ui/tooltip";
import type { UiSounds } from "@/shared/sound";
import {
  formatEstimate,
  isArchivedStatus,
  relativeDueLabel,
  STATUS_LABELS,
} from "@/features/todo/todo-utils";
import { cn } from "@/shared/ui/utils";
import { useTaskStore } from "@/features/todo/todo-store";
import type {
  SortDirection,
  Task,
  TaskSortKey,
  TaskTab,
} from "@/features/todo/todo-types";

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

type CreationAnimation = {
  taskId: string;
  orbDistance: number;
};

type CompletionAnimation = {
  taskId: string;
  stage: "collapsing" | "traveling";
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
  targetX: number;
  targetY: number;
};

type ArchiveTwinkle = {
  id: number;
  x: number;
  y: number;
};

type ScopedAnimator = ReturnType<typeof useAnimate>[1];

/**
 * Runs the shared VHS/CRT shutdown used by both terminal task states.
 *
 * The card becomes a blinking hologram, burns to white from its center, then
 * squeezes vertically and horizontally into an overlapping scan-line collapse.
 * Kill lets that line collapse completely; Done subsequently emits a circular
 * orb for its Archive flight. The row shell itself is never resized, so
 * neighboring tasks close the gap only after the status update is committed.
 */
function runVhsShutdown(
  animate: ScopedAnimator,
  selector: string,
) {
  return animate([
    [
      `${selector} .task-transition-hologram`,
      { opacity: [0, 0.78, 0.16, 0.82, 0.18, 0] },
      {
        duration: 0.51,
        ease: "linear",
        times: [0, 0.12, 0.3, 0.5, 0.72, 1],
      },
    ],
    [
      `${selector} .task-card`,
      {
        opacity: [1, 0.3, 1, 0.28, 0.58],
        filter: [
          "brightness(1)",
          "brightness(1.8) saturate(0.5)",
          "brightness(1.15) saturate(0.7)",
          "brightness(1.9) saturate(0.4)",
          "brightness(1.45) saturate(0.45)",
        ],
      },
      { at: 0, duration: 0.51, ease: "linear" },
    ],
    [
      `${selector} .task-vhs-flash`,
      {
        opacity: [0, 0.92, 1],
        scaleX: [0.035, 0.38, 1],
        scaleY: [0.08, 0.5, 1],
      },
      { at: 0.51, duration: 0.15, ease: [0.2, 0.8, 0.25, 1] },
    ],
    [
      `${selector} .task-card`,
      {
        opacity: [0.58, 0.34, 0],
        filter: [
          "brightness(1.45) saturate(0.45)",
          "brightness(2.3) saturate(0.35)",
          "brightness(3) saturate(0)",
        ],
      },
      { at: 0.51, duration: 0.15, ease: "easeIn" },
    ],
    [
      `${selector} .task-vhs-flash`,
      {
        scaleY: [1, 0.12, 0.045],
        filter: [
          "brightness(1)",
          "brightness(1.35)",
          "brightness(1.8)",
        ],
      },
      { at: 0.66, duration: 0.33, ease: [0.55, 0, 0.72, 0.35] },
    ],
    [
      `${selector} .task-vhs-flash`,
      {
        opacity: [1, 1, 0.72, 0],
        scaleX: [1, 0.42, 0.1, 0.006],
      },
      { at: 0.93, duration: 0.23, ease: [0.4, 0, 0.82, 0.35] },
    ],
  ]);
}

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
              ? formatEstimate(task.estimate)
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

export type TodoSoundEffects = Pick<
  UiSounds,
  | "playConfirmation"
  | "playHologramOff"
  | "playHologramOn"
  | "playNewTaskDrop"
  | "playVhsShutdown"
>;

type TodoToolProps = {
  soundEffects: TodoSoundEffects;
};

export function TodoTool({ soundEffects }: TodoToolProps) {
  const [animationScope, animate] = useAnimate<HTMLDivElement>();
  const prefersReducedMotion = useReducedMotion();
  const {
    playConfirmation,
    playHologramOff,
    playHologramOn,
    playNewTaskDrop,
    playVhsShutdown,
  } = soundEffects;
  const tasks = useTaskStore((state) => state.tasks);
  const activeOrder = useTaskStore((state) => state.activeOrder);
  const archiveOrder = useTaskStore((state) => state.archiveOrder);
  const selectedId = useTaskStore((state) => state.selectedId);
  const expandedId = useTaskStore((state) => state.expandedId);
  const isDemoMode = useTaskStore((state) => state.isDemoMode);
  const addTask = useTaskStore((state) => state.addTask);
  const discardTaskDraft = useTaskStore((state) => state.discardTaskDraft);
  const updateTask = useTaskStore((state) => state.updateTask);
  const reorderTask = useTaskStore((state) => state.reorderTask);
  const moveTask = useTaskStore((state) => state.moveTask);
  const sortTasks = useTaskStore((state) => state.sortTasks);
  const restoreTaskOrder = useTaskStore((state) => state.restoreTaskOrder);
  const setSelectedId = useTaskStore((state) => state.setSelectedId);
  const setExpandedId = useTaskStore((state) => state.setExpandedId);
  const setDemoMode = useTaskStore((state) => state.setDemoMode);
  const [tab, setTab] = useState<TaskTab>("active");
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [newTaskDraftId, setNewTaskDraftId] = useState<string | null>(null);
  const [creationAnimation, setCreationAnimation] =
    useState<CreationAnimation | null>(null);
  const [cancelingDraftId, setCancelingDraftId] = useState<string | null>(null);
  const [killingTaskId, setKillingTaskId] = useState<string | null>(null);
  const [completionAnimation, setCompletionAnimation] =
    useState<CompletionAnimation | null>(null);
  const [archiveTwinkle, setArchiveTwinkle] =
    useState<ArchiveTwinkle | null>(null);
  const [sorts, setSorts] = useState<Record<TaskTab, ActiveSort | null>>({
    active: null,
    archive: null,
  });
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const defaultOrders = useRef<Partial<Record<TaskTab, string[]>>>({});
  const newTaskButtonRef = useRef<HTMLButtonElement>(null);
  const archiveTabRef = useRef<HTMLButtonElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);

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
    if (creationAnimation) return;

    playNewTaskDrop();
    const buttonRect = newTaskButtonRef.current?.getBoundingClientRect();
    const listRect = taskListRef.current?.getBoundingClientRect();
    const orbDistance = buttonRect && listRect
      ? Math.max(
          72,
          listRect.top + 53 - (buttonRect.top + buttonRect.height / 2),
        )
      : 120;
    const id = addTask();
    setTab("active");
    setNewTaskDraftId(id);
    setEditingTitleId(id);
    setCreationAnimation({ taskId: id, orbDistance });
  }, [addTask, creationAnimation, playNewTaskDrop]);

  const requestKill = useCallback(
    (id: string) => {
      const task = useTaskStore.getState().tasks[id];
      if (
        !task ||
        task.status === "kill" ||
        killingTaskId ||
        completionAnimation
      ) {
        return;
      }
      if (isArchivedStatus(task.status)) {
        updateTask(id, { status: "kill" });
        return;
      }
      setKillingTaskId(id);
    },
    [completionAnimation, killingTaskId, updateTask],
  );

  const requestDone = useCallback(
    (id: string) => {
      const task = useTaskStore.getState().tasks[id];
      if (
        !task ||
        isArchivedStatus(task.status) ||
        killingTaskId ||
        completionAnimation
      ) {
        return;
      }

      const row = document.querySelector<HTMLElement>(
        `[data-task-id="${id}"] .task-card`,
      );
      const rowRect = row?.getBoundingClientRect();
      const archiveRect = archiveTabRef.current?.getBoundingClientRect();
      if (prefersReducedMotion || !rowRect || !archiveRect) {
        updateTask(id, { status: "done" });
        toast("Task completed", {
          action: {
            label: "Undo",
            onClick: () => updateTask(id, { status: task.status }),
          },
        });
        return;
      }

      const startX = rowRect.left + rowRect.width / 2;
      const startY = rowRect.top + rowRect.height / 2;
      const targetX = archiveRect.left + archiveRect.width / 2;
      const targetY = archiveRect.top + archiveRect.height / 2;
      setCompletionAnimation({
        taskId: id,
        stage: "collapsing",
        startX,
        startY,
        deltaX: targetX - startX,
        deltaY: targetY - startY,
        targetX,
        targetY,
      });
    },
    [completionAnimation, killingTaskId, prefersReducedMotion, updateTask],
  );

  const finishKill = useCallback(
    (id: string) => {
      const task = useTaskStore.getState().tasks[id];
      if (!task) {
        setKillingTaskId(null);
        return;
      }
      const previousStatus = task.status;
      updateTask(id, { status: "kill" });
      setKillingTaskId(null);
      toast("Task archived", {
        action: {
          label: "Undo",
          onClick: () => updateTask(id, { status: previousStatus }),
        },
      });
    },
    [updateTask],
  );

  const startCompletionTravel = useCallback((id: string) => {
    setCompletionAnimation((current) =>
      current?.taskId === id && current.stage === "collapsing"
        ? { ...current, stage: "traveling" }
        : current,
    );
  }, []);

  useEffect(() => {
    const completingId =
      completionAnimation?.stage === "collapsing"
        ? completionAnimation.taskId
        : null;
    const id = killingTaskId ?? completingId;
    if (!id) return;

    const completing = Boolean(completingId);
    const selector = completing
      ? ".task-life-cycle.is-completing"
      : ".task-life-cycle.is-killing";
    playHologramOff();
    const vhsSoundTimer = window.setTimeout(playVhsShutdown, 510);
    const controls = runVhsShutdown(animate, selector);
    controls.then(() => {
      if (completing) startCompletionTravel(id);
      else finishKill(id);
    });
    return () => {
      window.clearTimeout(vhsSoundTimer);
      controls.stop();
    };
  }, [
    animate,
    completionAnimation,
    finishKill,
    killingTaskId,
    playHologramOff,
    playVhsShutdown,
    startCompletionTravel,
  ]);

  const finishCompletion = useCallback(
    (animation: CompletionAnimation) => {
      const task = useTaskStore.getState().tasks[animation.taskId];
      if (!task) {
        setCompletionAnimation(null);
        return;
      }

      const previousStatus = task.status;
      updateTask(animation.taskId, { status: "done" });
      setCompletionAnimation(null);
      setArchiveTwinkle({
        id: Date.now(),
        x: animation.targetX,
        y: animation.targetY,
      });
      playConfirmation();
      toast("Task completed", {
        action: {
          label: "Undo",
          onClick: () =>
            updateTask(animation.taskId, { status: previousStatus }),
        },
      });
    },
    [playConfirmation, updateTask],
  );

  const finishDraftCancellation = useCallback(
    (id: string) => {
      discardTaskDraft(id);
      setCancelingDraftId(null);
      setNewTaskDraftId((current) => (current === id ? null : current));
    },
    [discardTaskDraft],
  );

  useEffect(() => {
    if (!creationAnimation) return;
    if (prefersReducedMotion) {
      setExpandedId(creationAnimation.taskId);
      setCreationAnimation(null);
      return;
    }

    const orbDistance = creationAnimation.orbDistance;
    const hologramSoundTimer = window.setTimeout(playHologramOn, 620);
    const controls = animate([
      [
        ".new-task-button",
        {
          opacity: [1, 0],
          clipPath: [
            "inset(0 0 0 0 round 6px)",
            "inset(50% 50% 50% 50% round 50%)",
          ],
        },
        { duration: 0.18, ease: "easeIn" },
      ],
      [
        ".new-task-light-orb",
        {
          opacity: [0, 1, 1, 0.9, 0],
          scale: [0.35, 1, 0.85, 1.15, 0.2],
          y: [
            0,
            orbDistance * 0.12,
            orbDistance * 0.55,
            orbDistance * 0.9,
            orbDistance,
          ],
        },
        {
          at: 0.08,
          duration: 0.56,
          ease: [0.34, 0.02, 0.58, 1],
          times: [0, 0.12, 0.72, 0.9, 1],
        },
      ],
      [
        ".task-row-shell.is-materializing",
        {
          opacity: [0, 0.35, 1],
          clipPath: [
            "inset(100% 0 0 0 round 9px)",
            "inset(44% 0 0 0 round 9px)",
            "inset(0 0 0 0 round 9px)",
          ],
          filter: [
            "brightness(1.7) saturate(0.6)",
            "brightness(1.35) saturate(0.72)",
            "brightness(1.22) saturate(0.8)",
          ],
        },
        { at: 0.62, duration: 0.26, ease: "easeOut" },
      ],
      [
        ".new-task-hologram",
        {
          opacity: [0, 0.9, 0.55, 0.18, 0],
          clipPath: [
            "inset(100% 0 0 0 round 9px)",
            "inset(58% 0 0 0 round 9px)",
            "inset(0 0 0 0 round 9px)",
            "inset(0 0 0 0 round 9px)",
            "inset(0 0 0 0 round 9px)",
          ],
        },
        { at: 0.62, duration: 0.8, ease: "linear" },
      ],
      [
        ".task-row-shell.is-materializing",
        { opacity: [1, 0.2, 1, 0.24, 1], filter: "none" },
        {
          at: 0.9,
          duration: 0.51,
          ease: "linear",
        },
      ],
      [
        ".new-task-button",
        {
          opacity: [1, 1],
          clipPath: [
            "inset(0 100% 0 0 round 6px)",
            "inset(0 0 0 0 round 6px)",
          ],
          filter: [
            "brightness(1.7) drop-shadow(0 0 7px rgba(194, 230, 255, 0.7))",
            "brightness(1) drop-shadow(0 0 0 rgba(194, 230, 255, 0))",
          ],
        },
        { at: 1.33, duration: 0.24, ease: "easeOut" },
      ],
      [
        ".new-task-button-loader",
        {
          opacity: [0, 0.9, 0],
          scaleX: [0, 1, 1],
        },
        {
          at: 1.33,
          duration: 0.24,
          ease: "easeOut",
          times: [0, 0.72, 1],
        },
      ],
      [
        ".new-task-button",
        {
          opacity: [1, 0.22, 1, 0.22, 1],
          filter: [
            "brightness(1)",
            "brightness(1.8)",
            "brightness(1)",
            "brightness(1.8)",
            "brightness(1)",
          ],
        },
        { at: 1.59, duration: 0.2, ease: "linear" },
      ],
      [
        ".new-task-button",
        { opacity: [1, 1] },
        { at: 1.79, duration: 0.14, ease: "linear" },
      ],
    ]);

    let canceled = false;
    controls.then(() => {
      if (canceled) return;
      if (useTaskStore.getState().tasks[creationAnimation.taskId]) {
        setExpandedId(creationAnimation.taskId);
      }
      setCreationAnimation((current) =>
        current?.taskId === creationAnimation.taskId ? null : current,
      );
    });
    return () => {
      canceled = true;
      window.clearTimeout(hologramSoundTimer);
      controls.stop();
      const button = newTaskButtonRef.current;
      button?.style.removeProperty("opacity");
      button?.style.removeProperty("clip-path");
      button?.style.removeProperty("filter");
    };
  }, [
    animate,
    creationAnimation,
    playHologramOn,
    prefersReducedMotion,
    setExpandedId,
  ]);

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
        requestKill(selectedId);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clearSort,
    createTask,
    expandedId,
    moveTask,
    requestKill,
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
    if (value === tab) return;
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

  function handleDemoModeToggle() {
    setDemoMode(!isDemoMode);
    setTab("active");
    setEditingTitleId(null);
    setNewTaskDraftId(null);
    setCreationAnimation(null);
    setCancelingDraftId(null);
    setKillingTaskId(null);
    setCompletionAnimation(null);
    setArchiveTwinkle(null);
    setActiveDragId(null);
    setSorts({ active: null, archive: null });
    defaultOrders.current = {};
    document.body.classList.remove("is-dragging-task");
  }

  return (
    <div ref={animationScope} className="todo-tool" aria-label="Todo list">
      <Tabs
              value={tab}
              onValueChange={(value) => handleTabChange(value as TaskTab)}
            >
              <div className="tab-row">
                <TabsList aria-label="Task views">
                  <TabsTrigger value="active" data-ui-sound="open">
                    <ListTodo />
                    Active
                    <span>{activeOrder.length}</span>
                  </TabsTrigger>
                  <TabsTrigger
                    ref={archiveTabRef}
                    value="archive"
                    data-ui-sound="open"
                    className={cn(
                      (completionAnimation || archiveTwinkle) &&
                        "is-absorbing",
                    )}
                  >
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
                  <div
                    className={cn(
                      "new-task-launcher",
                      creationAnimation && "is-creating",
                    )}
                  >
                    <Button
                      key={creationAnimation ? "creating" : "idle"}
                      ref={newTaskButtonRef}
                      size="sm"
                      className="new-task-button"
                      data-ui-sound="custom"
                      onClick={createTask}
                      disabled={Boolean(creationAnimation)}
                    >
                      <Plus />
                      New task
                    </Button>
                    {creationAnimation && (
                      <>
                        <span
                          className="new-task-light-orb"
                          aria-hidden="true"
                        />
                        <span
                          className="new-task-button-loader"
                          aria-hidden="true"
                        />
                      </>
                    )}
                  </div>
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
                      data-ui-sound={
                        active && sort.direction === "desc" ? "close" : "open"
                      }
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

              <TabsContent
                ref={taskListRef}
                value={tab}
                className="task-list"
              >
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
                        const isCanceling = cancelingDraftId === id;
                        const isKilling = killingTaskId === id;
                        const isCompleting =
                          completionAnimation?.taskId === id;
                        const isCompletionCollapsing =
                          isCompleting &&
                          completionAnimation?.stage === "collapsing";
                        return (
                          <motion.div
                            key={id}
                            data-task-id={id}
                            layout="position"
                            transition={{
                              layout: {
                                duration: 0.34,
                                ease: [0.22, 1, 0.36, 1],
                              },
                            }}
                            className={cn(
                              "task-row-shell",
                              creationAnimation?.taskId === id &&
                                "is-materializing",
                            )}
                          >
                            <motion.div
                              className={cn(
                                "task-life-cycle",
                                isCanceling && "is-canceling",
                                isKilling && "is-killing",
                                isCompleting && "is-completing",
                              )}
                              initial={{ opacity: 1 }}
                              animate={
                                isCanceling
                                  ? { opacity: 0 }
                                  : { opacity: 1 }
                              }
                              transition={
                                isCanceling
                                  ? { duration: 0.18, ease: "easeOut" }
                                  : { duration: 0.12, ease: "easeOut" }
                              }
                              onAnimationComplete={() => {
                                if (isCanceling) finishDraftCancellation(id);
                              }}
                            >
                              <TaskRow
                                task={task}
                                tab={tab}
                                selected={selectedId === id}
                                expanded={expandedId === id}
                                statusOverride={
                                  isKilling
                                    ? "kill"
                                    : isCompleting
                                      ? "done"
                                      : undefined
                                }
                                editTitleRequested={editingTitleId === id}
                                newTaskDraft={newTaskDraftId === id}
                                onEditTitleHandled={() =>
                                  setEditingTitleId(null)
                                }
                                onNewTaskDraftFinished={() =>
                                  setNewTaskDraftId((current) =>
                                    current === id ? null : current,
                                  )
                                }
                                onNewTaskDraftCanceled={() => {
                                  setCancelingDraftId(id);
                                  setCreationAnimation((current) =>
                                    current?.taskId === id ? null : current,
                                  );
                                }}
                                onKillRequested={() => requestKill(id)}
                                onDoneRequested={() => requestDone(id)}
                              />
                              {creationAnimation?.taskId === id && (
                                <span
                                  className="new-task-hologram"
                                  aria-hidden="true"
                                />
                              )}
                              {(isKilling || isCompletionCollapsing) && (
                                <>
                                  <span
                                    className="task-transition-hologram"
                                    aria-hidden="true"
                                  />
                                  <span
                                    className="task-vhs-flash"
                                    aria-hidden="true"
                                  />
                                </>
                              )}
                            </motion.div>
                          </motion.div>
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
                      <div className="empty-state-actions">
                        <Button
                          variant="subtle"
                          size="sm"
                          className="empty-state-action"
                          data-ui-sound="custom"
                          onClick={createTask}
                        >
                          <Plus />
                          Add a task
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="empty-state-action try-demo-button"
                          onClick={handleDemoModeToggle}
                        >
                          <Sparkles />
                          Try demo
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {completionAnimation?.stage === "traveling" && (
              <motion.span
                key={completionAnimation.taskId}
                className="task-complete-light-orb"
                aria-hidden="true"
                style={{
                  left: completionAnimation.startX,
                  top: completionAnimation.startY,
                }}
                initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                animate={{
                  opacity: [1, 1, 1, 0],
                  scale: [1, 1.06, 0.72, 0.2],
                  x: [0, 0, completionAnimation.deltaX, completionAnimation.deltaX],
                  y: [0, 0, completionAnimation.deltaY, completionAnimation.deltaY],
                }}
                transition={{
                  duration: 1.22,
                  ease: [0.42, 0, 0.24, 1],
                  times: [0, 0.12, 0.9, 1],
                }}
                onAnimationComplete={() =>
                  finishCompletion(completionAnimation)
                }
              />
            )}

            {archiveTwinkle && (
              <motion.span
                key={archiveTwinkle.id}
                className="archive-twinkle"
                aria-hidden="true"
                style={{ left: archiveTwinkle.x, top: archiveTwinkle.y }}
                initial={{ opacity: 0, scale: 0.2, rotate: -20 }}
                animate={{
                  opacity: [0, 1, 0.7, 0],
                  scale: [0.2, 1.4, 0.8, 0],
                  rotate: [-20, 0, 12, 20],
                }}
                transition={{ duration: 0.38, ease: "easeOut" }}
                onAnimationComplete={() => setArchiveTwinkle(null)}
              />
            )}

      <footer>
        <span>
          {isDemoMode
            ? "Demo changes reset on refresh"
            : "Stored on this device"}
        </span>
        <span aria-hidden="true">·</span>
        <span>Made with simplicity in mind</span>
      </footer>
      <button
        className={cn("demo-mode-toggle", isDemoMode && "is-active")}
        type="button"
        aria-label={isDemoMode ? "Exit demo mode" : "Enter demo mode"}
        aria-pressed={isDemoMode}
        onClick={handleDemoModeToggle}
      >
        <Sparkles />
        <span>{isDemoMode ? "Exit demo" : "Demo mode"}</span>
      </button>
    </div>
  );
}
