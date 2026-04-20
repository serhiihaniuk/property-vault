"use client"

import { extractTime } from "@/src/shared/lib/dashboard-v0"
import { cn } from "@/src/shared/lib/utils"
import { Badge } from "@/src/shared/ui/badge"

interface TopBarProps {
  title: string
  subtitle: string
  property: string
  syncFreshness: string | null
  timeRange: "6m" | "12m" | "24m" | "all"
  onTimeRangeChange: (range: "6m" | "12m" | "24m" | "all") => void
}

export function TopBar({
  title,
  subtitle,
  property,
  syncFreshness,
  timeRange,
  onTimeRangeChange,
}: TopBarProps) {
  const ranges: Array<"6m" | "12m" | "24m" | "all"> = [
    "6m",
    "12m",
    "24m",
    "all",
  ]
  const freshnessLabel = syncFreshness
    ? `synced · ${extractTime(syncFreshness)}`
    : "sync pending"

  return (
    <header className="flex items-center justify-between py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {subtitle} · property {property}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge className="px-2 py-1 font-mono text-xs" variant="outline">
          <span className="text-emerald-400">●</span>
          <span className="ml-1.5">{freshnessLabel}</span>
        </Badge>
        <div className="flex items-center rounded-md border border-border bg-secondary/30">
          {ranges.map((range) => (
            <button
              key={range}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                timeRange === range
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onTimeRangeChange(range)}
              type="button"
            >
              {range === "all" ? "All" : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  )
}
