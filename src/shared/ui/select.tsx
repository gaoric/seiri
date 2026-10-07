import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/shared/ui/utils";

export const Select = SelectPrimitive.Root;

export function SelectValue(props: SelectPrimitive.Value.Props) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

export function SelectTrigger({
  className,
  children,
  showChevron = true,
  ...props
}: SelectPrimitive.Trigger.Props & { showChevron?: boolean }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "inline-flex h-8 items-center justify-between gap-1 rounded-md border border-transparent bg-transparent px-2 text-xs text-white/70 outline-none transition-colors hover:bg-white/5 focus:border-white/15 data-placeholder:text-white/30",
        className,
      )}
      {...props}
    >
      {children}
      {showChevron && <SelectPrimitive.Icon
        render={<ChevronDown className="size-3 opacity-50" />}
      />}
    </SelectPrimitive.Trigger>
  );
}

type SelectContentProps = SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    | "align"
    | "alignOffset"
    | "collisionAvoidance"
    | "side"
    | "sideOffset"
    | "alignItemWithTrigger"
  >;

export function SelectContent({
  className,
  children,
  align = "start",
  alignOffset = 0,
  collisionAvoidance = {
    side: "none",
    align: "shift",
    fallbackAxisSide: "none",
  },
  side = "bottom",
  sideOffset = 4,
  alignItemWithTrigger = false,
  ...props
}: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        collisionAvoidance={collisionAvoidance}
        side={side}
        sideOffset={sideOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "z-50 max-h-(--available-height) min-w-32 overflow-y-auto rounded-lg border border-white/10 bg-[#202124] p-1 text-white shadow-2xl shadow-black/40",
            className,
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  indicator = "check",
  ...props
}: SelectPrimitive.Item.Props & { indicator?: "check" | "line" }) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex h-8 cursor-default select-none items-center rounded-md py-1.5 pl-8 pr-2 text-xs text-white/75 outline-none focus:bg-white/8 focus:text-white data-highlighted:bg-white/8 data-highlighted:text-white",
        indicator === "line" && "pl-5",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemIndicator
        render={
          <span
            data-slot="select-item-indicator"
            className={cn("absolute flex h-4 items-center justify-center",
              indicator === "line" ? "left-1 w-2" : "left-2 w-4")}
          />
        }
      >
        {indicator === "line"
          ? <span className="h-3 w-0.5 rounded-full bg-current" aria-hidden="true" />
          : <Check className="size-3.5" />}
      </SelectPrimitive.ItemIndicator>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}
