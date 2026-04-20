"use client"

import { useState, useSyncExternalStore } from "react"
import {
  Area,
  AreaChart,
  Bar,
  Cell,
  ComposedChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  YAxis,
  XAxis,
} from "recharts"
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ExternalLink,
  FileText,
  FolderOpen,
  Info,
  Layers,
  TrendingUp,
} from "lucide-react"

import { cn } from "@/src/shared/lib/utils"
import { Badge } from "@/src/shared/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/shared/ui/table"

import {
  anomalies,
  categories,
  currentMonthData,
  dashboardSummary,
  formatAmountShort,
  generatedAt,
  monthlyTrend,
  previousMonth,
  reconciliationCoverage,
  reconciliationSummary,
  selectedMonth,
  sourceDocuments,
  type Anomaly,
  type CategoryBreakdown,
  type DocumentListItem,
  type MonthlyTrendData,
  type ReconciliationCoverage,
  type ReconciliationSummary,
} from "./dashboard-v0-mock"

type TimeRange = "6m" | "12m" | "24m" | "all"

type CategoryColor = {
  fill: string
  stroke: string
}

type ChartDataPoint = {
  month: string
  monthShort: string
  total: number
  carriedForward: boolean
  hasAnomaly: boolean
  vsAvg: number
  momChange: number
} & Record<string, number | string | boolean>

const CATEGORY_COLORS: Record<string, CategoryColor> = {
  shared_property_advance: {
    fill: "oklch(0.65 0.12 240)",
    stroke: "oklch(0.72 0.12 240)",
  },
  central_heating_energy: {
    fill: "oklch(0.68 0.14 55)",
    stroke: "oklch(0.75 0.14 55)",
  },
  cold_water_and_sewage: {
    fill: "oklch(0.65 0.12 195)",
    stroke: "oklch(0.72 0.12 195)",
  },
  hot_water_heating: {
    fill: "oklch(0.62 0.11 175)",
    stroke: "oklch(0.70 0.11 175)",
  },
  renovation_investment_fund: {
    fill: "oklch(0.58 0.14 290)",
    stroke: "oklch(0.66 0.14 290)",
  },
  municipal_waste: {
    fill: "oklch(0.62 0.1 105)",
    stroke: "oklch(0.7 0.1 105)",
  },
  ordered_heating_power: {
    fill: "oklch(0.6 0.12 15)",
    stroke: "oklch(0.68 0.12 15)",
  },
  e_kartoteka_access: {
    fill: "oklch(0.55 0.03 260)",
    stroke: "oklch(0.62 0.03 260)",
  },
}

const DEFAULT_CATEGORY_COLOR: CategoryColor = {
  fill: "oklch(0.5 0.05 260)",
  stroke: "oklch(0.58 0.05 260)",
}

const SEVERITY_COLORS = {
  critical: {
    icon: "text-rose-400/80",
    text: "text-rose-400/90",
    bg: "bg-rose-400/5 hover:bg-rose-400/8",
  },
  warning: {
    icon: "text-amber-400/80",
    text: "text-amber-400/90",
    bg: "bg-amber-400/5 hover:bg-amber-400/8",
  },
  info: {
    icon: "text-sky-400/70",
    text: "text-sky-400/80",
    bg: "bg-sky-400/5 hover:bg-sky-400/8",
  },
} satisfies Record<
  Anomaly["severity"],
  { icon: string; text: string; bg: string }
>

export function DashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("12m")

  return (
    <div className="relative left-1/2 -my-6 min-h-svh w-screen -translate-x-1/2 overflow-x-clip bg-background">
      <div className="mx-auto max-w-[1600px] px-6 pb-12">
        <TopBar
          title="Finances"
          subtitle={`Latest state · ${selectedMonth.label}`}
          property="63713"
          syncFreshness={generatedAt}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />

        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PrimarySummaryCard />
          <AccountStatusCard
            anomalies={anomalies}
            reconciliationCoverage={reconciliationCoverage}
            reconciliationSummary={reconciliationSummary}
            generatedAt={generatedAt}
          />
        </section>

        <section className="mb-6">
          <MonthlyTrendChart data={monthlyTrend} categories={categories} />
        </section>

        <section className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-medium text-foreground">
                Breakdown by category
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                This month vs last · {dashboardSummary.categoryCount} categories
                · {dashboardSummary.changedCategoryCount} changed
              </p>
            </div>
            <div className="rounded bg-secondary/50 px-2 py-1 font-mono text-xs text-muted-foreground">
              period {previousMonth.value} → {selectedMonth.value}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            {categories.slice(0, 8).map((category) => (
              <CategoryCard key={category.category} category={category} />
            ))}
          </div>
        </section>

        <section className="mb-6">
          <OpenItemsPanel
            anomalies={anomalies}
            reconciliationSummary={reconciliationSummary}
          />
        </section>

        <section>
          <DocumentsTable documents={sourceDocuments} />
        </section>
      </div>
    </div>
  )
}

function TopBar({
  title,
  subtitle,
  property,
  syncFreshness,
  timeRange,
  onTimeRangeChange,
}: {
  title: string
  subtitle: string
  property: string
  syncFreshness: string
  timeRange: TimeRange
  onTimeRangeChange: (range: TimeRange) => void
}) {
  const ranges: TimeRange[] = ["6m", "12m", "24m", "all"]

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
          <span className="ml-1.5">synced · {extractTime(syncFreshness)}</span>
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

function PrimarySummaryCard() {
  const totalCharge = formatAmountShort(dashboardSummary.totalCharges)
  const previousTotal = formatAmountShort(dashboardSummary.previousTotalCharges)
  const delta = formatAmountShort(dashboardSummary.totalDelta)
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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
            {dashboardSummary.categoryCount} categories
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
            Largest category
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-chart-1" />
            <span className="truncate text-sm font-medium">
              {dashboardSummary.largestCategory.categoryLabel}
            </span>
          </div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">
            {formatAmountShort(
              dashboardSummary.largestCategory.amount
            ).toLocaleString("pl-PL", { minimumFractionDigits: 2 })}{" "}
            zł
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            Top change
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp
              className={cn(
                "h-3.5 w-3.5",
                dashboardSummary.topChange.changeStatus === "up"
                  ? "text-rose-400"
                  : "text-emerald-400"
              )}
            />
            <span className="truncate text-sm font-medium">
              {dashboardSummary.topChange.categoryLabel}
            </span>
          </div>
          <div
            className={cn(
              "mt-0.5 font-mono text-xs",
              dashboardSummary.topChange.changeStatus === "up"
                ? "text-rose-400"
                : "text-emerald-400"
            )}
          >
            {dashboardSummary.topChange.changeStatus === "up" ? "+" : ""}
            {formatAmountShort(dashboardSummary.topChange.delta).toLocaleString(
              "pl-PL",
              { minimumFractionDigits: 2 }
            )}{" "}
            zł
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            Categories changed
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium">
              {dashboardSummary.changedCategoryCount} of{" "}
              {dashboardSummary.categoryCount}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {dashboardSummary.categoryCount -
              dashboardSummary.changedCategoryCount}{" "}
            unchanged
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            Source month
          </div>
          <div className="font-mono text-sm">
            {currentMonthData.sourceMonth.label}
          </div>
        </div>
        <div>
          <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
            Source docs
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
            Period
          </div>
          <div className="font-mono text-sm">{selectedMonth.value}</div>
        </div>
      </div>
    </div>
  )
}

function AccountStatusCard({
  anomalies,
  reconciliationCoverage,
  reconciliationSummary,
  generatedAt,
}: {
  anomalies: Anomaly[]
  reconciliationCoverage: ReconciliationCoverage
  reconciliationSummary: ReconciliationSummary
  generatedAt: string
}) {
  const openAnomalies = anomalies.filter((anomaly) => anomaly.status === "open")
  const criticalCount = openAnomalies.filter(
    (anomaly) => anomaly.severity === "critical"
  ).length
  const warningCount = openAnomalies.filter(
    (anomaly) => anomaly.severity === "warning"
  ).length
  const infoCount = openAnomalies.filter(
    (anomaly) => anomaly.severity === "info"
  ).length
  const netBalance = formatAmountShort(reconciliationSummary.netBalance)
  const isPositive = netBalance >= 0

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="mb-1 text-sm font-medium text-muted-foreground">
            Operational Status
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {criticalCount > 0 ? (
                <Badge
                  className="border-rose-400/30 px-1.5 py-0 text-xs"
                  variant="outline"
                >
                  <AlertTriangle className="mr-1 h-3 w-3 text-rose-400" />
                  <span className="text-rose-400">{criticalCount}</span>
                </Badge>
              ) : null}
              {warningCount > 0 ? (
                <Badge
                  className="border-amber-400/30 px-1.5 py-0 text-xs"
                  variant="outline"
                >
                  <AlertCircle className="mr-1 h-3 w-3 text-amber-400" />
                  <span className="text-amber-400">{warningCount}</span>
                </Badge>
              ) : null}
              {infoCount > 0 ? (
                <Badge
                  className="border-blue-400/30 px-1.5 py-0 text-xs"
                  variant="outline"
                >
                  <Info className="mr-1 h-3 w-3 text-blue-400" />
                  <span className="text-blue-400">{infoCount}</span>
                </Badge>
              ) : null}
              {openAnomalies.length === 0 ? (
                <Badge
                  className="border-emerald-400/30 px-1.5 py-0 text-xs"
                  variant="outline"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">All clear</span>
                </Badge>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">
              {openAnomalies.length} open anomalies
            </span>
          </div>
        </div>
        <Badge className="px-2 py-0.5 font-mono text-xs" variant="outline">
          synced {extractTime(generatedAt)}
        </Badge>
      </div>

      <div className="border-t border-border pt-4">
        <h4 className="mb-3 text-xs tracking-wider text-muted-foreground uppercase">
          Year Reconciliation ·{" "}
          {reconciliationCoverage.throughMonth.value.split("-")[0]}
        </h4>

        <div className="mb-3 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
              Coverage
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold tabular-nums">
                {reconciliationCoverage.monthsCovered}
              </span>
              <span className="text-sm text-muted-foreground">months</span>
              <Badge
                className={cn(
                  "ml-auto px-1.5 py-0 text-[10px]",
                  reconciliationCoverage.status === "complete"
                    ? "border-emerald-400/30 text-emerald-400"
                    : reconciliationCoverage.status === "year_to_date"
                      ? "border-blue-400/30 text-blue-400"
                      : "border-amber-400/30 text-amber-400"
                )}
                variant="outline"
              >
                {reconciliationCoverage.status.replace("_", " ")}
              </Badge>
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
              Net Balance
            </div>
            <div
              className={cn(
                "font-mono text-lg font-semibold tabular-nums",
                isPositive ? "text-emerald-400" : "text-rose-400"
              )}
            >
              {isPositive ? "+" : ""}
              {netBalance.toLocaleString("pl-PL", {
                minimumFractionDigits: 2,
              })}{" "}
              zł
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Scheduled</span>
            <span className="font-mono tabular-nums">
              {formatAmountShort(
                reconciliationSummary.scheduledTotal
              ).toLocaleString("pl-PL")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Actual</span>
            <span className="font-mono tabular-nums">
              {formatAmountShort(
                reconciliationSummary.actualCostTotal
              ).toLocaleString("pl-PL")}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Credits</span>
            <span className="font-mono text-emerald-400 tabular-nums">
              +
              {formatAmountShort(
                reconciliationSummary.creditsTotal
              ).toLocaleString("pl-PL")}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-xs">
          <span className="text-muted-foreground">
            {reconciliationSummary.settledLineCount} settled ·{" "}
            {reconciliationSummary.openLineCount} open lines
          </span>
          <span className="font-mono text-muted-foreground">
            through {reconciliationCoverage.throughMonth.label}
          </span>
        </div>
      </div>
    </div>
  )
}

function CategoryCard({ category }: { category: CategoryBreakdown }) {
  const mounted = useClientReady()

  const categoryColor = getCategoryColor(category.category)
  const currentAmountMinor = category.amount.amountMinor
  const previousAmountMinor = category.previousAmount.amountMinor
  const deltaPercent =
    previousAmountMinor > 0
      ? ((currentAmountMinor - previousAmountMinor) / previousAmountMinor) * 100
      : 0
  const isSignificantChange = Math.abs(deltaPercent) > 10
  const deltaColor =
    category.changeStatus === "up"
      ? "text-rose-400"
      : category.changeStatus === "down"
        ? "text-emerald-400"
        : "text-muted-foreground"
  const deltaIcon =
    category.changeStatus === "up"
      ? "▲"
      : category.changeStatus === "down"
        ? "▼"
        : ""
  const currentAmount = currentAmountMinor / 100
  const previousAmount = previousAmountMinor / 100
  const historyValues = category.history?.map((entry) => entry.value) ?? []
  const avgValue = historyValues.length
    ? historyValues.reduce((sum, value) => sum + value, 0) /
      historyValues.length
    : 0
  const minValue = historyValues.length ? Math.min(...historyValues) : 0
  const maxValue = historyValues.length ? Math.max(...historyValues) : 0
  const firstHalf = historyValues.slice(0, Math.floor(historyValues.length / 2))
  const secondHalf = historyValues.slice(Math.floor(historyValues.length / 2))
  const firstAvg = firstHalf.length
    ? firstHalf.reduce((sum, value) => sum + value, 0) / firstHalf.length
    : 0
  const secondAvg = secondHalf.length
    ? secondHalf.reduce((sum, value) => sum + value, 0) / secondHalf.length
    : 0
  const trend =
    secondAvg > firstAvg * 1.05
      ? "up"
      : secondAvg < firstAvg * 0.95
        ? "down"
        : "flat"

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: categoryColor.fill }}
            />
            <h3 className="truncate text-sm leading-tight font-medium text-foreground">
              {category.categoryLabel}
            </h3>
            {isSignificantChange && category.changeStatus === "up" ? (
              <span
                className="shrink-0"
                title={`Significant increase: ${deltaPercent.toFixed(1)}% MoM`}
              >
                <AlertCircle className="h-3.5 w-3.5 text-amber-400/80" />
              </span>
            ) : null}
            <span
              className={cn(
                "ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium tracking-wider uppercase",
                trend === "up"
                  ? "bg-rose-400/10 text-rose-400/90"
                  : trend === "down"
                    ? "bg-emerald-400/10 text-emerald-400/90"
                    : "bg-muted/50 text-muted-foreground/70"
              )}
            >
              {trend === "up"
                ? "rising"
                : trend === "down"
                  ? "falling"
                  : "stable"}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] tracking-wider text-muted-foreground/70 uppercase">
            {category.categoryGroupLabel}
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {currentAmount.toLocaleString("pl-PL", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </span>
        <span className="text-sm text-muted-foreground">zł</span>
        {category.changeStatus !== "flat" &&
        category.changeStatus !== "no_previous" ? (
          <span
            className={cn(
              "ml-auto text-xs font-medium tabular-nums",
              deltaColor
            )}
          >
            {deltaIcon} {Math.abs(deltaPercent).toFixed(1)}%
          </span>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">— 0.0%</span>
        )}
      </div>

      {category.history && category.history.length > 0 ? (
        <div
          className="-mx-1 mb-2 min-w-0"
          style={{ height: 56, minHeight: 56, minWidth: 100 }}
        >
          {mounted ? (
            <ResponsiveContainer height={56} width="100%">
              <AreaChart
                data={category.history}
                margin={{ top: 4, right: 0, left: 0, bottom: 4 }}
              >
                <defs>
                  <linearGradient
                    id={`gradient-${category.category}`}
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={categoryColor.fill}
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor={categoryColor.fill}
                      stopOpacity={0.05}
                    />
                  </linearGradient>
                </defs>
                <YAxis domain={["dataMin - 10", "dataMax + 10"]} hide />
                <ReferenceLine
                  stroke="var(--muted-foreground)"
                  strokeDasharray="2 2"
                  strokeOpacity={0.25}
                  y={avgValue}
                />
                <Area
                  dataKey="value"
                  dot={false}
                  fill={`url(#gradient-${category.category})`}
                  isAnimationActive={false}
                  stroke={categoryColor.stroke}
                  strokeWidth={1.5}
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : null}
        </div>
      ) : null}

      <div className="mb-2 flex items-center gap-3 border-b border-border/50 pb-2 text-[10px] opacity-50 transition-opacity hover:opacity-80">
        <div className="flex items-center gap-1">
          <span className="tracking-wider text-muted-foreground uppercase">
            avg
          </span>
          <span className="font-mono text-muted-foreground tabular-nums">
            {avgValue.toFixed(0)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="tracking-wider text-muted-foreground uppercase">
            min
          </span>
          <span className="font-mono text-muted-foreground tabular-nums">
            {minValue.toFixed(0)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="tracking-wider text-muted-foreground uppercase">
            max
          </span>
          <span className="font-mono text-muted-foreground tabular-nums">
            {maxValue.toFixed(0)}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Previous</span>
          <span className="font-mono text-foreground/80 tabular-nums">
            {previousAmount.toLocaleString("pl-PL", {
              minimumFractionDigits: 0,
            })}{" "}
            zł
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Delta</span>
          <span className={cn("font-mono tabular-nums", deltaColor)}>
            {category.delta.amountMinor >= 0 ? "+" : ""}
            {(category.delta.amountMinor / 100).toLocaleString("pl-PL", {
              minimumFractionDigits: 0,
            })}{" "}
            zł
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Share of total</span>
          <span className="font-mono text-foreground/80 tabular-nums">
            {category.sharePercent.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
        <span className="max-w-[60%] truncate font-mono text-[10px] text-muted-foreground/60">
          {category.sourceDocuments[0]?.title ?? "No source"}
        </span>
        <Badge className="h-4 px-1 py-0 text-[9px]" variant="outline">
          {category.sourceDocuments.length} doc(s)
        </Badge>
      </div>
    </div>
  )
}

function MonthlyTrendChart({
  data,
  categories,
}: {
  data: MonthlyTrendData[]
  categories: CategoryBreakdown[]
}) {
  const mounted = useClientReady()
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null)

  const avgTotal = data.reduce((sum, item) => sum + item.total, 0) / data.length
  const maxTotal = Math.max(...data.map((item) => item.total))
  const minTotal = Math.min(...data.map((item) => item.total))
  const chartData: ChartDataPoint[] = data.map((monthData, monthIndex) => {
    const prevTotal =
      monthIndex > 0 ? data[monthIndex - 1].total : monthData.total
    const point: ChartDataPoint = {
      month: monthData.month,
      monthShort: monthData.month.substring(0, 3),
      total: monthData.total,
      carriedForward: monthData.carriedForward,
      hasAnomaly: monthData.hasAnomaly,
      vsAvg: ((monthData.total - avgTotal) / avgTotal) * 100,
      momChange:
        monthIndex > 0 ? ((monthData.total - prevTotal) / prevTotal) * 100 : 0,
    }

    for (const category of categories) {
      point[category.category] = category.history?.[monthIndex]?.value ?? 0
    }

    return point
  })
  const sortedCategories = [...categories].sort(
    (left, right) => right.amount.amountMinor - left.amount.amountMinor
  )

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-5 pb-0">
        <div>
          <h2 className="text-base font-medium text-foreground">
            Monthly Trend
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            12-month charges by category · avg {avgTotal.toFixed(0)} zl
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed border-muted-foreground/60" />
            12m avg
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-400/70" />
            Anomaly
          </span>
        </div>
      </div>

      <div className="flex gap-4 p-4 pt-2">
        <div className="min-w-0 flex-1" style={{ height: 340, minHeight: 340 }}>
          {mounted ? (
            <ResponsiveContainer height={340} width="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 24, right: 12, left: 0, bottom: 0 }}
                onMouseLeave={() => setHoveredMonth(null)}
                onMouseMove={(event) => {
                  if (event?.activeLabel) {
                    setHoveredMonth(String(event.activeLabel))
                  }
                }}
              >
                <XAxis
                  axisLine={false}
                  dataKey="monthShort"
                  dy={8}
                  tick={{ fill: "oklch(0.55 0 0)", fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  axisLine={false}
                  domain={[0, maxTotal * 1.1]}
                  tick={{ fill: "oklch(0.55 0 0)", fontSize: 11 }}
                  tickFormatter={(value) => `${value}`}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  content={
                    <TrendTooltip avgTotal={avgTotal} categories={categories} />
                  }
                  cursor={{ fill: "oklch(0.20 0.005 260)", opacity: 0.4 }}
                />
                <ReferenceLine
                  stroke="oklch(0.50 0 0)"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  y={avgTotal}
                />

                {sortedCategories.map((category) => {
                  const color = getCategoryColor(category.category)

                  return (
                    <Bar
                      dataKey={category.category}
                      fill={color.fill}
                      key={category.category}
                      radius={0}
                      stackId="categories"
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          fillOpacity={
                            entry.carriedForward
                              ? 0.5
                              : hoveredMonth &&
                                  entry.monthShort !== hoveredMonth
                                ? 0.6
                                : 1
                          }
                          key={`${category.category}-cell-${index}`}
                          stroke={
                            entry.carriedForward
                              ? "oklch(0.75 0.15 85)"
                              : "none"
                          }
                          strokeDasharray={
                            entry.carriedForward ? "2 2" : undefined
                          }
                          strokeWidth={entry.carriedForward ? 1 : 0}
                        />
                      ))}
                    </Bar>
                  )
                })}

                {chartData.map((entry) =>
                  entry.hasAnomaly ? (
                    <ReferenceDot
                      fill="oklch(0.65 0.20 25)"
                      key={`anomaly-${entry.monthShort}`}
                      r={4}
                      stroke="oklch(0.75 0.18 25)"
                      strokeWidth={1.5}
                      x={String(entry.monthShort)}
                      y={Number(entry.total) + maxTotal * 0.04}
                    />
                  ) : null
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : null}
        </div>

        <div className="flex w-40 shrink-0 flex-col justify-center gap-1.5 border-l border-border pl-4 text-xs">
          <span className="mb-1 text-[10px] tracking-wider text-muted-foreground/50 uppercase">
            By Category
          </span>
          {sortedCategories.slice(0, 8).map((category) => {
            const color = getCategoryColor(category.category)
            const currentValue = category.amount.amountMinor / 100

            return (
              <div
                className="group flex cursor-default items-center gap-2"
                key={category.category}
              >
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-sm transition-transform group-hover:scale-110"
                  style={{ backgroundColor: color.fill }}
                />
                <span className="flex-1 truncate text-[11px] text-muted-foreground transition-colors group-hover:text-foreground">
                  {category.categoryLabel}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60 tabular-nums">
                  {currentValue.toFixed(0)}
                </span>
              </div>
            )
          })}
          {sortedCategories.length > 8 ? (
            <span className="pl-4 text-[10px] text-muted-foreground/40">
              +{sortedCategories.length - 8} more
            </span>
          ) : null}

          <div className="mt-3 space-y-1 border-t border-border/50 pt-3">
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground/60">Range</span>
              <span className="font-mono text-muted-foreground/80 tabular-nums">
                {minTotal.toFixed(0)} – {maxTotal.toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground/60">Variance</span>
              <span className="font-mono text-muted-foreground/80 tabular-nums">
                {(((maxTotal - minTotal) / avgTotal) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TrendTooltip({
  active,
  avgTotal,
  categories,
  payload,
}: {
  active?: boolean
  avgTotal: number
  categories: CategoryBreakdown[]
  payload?: Array<{
    color?: string
    dataKey?: string
    name?: string
    payload: ChartDataPoint
    value?: number
  }>
}) {
  if (!active || !payload?.length) {
    return null
  }

  const data = payload[0].payload
  const total = Number(data.total)
  const categoryEntries = categories
    .map((category) => ({
      color: getCategoryColor(category.category),
      key: category.category,
      label: category.categoryLabel,
      value: Number(data[category.category] ?? 0),
    }))
    .filter((entry) => entry.value > 0)
    .sort((left, right) => right.value - left.value)
  const vsAvgPercent = ((total - avgTotal) / avgTotal) * 100
  const vsAvgColor =
    vsAvgPercent > 5
      ? "text-rose-400"
      : vsAvgPercent < -5
        ? "text-emerald-400"
        : "text-muted-foreground"

  return (
    <div className="min-w-[240px] rounded-lg border border-border bg-card p-3 text-sm shadow-xl">
      <div className="mb-2.5 flex items-center justify-between border-b border-border pb-2">
        <span className="font-medium text-foreground">{data.month}</span>
        <div className="flex items-center gap-2">
          {data.carriedForward ? (
            <span className="rounded bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] text-amber-400/80">
              CFW
            </span>
          ) : null}
          {data.hasAnomaly ? (
            <span className="rounded bg-rose-400/10 px-1.5 py-0.5 font-mono text-[10px] text-rose-400/80">
              !
            </span>
          ) : null}
        </div>
      </div>

      <div className="mb-2.5 space-y-1">
        {categoryEntries.slice(0, 6).map((entry) => {
          const percent = (entry.value / total) * 100

          return (
            <div
              className="flex items-center justify-between gap-3 text-xs"
              key={entry.key}
            >
              <span className="flex flex-1 items-center gap-1.5 truncate text-muted-foreground">
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-sm"
                  style={{ backgroundColor: entry.color.fill }}
                />
                <span className="truncate">{entry.label}</span>
              </span>
              <span className="shrink-0 font-mono text-foreground/80 tabular-nums">
                {entry.value.toFixed(0)}
              </span>
              <span className="w-8 shrink-0 text-right font-mono text-[10px] text-muted-foreground/60 tabular-nums">
                {percent.toFixed(0)}%
              </span>
            </div>
          )
        })}
        {categoryEntries.length > 6 ? (
          <div className="pl-3.5 text-[10px] text-muted-foreground/50">
            +{categoryEntries.length - 6} more categories
          </div>
        ) : null}
      </div>

      <div className="space-y-1 border-t border-border pt-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Total</span>
          <span className="font-mono font-medium text-foreground tabular-nums">
            {total.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zl
          </span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground/70">vs 12m avg</span>
          <span className={cn("font-mono tabular-nums", vsAvgColor)}>
            {vsAvgPercent >= 0 ? "+" : ""}
            {vsAvgPercent.toFixed(1)}%
          </span>
        </div>
        {Number(data.momChange) !== 0 ? (
          <div className="flex justify-between text-[10px]">
            <span className="text-muted-foreground/70">vs prev month</span>
            <span
              className={cn(
                "font-mono tabular-nums",
                Number(data.momChange) > 0
                  ? "text-rose-400/80"
                  : "text-emerald-400/80"
              )}
            >
              {Number(data.momChange) >= 0 ? "+" : ""}
              {Number(data.momChange).toFixed(1)}%
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function OpenItemsPanel({
  anomalies,
  reconciliationSummary,
}: {
  anomalies: Anomaly[]
  reconciliationSummary: ReconciliationSummary
}) {
  const openAnomalies = anomalies.filter((anomaly) => anomaly.status === "open")
  const withDates = openAnomalies.filter((anomaly) => anomaly.date)
  const withoutDates = openAnomalies.filter((anomaly) => !anomaly.date)
  const isAllClear =
    openAnomalies.length === 0 && reconciliationSummary.openLineCount === 0

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-5 pb-0">
        <div>
          <h2 className="text-base font-medium text-foreground">
            Open Items & Anomalies
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Detected issues requiring attention
          </p>
        </div>
        <div className="flex items-center gap-2">
          {reconciliationSummary.openLineCount > 0 ? (
            <Badge className="border-amber-400/30 text-xs" variant="outline">
              <span className="mr-1 text-amber-400">
                {reconciliationSummary.openLineCount}
              </span>
              <span className="text-muted-foreground">
                reconciliation lines
              </span>
            </Badge>
          ) : null}
          <Badge className="text-xs" variant="outline">
            <span className="mr-1 text-foreground">{openAnomalies.length}</span>
            <span className="text-muted-foreground">anomalies</span>
          </Badge>
        </div>
      </div>

      {isAllClear ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10">
            <svg
              className="h-6 w-6 text-emerald-400/80"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M5 13l4 4L19 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="mb-1 text-sm font-medium text-foreground">
            All clear
          </h3>
          <p className="max-w-[240px] text-xs text-muted-foreground">
            No anomalies detected and all reconciliation lines are resolved.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Time-sensitive
              </h3>
            </div>
            <div className="space-y-2">
              {withDates.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No time-sensitive anomalies
                </div>
              ) : (
                withDates.map((anomaly) => {
                  const [day, month] = new Date(anomaly.date)
                    .toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })
                    .split(" ")

                  return (
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors",
                        SEVERITY_COLORS[anomaly.severity].bg
                      )}
                      key={anomaly.id}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-secondary text-center">
                        <div>
                          <div className="text-xs font-medium text-foreground">
                            {day}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {month}
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <SeverityIcon severity={anomaly.severity} />
                          <span
                            className={cn(
                              "text-sm font-medium",
                              SEVERITY_COLORS[anomaly.severity].text
                            )}
                          >
                            {anomaly.ruleLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {anomaly.summary}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Other anomalies
              </h3>
            </div>
            <div className="space-y-2">
              {withoutDates.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No other anomalies
                </div>
              ) : (
                withoutDates.map((anomaly) => (
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors",
                      SEVERITY_COLORS[anomaly.severity].bg
                    )}
                    key={anomaly.id}
                  >
                    <div className="mt-0.5">
                      <SeverityIcon severity={anomaly.severity} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          SEVERITY_COLORS[anomaly.severity].text
                        )}
                      >
                        {anomaly.summary}
                      </span>
                      {anomaly.context.length > 0 ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {anomaly.context
                            .slice(0, 2)
                            .map(
                              (context) => `${context.label}: ${context.value}`
                            )
                            .join(" · ")}
                        </p>
                      ) : null}
                      {anomaly.subjectDocument ? (
                        <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/60">
                          {anomaly.subjectDocument.title}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DocumentsTable({ documents }: { documents: DocumentListItem[] }) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium">Recent source documents</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-normal text-muted-foreground">
              Title
            </TableHead>
            <TableHead className="text-xs font-normal text-muted-foreground">
              Type
            </TableHead>
            <TableHead className="text-xs font-normal text-muted-foreground">
              Date
            </TableHead>
            <TableHead className="text-xs font-normal text-muted-foreground">
              Hash
            </TableHead>
            <TableHead className="text-xs font-normal text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="text-xs font-normal text-muted-foreground">
              Period
            </TableHead>
            <TableHead className="w-8 text-xs font-normal text-muted-foreground" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => (
            <TableRow className="group cursor-pointer" key={document.hash}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{document.title}</span>
                </div>
              </TableCell>
              <TableCell>
                <DocumentTypeBadge type={document.documentType} />
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {document.documentDate}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {document.hash}
              </TableCell>
              <TableCell>
                <ExtractionStatusBadge
                  confidence={document.confidence}
                  status={document.status}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {document.period?.label ?? "—"}
              </TableCell>
              <TableCell>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function DocumentTypeBadge({
  type,
}: {
  type: DocumentListItem["documentType"]
}) {
  const colors: Record<DocumentListItem["documentType"], string> = {
    monthly_charge: "text-blue-400 border-blue-400/30",
    settlement: "text-emerald-400 border-emerald-400/30",
    resolution: "text-purple-400 border-purple-400/30",
  }
  const labels: Record<DocumentListItem["documentType"], string> = {
    monthly_charge: "zawiadomienie",
    settlement: "rozliczenie",
    resolution: "uchwała",
  }

  return (
    <Badge
      className={cn("text-xs font-normal", colors[type])}
      variant="outline"
    >
      {labels[type]}
    </Badge>
  )
}

function ExtractionStatusBadge({
  confidence,
  status,
}: {
  confidence: number
  status: DocumentListItem["status"]
}) {
  const config: Record<
    DocumentListItem["status"],
    { color: string; dot: string }
  > = {
    ok: { color: "text-emerald-400", dot: "bg-emerald-400" },
    needs_review: { color: "text-amber-400", dot: "bg-amber-400" },
    pending: { color: "text-amber-400", dot: "bg-amber-400" },
    failed: { color: "text-rose-400", dot: "bg-rose-400" },
  }
  const state = config[status] ?? {
    color: "text-muted-foreground",
    dot: "bg-muted-foreground",
  }

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", state.color)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", state.dot)} />
      {status === "ok"
        ? `extracted · ${confidence.toFixed(2)}`
        : status.replace("_", " ")}
    </div>
  )
}

function SeverityIcon({ severity }: { severity: Anomaly["severity"] }) {
  const colors = SEVERITY_COLORS[severity]

  switch (severity) {
    case "critical":
      return <AlertTriangle className={cn("h-3.5 w-3.5", colors.icon)} />
    case "warning":
      return <AlertCircle className={cn("h-3.5 w-3.5", colors.icon)} />
    case "info":
      return <Info className={cn("h-3.5 w-3.5", colors.icon)} />
    default:
      return null
  }
}

function getCategoryColor(category: string): CategoryColor {
  return CATEGORY_COLORS[category] ?? DEFAULT_CATEGORY_COLOR
}

function extractTime(value: string): string {
  if (!value.includes("T")) {
    return value
  }

  return value.split("T")[1]?.slice(0, 5) ?? value
}

function useClientReady(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot
  )
}

function subscribeNoop(): () => void {
  return () => undefined
}

function getClientSnapshot(): boolean {
  return true
}

function getServerSnapshot(): boolean {
  return false
}
