"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@/src/shared/lib/utils"

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      data-slot="select-trigger"
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-border-default bg-surface-app px-3 py-2 text-sm text-fg-primary outline-none transition-colors focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="text-fg-subtle">
        <ChevronDown className="size-4" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof SelectPrimitive.Popup>
>(({ className, children, ...props }, ref) => {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        className="z-50 outline-none"
        sideOffset={8}
      >
        <SelectPrimitive.Popup
          ref={ref}
          data-slot="select-content"
          className={cn(
            "max-h-80 min-w-[var(--anchor-width)] overflow-hidden rounded-md border border-border-default bg-surface-card shadow-lg outline-none",
            className,
          )}
          {...props}
        >
          <SelectPrimitive.List className="flex flex-col gap-1 p-1">
            {children}
          </SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
})
SelectContent.displayName = "SelectContent"

const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof SelectPrimitive.GroupLabel>
>(({ className, ...props }, ref) => {
  return (
    <SelectPrimitive.GroupLabel
      ref={ref}
      data-slot="select-label"
      className={cn(
        "px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle",
        className,
      )}
      {...props}
    />
  )
})
SelectLabel.displayName = "SelectLabel"

const SelectItem = React.forwardRef<
  HTMLElement,
  React.ComponentProps<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => {
  return (
    <SelectPrimitive.Item
      ref={ref}
      data-slot="select-item"
      className={cn(
        "relative flex cursor-default items-center rounded-sm py-2 pr-8 pl-3 text-sm text-fg-primary outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-subtle",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-4 items-center justify-center text-fg-subtle">
        <SelectPrimitive.ItemIndicator keepMounted>
          <Check className="size-4" aria-hidden="true" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
})
SelectItem.displayName = "SelectItem"

const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      data-slot="select-separator"
      className={cn("my-1 h-px bg-border-default", className)}
      {...props}
    />
  )
})
SelectSeparator.displayName = "SelectSeparator"

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
