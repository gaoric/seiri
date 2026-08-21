import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import type * as React from "react";
import { Button, type ButtonProps } from "@/shared/ui/button";
import { cn } from "@/shared/ui/utils";

export function AlertDialog(props: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

export function AlertDialogTrigger(
  props: AlertDialogPrimitive.Trigger.Props,
) {
  return (
    <AlertDialogPrimitive.Trigger
      data-slot="alert-dialog-trigger"
      {...props}
    />
  );
}

export function AlertDialogContent({
  className,
  ...props
}: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Backdrop
        data-slot="alert-dialog-overlay"
        className="dialog-overlay"
      />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={cn("dialog-content", className)}
        {...props}
      />
    </AlertDialogPrimitive.Portal>
  );
}

export function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(className)}
      {...props}
    />
  );
}

export function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(className)}
      {...props}
    />
  );
}

export function AlertDialogCancel({
  className,
  variant = "subtle",
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<ButtonProps, "variant" | "size">) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      className={cn(className)}
      render={<Button variant={variant} data-ui-sound="close" />}
      {...props}
    />
  );
}

export function AlertDialogAction({
  className,
  variant,
  size,
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<ButtonProps, "variant" | "size">) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-action"
      className={cn(className)}
      render={
        <Button variant={variant} size={size} data-ui-sound="close" />
      }
      {...props}
    />
  );
}

export function AlertDialogActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("dialog-actions", className)} {...props} />;
}
