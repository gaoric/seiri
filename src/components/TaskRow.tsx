import {
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  GripVertical,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type TouchEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { DueDateEditor } from "@/components/DueDateEditor";
import { EstimateEditor } from "@/components/EstimateEditor";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogActions,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requestUiSound } from "@/hooks/use-ui-sounds";
import { isArchivedStatus, STATUS_LABELS } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/store/task-store";
import type { Priority, Task, TaskStatus, TaskTab } from "@/types";

type TaskRowProps = {
  task: Task;
  tab: TaskTab;
  selected: boolean;
  expanded: boolean;
  statusOverride?: TaskStatus;
  editTitleRequested: boolean;
  newTaskDraft: boolean;
  onEditTitleHandled: () => void;
  onNewTaskDraftFinished: () => void;
  onNewTaskDraftCanceled: () => void;
  onKillRequested: () => void;
  onDoneRequested: () => void;
};

const STATUSES = Object.keys(STATUS_LABELS) as TaskStatus[];

export function TaskRow({
  task,
  tab,
  selected,
  expanded,
  statusOverride,
  editTitleRequested,
  newTaskDraft,
  onEditTitleHandled,
  onNewTaskDraftFinished,
  onNewTaskDraftCanceled,
  onKillRequested,
  onDoneRequested,
}: TaskRowProps) {
  const updateTask = useTaskStore((state) => state.updateTask);
  const restoreTask = useTaskStore((state) => state.restoreTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const setSelectedId = useTaskStore((state) => state.setSelectedId);
  const setExpandedId = useTaskStore((state) => state.setExpandedId);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [descriptionDraft, setDescriptionDraft] = useState(task.description);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const taskRef = useRef<HTMLElement>(null);
  const cancelDraftRef = useRef(onNewTaskDraftCanceled);
  const draftChangedRef = useRef(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  const displayTitle = task.title || "—";
  const displayStatus = statusOverride ?? task.status;

  useEffect(() => setTitleDraft(task.title), [task.title]);
  useEffect(() => {
    if (expanded) setDescriptionDraft(task.description);
  }, [expanded, task.description]);

  useEffect(() => {
    if (!editTitleRequested) return;
    setEditingTitle(true);
    onEditTitleHandled();
  }, [editTitleRequested, onEditTitleHandled]);

  useEffect(() => {
    if (!editingTitle) return;
    titleRef.current?.focus();
    titleRef.current?.select();
  }, [editingTitle]);

  useEffect(() => {
    cancelDraftRef.current = onNewTaskDraftCanceled;
  }, [onNewTaskDraftCanceled]);

  useLayoutEffect(() => {
    if (!expanded || !descriptionRef.current) return;
    descriptionRef.current.style.height = "auto";
    const borderHeight =
      descriptionRef.current.offsetHeight -
      descriptionRef.current.clientHeight;
    descriptionRef.current.style.height =
      `${descriptionRef.current.scrollHeight + borderHeight}px`;
  }, [descriptionDraft, expanded]);

  useEffect(() => {
    if (!expanded) return;

    function saveWhenClickingOutside(event: globalThis.PointerEvent) {
      if (
        !(event.target instanceof Node) ||
        taskRef.current?.contains(event.target)
      ) {
        return;
      }
      const description = descriptionDraft.trim();
      if (description !== task.description) finishChangedDraft();
      updateTask(task.id, { description });
      setExpandedId(null);
    }

    document.addEventListener("pointerdown", saveWhenClickingOutside);
    return () =>
      document.removeEventListener("pointerdown", saveWhenClickingOutside);
  }, [
    descriptionDraft,
    expanded,
    setExpandedId,
    task.description,
    task.id,
    updateTask,
  ]);

  useEffect(() => {
    if (!newTaskDraft) return;

    function cancelUntouchedDraftOnOutsideClick(event: globalThis.MouseEvent) {
      const eventPath = event.composedPath();
      const clickedOwnedEditor = eventPath.some(
        (target) =>
          target instanceof HTMLElement &&
          target.dataset.taskEditorFor === task.id,
      );
      if (
        draftChangedRef.current ||
        (taskRef.current && eventPath.includes(taskRef.current)) ||
        clickedOwnedEditor
      ) {
        return;
      }
      cancelDraftRef.current();
    }

    // The listener starts on the next event cycle so the click that created
    // this row cannot bubble into it and cancel its own draft.
    const activationTimer = window.setTimeout(() => {
      document.addEventListener("click", cancelUntouchedDraftOnOutsideClick);
    }, 0);
    return () => {
      window.clearTimeout(activationTimer);
      document.removeEventListener(
        "click",
        cancelUntouchedDraftOnOutsideClick,
      );
    };
  }, [newTaskDraft, task.id]);

  function finishChangedDraft() {
    if (!newTaskDraft || draftChangedRef.current) return;
    draftChangedRef.current = true;
    onNewTaskDraftFinished();
  }

  function saveTitle(finishBlankDraft = true) {
    const title = titleDraft.trim();
    const titleChanged = title !== task.title;
    updateTask(task.id, { title });
    if (newTaskDraft && (finishBlankDraft || titleChanged)) {
      finishChangedDraft();
    }
    setEditingTitle(false);
  }

  function saveTitleOnBlur() {
    saveTitle(false);
  }

  function cancelTitle() {
    if (newTaskDraft) {
      onNewTaskDraftCanceled();
      return;
    }
    setTitleDraft(task.title);
    setEditingTitle(false);
  }

  function changeStatus(status: TaskStatus | null) {
    if (!status) return;
    if (status !== task.status) finishChangedDraft();
    if (status === "done" && !isArchivedStatus(task.status)) {
      onDoneRequested();
      return;
    }
    if (status === "kill" && !isArchivedStatus(task.status)) {
      onKillRequested();
      return;
    }
    const previousStatus = task.status;
    updateTask(task.id, { status });
    if (!isArchivedStatus(previousStatus) && isArchivedStatus(status)) {
      toast(status === "done" ? "Task completed" : "Task archived", {
        action: {
          label: "Undo",
          onClick: () => updateTask(task.id, { status: previousStatus }),
        },
      });
    }
  }

  function handleRowClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    if (
      target.closest(
        "button, input, textarea, [role='button'], [role='combobox'], [data-no-disclosure]",
      )
    ) {
      return;
    }
    setSelectedId(task.id);
    requestUiSound(expanded ? "close" : "open");
    setExpandedId(expanded ? null : task.id);
  }

  function canStartRowDrag(target: EventTarget) {
    return !(target as HTMLElement).closest(
      "button, input, textarea, [role='combobox'], [data-no-drag]",
    );
  }

  function handleRowPointerDown(event: PointerEvent<HTMLElement>) {
    if (canStartRowDrag(event.target)) {
      listeners?.onPointerDown?.(event);
    }
  }

  function handleRowTouchStart(event: TouchEvent<HTMLElement>) {
    if (canStartRowDrag(event.target)) {
      listeners?.onTouchStart?.(event);
    }
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" && event.target === event.currentTarget) {
      event.preventDefault();
      event.stopPropagation();
      requestUiSound(expanded ? "close" : "open");
      setExpandedId(expanded ? null : task.id);
    }
  }

  function saveDescription() {
    const description = descriptionDraft.trim();
    if (description !== task.description) finishChangedDraft();
    updateTask(task.id, { description });
    setExpandedId(null);
  }

  return (
    <motion.article
      ref={(node) => {
        taskRef.current = node;
        setNodeRef(node);
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16, ease: "easeOut" }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? undefined : transition,
      }}
      className={cn(
        "task-card",
        selected && "is-selected",
        isDragging && "is-dragging",
      )}
      data-ui-hover-sound
      tabIndex={0}
      aria-label={`${displayTitle}, ${STATUS_LABELS[displayStatus]}`}
      onFocus={() => setSelectedId(task.id)}
      onPointerDown={handleRowPointerDown}
      onTouchStart={handleRowTouchStart}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
    >
      <div className="task-main">
        <button
          className="drag-handle"
          type="button"
          aria-label={`Reorder ${displayTitle}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical />
        </button>
        <span className="drag-spacer" aria-hidden="true" />

        <div className="priority-cell" data-label="Priority">
          <Select
            value={`${task.priority}`}
            onValueChange={(value) => {
              if (value === null) return;
              const priority = Number(value) as Priority;
              if (priority !== task.priority) finishChangedDraft();
              updateTask(task.id, { priority });
            }}
          >
            <SelectTrigger
              aria-label="Priority"
              className={cn(
                "priority-trigger",
                `priority-${task.priority}`,
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent data-task-editor-for={task.id}>
              <SelectItem value="0">0</SelectItem>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="title-cell" data-label="Title">
          {editingTitle ? (
            <input
              ref={titleRef}
              className="title-input"
              aria-label="Task title"
              size={Math.max(1, titleDraft.length)}
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={saveTitleOnBlur}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  saveTitle();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelTitle();
                }
              }}
            />
          ) : (
            <button
              className={cn("title-button", !task.title && "is-empty")}
              type="button"
              onClick={() => setEditingTitle(true)}
            >
              {displayTitle}
            </button>
          )}
        </div>

        <div className="status-cell" data-label="Status">
          <Select value={displayStatus} onValueChange={changeStatus}>
            <SelectTrigger
              aria-label="Status"
              className={cn("status-trigger", `status-${displayStatus}`)}
            >
              <SelectValue>{STATUS_LABELS[displayStatus]}</SelectValue>
            </SelectTrigger>
            <SelectContent
              className="status-options"
              data-task-editor-for={task.id}
            >
              {STATUSES.map((status) => (
                <SelectItem
                  key={status}
                  value={status}
                  className={cn("status-option", `status-${status}`)}
                >
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="estimate-cell" data-label="Estimate">
          <EstimateEditor
            ownerId={task.id}
            value={task.estimate}
            onChange={(estimate) => {
              const estimateChanged =
                estimate?.amount !== task.estimate?.amount ||
                estimate?.unit !== task.estimate?.unit;
              if (estimateChanged) finishChangedDraft();
              updateTask(task.id, { estimate });
            }}
          />
        </div>

        <div className="due-cell" data-label="Due">
          <DueDateEditor
            ownerId={task.id}
            value={task.dueOn}
            onChange={(dueOn) => {
              if (dueOn !== task.dueOn) finishChangedDraft();
              updateTask(task.id, { dueOn });
            }}
          />
        </div>

        <div className="row-actions" data-no-disclosure>
          {tab === "archive" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="row-action"
                onClick={() => restoreTask(task.id)}
                aria-label={`Restore ${displayTitle}`}
              >
                <RotateCcw />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="row-action delete-action"
                      aria-label={`Delete ${displayTitle} permanently`}
                    >
                      <Trash2 />
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    “{displayTitle}” will be permanently removed. This cannot be
                    undone.
                  </AlertDialogDescription>
                  <AlertDialogActions>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="danger"
                      onClick={() => deleteTask(task.id)}
                    >
                      Delete permanently
                    </AlertDialogAction>
                  </AlertDialogActions>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="description-panel-clip"
            data-no-drag
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="description-panel">
          <textarea
            ref={descriptionRef}
            autoFocus={!newTaskDraft}
            aria-label="Task description"
            placeholder="Add a quiet note…"
            value={descriptionDraft}
            onChange={(event) => setDescriptionDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                saveDescription();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setDescriptionDraft(task.description);
                setExpandedId(null);
              }
            }}
          />
          <div className="description-actions">
            <span>⌘/Ctrl + Enter to save</span>
            <Button
              variant="ghost"
              size="sm"
              data-ui-sound="close"
              onClick={() => {
                setDescriptionDraft(task.description);
                setExpandedId(null);
              }}
            >
              <X />
              Cancel
            </Button>
            <Button size="sm" onClick={saveDescription}>
              {descriptionDraft.trim() === task.description ? (
                <Check />
              ) : (
                <Save />
              )}
              Save
            </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
