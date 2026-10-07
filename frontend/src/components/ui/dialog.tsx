"use client";

import type { ComponentProps } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;

export function DialogContent({ children, className, ...props }: ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30" />
      <DialogPrimitive.Content data-slot="dialog-content"
        className={cn("fixed left-1/2 top-1/2 z-50 max-h-[85svh] w-[calc(100%_-_24px)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-background p-6 text-foreground shadow-xl outline-none", className)} {...props}>
        {children}
        <DialogPrimitive.Close aria-label="Close writing samples" className="absolute right-2 top-2 inline-grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <X size={18} aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
