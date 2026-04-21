"use client"

import { cn } from "@/src/shared/lib/utils"
import { StatusBadge } from "@/src/shared/ui/status-badge"

import type { DashboardSyncStatusVM } from "../lib/dashboard-v0-adapter"

interface TopBarProps {
  title: string
  subtitle: string
  property: string
  syncStatus: DashboardSyncStatusVM
  timeRange: "6m" | "12m" | "24m" | "all"
  onTimeRangeChange: (range: "6m" | "12m" | "24m" | "all") => void
}

export function TopBar({
  title,
  subtitle,
  property,
  syncStatus,
  timeRange,
  onTimeRangeChange,
}: TopBarProps) {
  const ranges: Array<"6m" | "12m" | "24m" | "all"> = [
    "6m",
    "12m",
    "24m",
    "all",
  ]

  return (
    <header className="flex items-start justify-between py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {subtitle} · property {property}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end gap-1">
          <StatusBadge
            className="px-2 py-1 font-mono text-xs"
            dot
            status={syncStatus.tone}
            title={syncStatus.title ?? undefined}
          >
            {syncStatus.label}
          </StatusBadge>
          {syncStatus.detail ? (
            <span className="max-w-64 text-right text-[11px] text-muted-foreground">
              {syncStatus.detail}
            </span>
          ) : null}
        </div>
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
