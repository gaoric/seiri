import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { requestUiSound } from "@/shared/sound/use-ui-sounds";
import {
  ESTIMATE_BOUNDS,
  ESTIMATE_UNITS,
  formatEstimate,
  normalizeEstimateAmount,
} from "@/features/todo/todo-utils";
import type { Estimate, EstimateUnit } from "@/features/todo/todo-types";

type EstimateEditorProps = {
  ownerId: string;
  value: Estimate | null;
  onChange: (value: Estimate | null) => void;
};

export function EstimateEditor({
  ownerId,
  value,
  onChange,
}: EstimateEditorProps) {
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<EstimateUnit>(value?.unit ?? "days");
  const [amount, setAmount] = useState(`${value?.amount ?? 1}`);
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    setUnit(value?.unit ?? "days");
    setAmount(`${value?.amount ?? 1}`);
  }, [open, value]);

  function commit(nextAmount = amount, nextUnit = unit) {
    const normalized = normalizeEstimateAmount(nextAmount, nextUnit);
    setAmount(`${normalized}`);
    onChange({ amount: normalized, unit: nextUnit });
  }

  function changeUnit(nextUnit: EstimateUnit | null) {
    if (!nextUnit) return;
    setUnit(nextUnit);
    commit(amount, nextUnit);
  }

  function stopRepeating() {
    if (delayRef.current) clearTimeout(delayRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    delayRef.current = null;
    intervalRef.current = null;
  }

  function step(delta: -1 | 1) {
    setAmount((current) => {
      const normalized = normalizeEstimateAmount(current, unit);
      const [min, max] = ESTIMATE_BOUNDS[unit];
      const next = Math.min(max, Math.max(min, normalized + delta));
      if (next === normalized) return `${next}`;
      requestUiSound(delta > 0 ? "open" : "close");
      onChange({ amount: next, unit });
      return `${next}`;
    });
  }

  function startRepeating(delta: -1 | 1) {
    step(delta);
    stopRepeating();
    delayRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => step(delta), 80);
    }, 350);
  }

  useEffect(() => stopRepeating, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            className="property-trigger estimate-trigger"
            type="button"
          />
        }
      >
        {value ? formatEstimate(value) : "—"}
      </PopoverTrigger>
      <PopoverContent
        className="estimate-popover"
        data-task-editor-for={ownerId}
      >
        <div className="estimate-controls">
          <div className="stepper-buttons">
            <button
              type="button"
              aria-label="Increase estimate"
              data-ui-sound="custom"
              onPointerDown={(event) => {
                event.preventDefault();
                startRepeating(1);
              }}
              onPointerUp={stopRepeating}
              onPointerCancel={stopRepeating}
              onPointerLeave={stopRepeating}
            >
              <ChevronUp />
            </button>
            <button
              type="button"
              aria-label="Decrease estimate"
              data-ui-sound="custom"
              onPointerDown={(event) => {
                event.preventDefault();
                startRepeating(-1);
              }}
              onPointerUp={stopRepeating}
              onPointerCancel={stopRepeating}
              onPointerLeave={stopRepeating}
            >
              <ChevronDown />
            </button>
          </div>
          <div className="estimate-amount">
            <input
              aria-label="Estimate amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              onBlur={() => commit()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commit();
                  event.currentTarget.blur();
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  step(1);
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  step(-1);
                }
              }}
            />
          </div>
          <Select value={unit} onValueChange={changeUnit}>
            <SelectTrigger className="estimate-unit-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent data-task-editor-for={ownerId}>
              {ESTIMATE_UNITS.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="property-popover-foot">
          <p className="estimate-range">
          Range {ESTIMATE_BOUNDS[unit][0]}–{ESTIMATE_BOUNDS[unit][1]}
          </p>
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="clear-property-button"
              data-ui-sound="close"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              aria-label="Clear estimate"
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
