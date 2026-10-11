import type { ComponentProps, ReactNode } from "react";
import { DayPicker } from "react-day-picker";
import { PopoverContent } from "@/shared/ui/popover";
import { cn } from "@/shared/ui/utils";
import "./calendar.css";

type CalendarPopoverContentProps = Omit<
  ComponentProps<typeof PopoverContent>,
  "children" | "onSelect"
> & {
  selected?: Date;
  onSelect: (date: Date) => void;
  children?: ReactNode;
};

export function CalendarPopoverContent({
  selected,
  onSelect,
  children,
  className,
  ...props
}: CalendarPopoverContentProps) {
  return (
    <PopoverContent align="center" className={cn("calendar-popover", className)} {...props}>
      <DayPicker
        mode="single"
        defaultMonth={selected}
        selected={selected}
        onSelect={(date) => {
          if (date) onSelect(date);
        }}
        showOutsideDays
      />
      {children}
    </PopoverContent>
  );
}
