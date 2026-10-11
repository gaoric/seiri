import { CalendarDays } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { CalendarPopoverContent } from "@/shared/ui/calendar";
import { Popover, PopoverTrigger } from "@/shared/ui/popover";
import {
  dateToKey,
  daysUntil,
  dueAriaLabel,
  exactDateLabel,
  keyToDate,
  relativeDueLabel,
} from "@/features/todo/todo-utils";
import { cn } from "@/shared/ui/utils";

type DueDateEditorProps = {
  ownerId: string;
  value: string | null;
  onChange: (value: string | null) => void;
};

export function DueDateEditor({ ownerId, value, onChange }: DueDateEditorProps) {
  const overdue = value ? daysUntil(value) < 0 : false;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            className="property-trigger due-trigger"
            type="button"
            aria-label={value ? dueAriaLabel(value) : "Set due date"}
          />
        }
      >
        {value ? (
          <>
            <span className={cn("due-relative", overdue && "is-overdue")}>
              {relativeDueLabel(value)}
            </span>
            <span className={cn("due-exact", overdue && "is-overdue")}>
              {exactDateLabel(value)}
            </span>
          </>
        ) : (
          "—"
        )}
      </PopoverTrigger>
      <CalendarPopoverContent
        data-task-editor-for={ownerId}
        selected={value ? keyToDate(value) : undefined}
        onSelect={(date) => onChange(dateToKey(date))}
      >
        <div className="calendar-foot">
          <span className="calendar-note">
            <CalendarDays className="size-3.5" />
            Dates use your local calendar.
          </span>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="clear-property-button"
              data-ui-sound="close"
              onClick={() => onChange(null)}
              aria-label="Clear due date"
            >
              Clear
            </Button>
          )}
        </div>
      </CalendarPopoverContent>
    </Popover>
  );
}
