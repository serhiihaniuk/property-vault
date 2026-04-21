"use client"

import * as React from "react"

import { cn } from "@/src/shared/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-[12px] font-medium uppercase tracking-[0.08em] text-fg-subtle",
        className,
      )}
      {...props}
    />
  )
}

export { Label }
