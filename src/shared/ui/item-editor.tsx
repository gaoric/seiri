import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./utils";
import "./item-editor.css";

export function ItemEditor({
  title,
  onClose,
  className,
  children,
}: {
  title: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="item-editor-overlay" />
        <Dialog.Popup className={cn("item-editor-panel", className)}>
          <div className="item-editor-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close type="button" aria-label="Close editor">
              <X />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
