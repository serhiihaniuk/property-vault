"use client"

import * as React from "react"

import { cn } from "@/src/shared/lib/utils"

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-border-default bg-surface-app px-3 py-2 text-sm text-fg-primary outline-none transition-colors placeholder:text-fg-subtle focus:border-border-strong focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
