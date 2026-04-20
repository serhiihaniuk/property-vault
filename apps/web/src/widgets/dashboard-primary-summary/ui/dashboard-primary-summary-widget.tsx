import { FileText, FolderOpen, Layers, TrendingUp } from "lucide-react"

import {
  formatAmountShort,
  type DashboardSummary,
  type MonthData,
  type Period,
} from "@/src/shared/lib/dashboard-v0"
import { cn } from "@/src/shared/lib/utils"
import { Badge } from "@/src/shared/ui/badge"

interface DashboardPrimarySummaryWidgetProps {
  currentMonthData: MonthData | null
  previousMonth: Period | null
  selectedMonth: Period | null
  summary: DashboardSummary | null
  unavailableReason?: string | null
}

export function DashboardPrimarySummaryWidget({
  currentMonthData,
  previousMonth,
  selectedMonth,
  summary,
  unavailableReason,
}: DashboardPrimarySummaryWidgetProps) {
  const totalCharge = summary ? formatAmountShort(summary.totalCharges) : null
  const previousTotal = summary?.previousTotalCharges
    ? formatAmountShort(summary.previousTotalCharges)
    : null
  const delta = summary?.totalDelta
    ? formatAmountShort(summary.totalDelta)
    : null
  const deltaPercent =
    totalCharge !== null && previousTotal && previousTotal > 0
      ? ((totalCharge - previousTotal) / previousTotal) * 100
      : null
  const deltaColor =
    delta === null || delta === 0
      ? "text-muted-foreground"
      : delta > 0
        ? "text-rose-400"
        : "text-emerald-400"
  const deltaSymbol =
    delta === null ? "" : delta > 0 ? "▲" : delta < 0 ? "▼" : ""
  const totalFormatted =
    totalCharge === null
      ? null
      : totalCharge.toLocaleString("pl-PL", {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        })
  const [wholePart = "—", decimalPart = "—"] = totalFormatted?.split(",") ?? []

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">This month ·</span>
          <span className="text-sm font-medium">
            {selectedMonth?.label ?? "No charge month"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {currentMonthData?.isCarriedForward ? (
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
            {summary?.categoryCount ?? 0} categories
          </Badge>
        </div>
      </div>

      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-5xl font-semibold tracking-tight tabular-nums">
            {wholePart}
          </span>
          <span className="font-mono text-2xl text-muted-foreground">
            {totalCharge === null ? "" : `,${decimalPart} zł`}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          {deltaPercent === null ? (
            <span className="text-muted-foreground">
              {unavailableReason ?? "No previous month comparison available."}
            </span>
          ) : (
            <>
              <span className={cn("font-mono tabular-nums", deltaColor)}>
                {deltaSymbol} {Math.abs(deltaPercent).toFixed(1)}%
              </span>
              <span className="text-muted-foreground">
                vs {previousMonth?.label ?? "previous month"} (
                {previousTotal?.toLocaleString("pl-PL", {
                  minimumFractionDigits: 2,
                }) ?? "—"}{" "}
                zł)
              </span>
            </>
          )}
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
              {summary?.largestCategory?.categoryLabel ?? "No category"}
            </span>
          </div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">
            {summary?.largestCategory
              ? `${formatAmountShort(
                  summary.largestCategory.amount
                ).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`
              : "—"}
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
                summary?.topChange?.changeStatus === "up"
                  ? "text-rose-400"
                  : "text-emerald-400"
              )}
            />
            <span className="truncate text-sm font-medium">
              {summary?.topChange?.categoryLabel ?? "No movement"}
            </span>
          </div>
          <div
            className={cn(
              "mt-0.5 font-mono text-xs",
              summary?.topChange?.changeStatus === "up"
                ? "text-rose-400"
                : "text-emerald-400"
            )}
          >
            {summary?.topChange
              ? `${summary.topChange.changeStatus === "up" ? "+" : ""}${formatAmountShort(
                  summary.topChange.delta
                ).toLocaleString("pl-PL", {
                  minimumFractionDigits: 2,
                })} zł`
              : "—"}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            CATEGORIES CHANGED
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">
              {summary?.changedCategoryCount ?? 0} of{" "}
              {summary?.categoryCount ?? 0}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {summary
              ? `${summary.categoryCount - summary.changedCategoryCount} unchanged`
              : "No comparison yet"}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            SOURCE MONTH
          </div>
          <div className="font-mono text-sm">
            {currentMonthData?.sourceMonth.label ?? "—"}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            SOURCE DOCS
          </div>
          <div className="flex items-center gap-1.5">
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-sm">
              {currentMonthData?.sourceDocuments.length ?? 0} document(s)
            </span>
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            PERIOD
          </div>
          <div className="font-mono text-sm">{selectedMonth?.value ?? "—"}</div>
        </div>
      </div>

      {unavailableReason ? (
        <div className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
          {unavailableReason}
        </div>
      ) : null}
    </div>
  )
}
