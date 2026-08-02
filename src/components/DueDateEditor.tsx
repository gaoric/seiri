import { CalendarDays } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  dateToKey,
  daysUntil,
  dueAriaLabel,
  exactDateLabel,
  keyToDate,
  relativeDueLabel,
} from "@/lib/task-utils";
import { cn } from "@/lib/utils";

type DueDateEditorProps = {
  value: string | null;
  onChange: (value: string | null) => void;
};

export function DueDateEditor({ value, onChange }: DueDateEditorProps) {
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
      <PopoverContent className="calendar-popover">
        <DayPicker
          mode="single"
          defaultMonth={value ? keyToDate(value) : undefined}
          selected={value ? keyToDate(value) : undefined}
          onSelect={(date) => date && onChange(dateToKey(date))}
          showOutsideDays
        />
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
              onClick={() => onChange(null)}
              aria-label="Clear due date"
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
