"use client";

import type { ComponentProps } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "cn";

export function Popover(props: ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

export function PopoverTrigger(props: ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

export function PopoverContent({ className, align = "center", sideOffset = 8, collisionPadding = 12, ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content data-slot="popover-content" align={align} sideOffset={sideOffset} collisionPadding={collisionPadding}
        className={cn("z-50 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none", className)} {...props} />
    </PopoverPrimitive.Portal>
  );
}

export function PopoverClose(props: ComponentProps<typeof PopoverPrimitive.Close>) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}
