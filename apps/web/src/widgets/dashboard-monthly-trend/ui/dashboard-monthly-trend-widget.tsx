"use client"

import { useMemo, useState } from "react"
import {
  Bar,
  Cell,
  ComposedChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { useClientReady } from "@/src/shared/hooks/use-client-ready"
import { getCategoryColor } from "@/src/shared/lib/dashboard-category-colors"
import {
  type CategoryBreakdown,
  type DashboardSurfaceStateKind,
  type MonthlyTrendData,
} from "@/src/shared/lib/dashboard-v0"
import { cn } from "@/src/shared/lib/utils"
import { LoadingState, Skeleton } from "@/src/shared/ui"

interface DashboardMonthlyTrendWidgetProps {
  categories: CategoryBreakdown[]
  data: MonthlyTrendData[]
  rangeLabel: string
  state: DashboardSurfaceStateKind
  unavailableReason?: string | null
}

type ChartDataPoint = {
  month: string
  monthKey: string
  monthShort: string
  total: number
  carriedForward: boolean
  hasAnomaly: boolean
  vsAvg: number
  momChange: number
} & Record<string, number | string | boolean>

interface TrendTooltipProps {
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
}

function TrendTooltip({
  active,
  avgTotal,
  categories,
  payload,
}: TrendTooltipProps) {
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
  const vsAvgPercent = avgTotal > 0 ? ((total - avgTotal) / avgTotal) * 100 : 0
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
          const percent = total > 0 ? (entry.value / total) * 100 : 0

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
            {total.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
          </span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-muted-foreground/70">vs range avg</span>
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

export function DashboardMonthlyTrendWidget({
  categories,
  data,
  rangeLabel,
  state,
  unavailableReason,
}: DashboardMonthlyTrendWidgetProps) {
  const clientReady = useClientReady()
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null)
  const isLoading = state === "loading"
  const isError = state === "error"
  const hasTrendData = data.length > 0 && categories.length > 0
  const avgTotal = useMemo(() => {
    if (!hasTrendData) {
      return 0
    }

    return data.reduce((sum, entry) => sum + entry.total, 0) / data.length
  }, [data, hasTrendData])
  const maxTotal = useMemo(() => {
    if (!hasTrendData) {
      return 0
    }

    return Math.max(...data.map((entry) => entry.total))
  }, [data, hasTrendData])
  const minTotal = useMemo(() => {
    if (!hasTrendData) {
      return 0
    }

    return Math.min(...data.map((entry) => entry.total))
  }, [data, hasTrendData])

  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!hasTrendData) {
      return []
    }

    return data.map((monthData, monthIndex) => {
      const previousTotal =
        monthIndex > 0 ? data[monthIndex - 1].total : monthData.total
      const monthOverMonthChange =
        previousTotal > 0
          ? ((monthData.total - previousTotal) / previousTotal) * 100
          : 0

      const point: ChartDataPoint = {
        carriedForward: monthData.carriedForward,
        hasAnomaly: monthData.hasAnomaly,
        momChange: monthIndex > 0 ? monthOverMonthChange : 0,
        month: monthData.month,
        monthKey: `${monthIndex}-${monthData.month}`,
        monthShort: monthData.month.substring(0, 3),
        total: monthData.total,
        vsAvg:
          avgTotal > 0 ? ((monthData.total - avgTotal) / avgTotal) * 100 : 0,
      }

      categories.forEach((category) => {
        point[category.category] =
          category.history && category.history[monthIndex]
            ? category.history[monthIndex].value
            : 0
      })

      return point
    })
  }, [avgTotal, categories, data, hasTrendData])

  const sortedCategories = useMemo(
    () =>
      [...categories].sort(
        (left, right) => right.amount.amountMinor - left.amount.amountMinor
      ),
    [categories]
  )
  const chartMessage = isError
    ? unavailableReason ??
      "Historical monthly totals could not be loaded for the selected range."
    : unavailableReason ??
      "Sync additional dashboard months to populate the trend view."

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-5 pb-0">
        <div>
          <h2 className="text-base font-medium text-foreground">
            Monthly Trend
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {rangeLabel} · avg{" "}
            {!isLoading && hasTrendData ? avgTotal.toFixed(0) : "—"} zł
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed border-muted-foreground/60" />
            range avg
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-rose-400/70" />
            Anomaly
          </span>
        </div>
      </div>

      <div className="flex gap-4 p-4 pt-2">
        <div className="min-w-0 flex-1" style={{ height: 340, minHeight: 340 }}>
          {!isLoading && hasTrendData && clientReady ? (
            <ResponsiveContainer height={340} width="100%">
              <ComposedChart
                data={chartData}
                margin={{ bottom: 0, left: 0, right: 12, top: 24 }}
                onMouseLeave={() => setHoveredMonth(null)}
                onMouseMove={(event) => {
                  if (event?.activeLabel) {
                    setHoveredMonth(String(event.activeLabel))
                  }
                }}
              >
                <XAxis
                  axisLine={false}
                  dataKey="monthKey"
                  dy={8}
                  tickFormatter={(_value, index) =>
                    chartData[index]?.monthShort ?? ""
                  }
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
                      {chartData.map((entry) => (
                        <Cell
                          fillOpacity={
                            entry.carriedForward
                              ? 0.5
                              : hoveredMonth && entry.monthKey !== hoveredMonth
                                ? 0.6
                                : 1
                          }
                          key={`${category.category}-${entry.monthKey}`}
                          stroke={
                            entry.carriedForward
                              ? "oklch(0.75 0.15 85)"
                              : "none"
                          }
                          strokeDasharray={
                            entry.carriedForward ? "2 2" : "none"
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
                      key={`anomaly-${entry.monthKey}`}
                      r={4}
                      stroke="oklch(0.75 0.18 25)"
                      strokeWidth={1.5}
                      x={entry.monthKey}
                      y={entry.total + maxTotal * 0.04}
                    />
                  ) : null
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : isLoading || !clientReady ? (
            <LoadingState
              className="h-full justify-center rounded-md border border-dashed border-border/70 bg-background/30 p-4"
              label="Loading trend chart"
              rows={5}
              showHeader={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border/70 bg-background/30 p-4 text-center text-sm text-muted-foreground">
              {chartMessage}
            </div>
          )}
        </div>

        <div className="flex w-40 shrink-0 flex-col justify-center gap-1.5 border-l border-border pl-4 text-xs">
          <span className="mb-1 text-[10px] tracking-wider text-muted-foreground/50 uppercase">
            By Category
          </span>
          {isLoading ? (
            <>
              {Array.from({ length: 8 }).map((_, index) => (
                <div className="flex items-center gap-2" key={index}>
                  <Skeleton className="h-2.5 w-2.5 rounded-sm" />
                  <Skeleton className="h-3 w-20 flex-1" />
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
              <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
              </div>
            </>
          ) : hasTrendData ? (
            <>
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
                    {avgTotal > 0
                      ? (((maxTotal - minTotal) / avgTotal) * 100).toFixed(0)
                      : "0"}
                    %
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border/70 bg-background/30 p-3 text-[11px] text-muted-foreground">
              {chartMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
