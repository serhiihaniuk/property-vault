import { FileText, FolderOpen, Layers, TrendingUp } from "lucide-react"

import { cn } from "@/src/shared/lib/utils"
import { Badge } from "@/src/shared/ui/badge"

import {
  formatAmountShort,
  type DashboardSummary,
  type MonthData,
  type Period,
} from "./dashboard-v0-mock"

interface PrimarySummaryCardProps {
  selectedMonth: Period
  previousMonth: Period
  summary: DashboardSummary
  currentMonthData: MonthData
}

export function PrimarySummaryCard({
  selectedMonth,
  previousMonth,
  summary,
  currentMonthData,
}: PrimarySummaryCardProps) {
  const totalCharge = formatAmountShort(summary.totalCharges)
  const previousTotal = formatAmountShort(summary.previousTotalCharges)
  const delta = formatAmountShort(summary.totalDelta)
  const deltaPercent =
    previousTotal > 0
      ? ((totalCharge - previousTotal) / previousTotal) * 100
      : 0

  const isPositiveDelta = delta > 0
  const deltaColor =
    delta === 0
      ? "text-muted-foreground"
      : isPositiveDelta
        ? "text-rose-400"
        : "text-emerald-400"
  const deltaSymbol = delta > 0 ? "▲" : delta < 0 ? "▼" : ""

  const totalFormatted = totalCharge.toLocaleString("pl-PL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
  const [wholePart, decimalPart] = totalFormatted.split(",")

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">This month ·</span>
          <span className="text-sm font-medium">{selectedMonth.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {currentMonthData.isCarriedForward ? (
            <Badge
              className="border-amber-400/30 px-2 py-0.5 font-mono text-xs text-amber-400"
              variant="outline"
            >
              carried forward
            </Badge>
          ) : null}
          <Badge
            className="border-emerald-400/30 px-2 py-0.5 font-mono text-xs text-emerald-400"
            variant="outline"
          >
            {summary.categoryCount} categories
          </Badge>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-5xl font-semibold tracking-tight tabular-nums">
            {wholePart}
          </span>
          <span className="font-mono text-2xl text-muted-foreground">
            ,{decimalPart} zł
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className={cn("font-mono tabular-nums", deltaColor)}>
            {deltaSymbol} {Math.abs(deltaPercent).toFixed(1)}%
          </span>
          <span className="text-muted-foreground">
            vs {previousMonth.label} (
            {previousTotal.toLocaleString("pl-PL", {
              minimumFractionDigits: 2,
            })}{" "}
            zł)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-border pt-4">
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            LARGEST CATEGORY
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-chart-1" />
            <span className="truncate text-sm font-medium">
              {summary.largestCategory.categoryLabel}
            </span>
          </div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">
            {formatAmountShort(summary.largestCategory.amount).toLocaleString(
              "pl-PL",
              { minimumFractionDigits: 2 }
            )}{" "}
            zł
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            TOP CHANGE
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp
              className={cn(
                "h-3.5 w-3.5",
                summary.topChange.changeStatus === "up"
                  ? "text-rose-400"
                  : "text-emerald-400"
              )}
            />
            <span className="truncate text-sm font-medium">
              {summary.topChange.categoryLabel}
            </span>
          </div>
          <div
            className={cn(
              "mt-0.5 font-mono text-xs",
              summary.topChange.changeStatus === "up"
                ? "text-rose-400"
                : "text-emerald-400"
            )}
          >
            {summary.topChange.changeStatus === "up" ? "+" : ""}
            {formatAmountShort(summary.topChange.delta).toLocaleString(
              "pl-PL",
              {
                minimumFractionDigits: 2,
              }
            )}{" "}
            zł
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            CATEGORIES CHANGED
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">
              {summary.changedCategoryCount} of {summary.categoryCount}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {summary.categoryCount - summary.changedCategoryCount} unchanged
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            SOURCE MONTH
          </div>
          <div className="font-mono text-sm">
            {currentMonthData.sourceMonth.label}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            SOURCE DOCS
          </div>
          <div className="flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-sm">
              {currentMonthData.sourceDocuments.length} document(s)
            </span>
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            PERIOD
          </div>
          <div className="font-mono text-sm">{selectedMonth.value}</div>
        </div>
      </div>
    </div>
  )
}
