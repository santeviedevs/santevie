"use client";

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Combobox = ComboboxPrimitive.Root;

function ComboboxInputGroup({ className, ...props }: ComboboxPrimitive.InputGroup.Props) {
  return (
    <ComboboxPrimitive.InputGroup
      data-slot="combobox-input-group"
      className={cn(
        "flex w-full items-center gap-1.5 rounded-lg border border-input bg-transparent pr-2 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-50 dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxInput({ className, ...props }: ComboboxPrimitive.Input.Props) {
  return (
    <ComboboxPrimitive.Input
      data-slot="combobox-input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg bg-transparent px-2.5 py-1 text-sm outline-none placeholder:text-muted-foreground disabled:pointer-events-none md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxTrigger({ className, ...props }: ComboboxPrimitive.Trigger.Props) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot="combobox-trigger"
      className={cn(
        "flex shrink-0 items-center justify-center text-muted-foreground outline-none",
        className,
      )}
      {...props}
    >
      <ChevronsUpDownIcon className="size-4" />
    </ComboboxPrimitive.Trigger>
  );
}

function ComboboxContent({
  className,
  children,
  sideOffset = 4,
  ...props
}: ComboboxPrimitive.Popup.Props & Pick<ComboboxPrimitive.Positioner.Props, "sideOffset">) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner sideOffset={sideOffset} className="isolate z-50 outline-none">
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          className={cn(
            "max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          <ComboboxPrimitive.List className="p-1">{children}</ComboboxPrimitive.List>
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );
}

function ComboboxItem({ className, children, ...props }: ComboboxPrimitive.Item.Props) {
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <ComboboxPrimitive.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <CheckIcon className="size-4" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  );
}

function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      className={cn("px-2 py-1.5 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxTrigger,
};
