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
import { motion } from "motion/react";
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
import { isArchivedStatus, STATUS_LABELS } from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/store/task-store";
import type { Priority, Task, TaskStatus, TaskTab } from "@/types";

type TaskRowProps = {
  task: Task;
  tab: TaskTab;
  selected: boolean;
  expanded: boolean;
  editTitleRequested: boolean;
  onEditTitleHandled: () => void;
};

const STATUSES = Object.keys(STATUS_LABELS) as TaskStatus[];

export function TaskRow({
  task,
  tab,
  selected,
  expanded,
  editTitleRequested,
  onEditTitleHandled,
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  const displayTitle = task.title || "—";

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

  useLayoutEffect(() => {
    if (!expanded || !descriptionRef.current) return;
    descriptionRef.current.style.height = "auto";
    const borderHeight =
      descriptionRef.current.offsetHeight -
      descriptionRef.current.clientHeight;
    descriptionRef.current.style.height =
      `${descriptionRef.current.scrollHeight + borderHeight}px`;
  }, [descriptionDraft, expanded]);

  function saveTitle() {
    const title = titleDraft.trim();
    updateTask(task.id, { title });
    setEditingTitle(false);
  }

  function cancelTitle() {
    setTitleDraft(task.title);
    setEditingTitle(false);
  }

  function changeStatus(status: TaskStatus | null) {
    if (!status) return;
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
      setExpandedId(expanded ? null : task.id);
    }
  }

  function saveDescription() {
    updateTask(task.id, { description: descriptionDraft.trim() });
    setExpandedId(null);
  }

  return (
    <motion.article
      ref={setNodeRef}
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
      tabIndex={0}
      aria-label={`${displayTitle}, ${STATUS_LABELS[task.status]}`}
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
              updateTask(task.id, { priority: Number(value) as Priority });
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
            <SelectContent>
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
              onBlur={saveTitle}
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
          <Select value={task.status} onValueChange={changeStatus}>
            <SelectTrigger
              aria-label="Status"
              className={cn("status-trigger", `status-${task.status}`)}
            >
              <SelectValue>{STATUS_LABELS[task.status]}</SelectValue>
            </SelectTrigger>
            <SelectContent className="status-options">
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
            value={task.estimate}
            onChange={(estimate) => updateTask(task.id, { estimate })}
          />
        </div>

        <div className="due-cell" data-label="Due">
          <DueDateEditor
            value={task.dueOn}
            onChange={(dueOn) => updateTask(task.id, { dueOn })}
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

      {expanded && (
        <div className="description-panel" data-no-drag>
          <textarea
            ref={descriptionRef}
            autoFocus
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
      )}
    </motion.article>
  );
}
