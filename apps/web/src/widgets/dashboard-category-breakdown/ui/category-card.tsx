"use client"

import { useMemo } from "react"
import { AlertCircle } from "lucide-react"
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  YAxis,
} from "recharts"

import { useClientReady } from "@/src/shared/hooks/use-client-ready"
import { getCategoryColor } from "@/src/shared/lib/dashboard-category-colors"
import { type CategoryBreakdown } from "@/src/shared/lib/dashboard-v0"
import { cn } from "@/src/shared/lib/utils"
import { Badge } from "@/src/shared/ui/badge"

interface CategoryCardProps {
  category: CategoryBreakdown
}

export function CategoryCard({ category }: CategoryCardProps) {
  const clientReady = useClientReady()
  const categoryColor = getCategoryColor(category.category)
  const currentAmountMinor = category.amount.amountMinor
  const previousAmountMinor = category.previousAmount?.amountMinor ?? 0
  const deltaPercent =
    category.previousAmount && previousAmountMinor > 0
      ? ((currentAmountMinor - previousAmountMinor) / previousAmountMinor) * 100
      : null
  const isSignificantChange =
    deltaPercent !== null && Math.abs(deltaPercent) > 10
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

  const { avgValue, maxValue, minValue, trend } = useMemo(() => {
    if (!category.history || category.history.length === 0) {
      return { avgValue: 0, maxValue: 0, minValue: 0, trend: "flat" as const }
    }

    const values = category.history.map((entry) => entry.value)
    const avgValue =
      values.reduce((accumulator, value) => accumulator + value, 0) /
      values.length
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)

    if (values.length < 2) {
      return { avgValue, maxValue, minValue, trend: "flat" as const }
    }

    const splitIndex = Math.floor(values.length / 2)
    const firstHalf = values.slice(0, splitIndex)
    const secondHalf = values.slice(splitIndex)
    const firstAverage =
      firstHalf.reduce((accumulator, value) => accumulator + value, 0) /
      firstHalf.length
    const secondAverage =
      secondHalf.reduce((accumulator, value) => accumulator + value, 0) /
      secondHalf.length
    const trend =
      secondAverage > firstAverage * 1.05
        ? "up"
        : secondAverage < firstAverage * 0.95
          ? "down"
          : ("flat" as const)

    return { avgValue, maxValue, minValue, trend }
  }, [category.history])

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
                title={`Significant increase: ${deltaPercent?.toFixed(1)}% MoM`}
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
            maximumFractionDigits: 0,
            minimumFractionDigits: 0,
          })}
        </span>
        <span className="text-sm text-muted-foreground">zł</span>
        {category.changeStatus !== "flat" &&
        category.changeStatus !== "no_previous" &&
        deltaPercent !== null ? (
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
          className="-mx-1 mb-2 w-full min-w-0"
          style={{ height: 56, minHeight: 56, minWidth: 100 }}
        >
          {clientReady ? (
            <ResponsiveContainer height={56} width="100%">
              <AreaChart
                data={category.history}
                margin={{ bottom: 4, left: 0, right: 0, top: 4 }}
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
            {category.previousAmount
              ? `${previousAmount.toLocaleString("pl-PL", {
                  minimumFractionDigits: 0,
                })} zł`
              : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">Delta</span>
          <span className={cn("font-mono tabular-nums", deltaColor)}>
            {category.delta
              ? `${category.delta.amountMinor >= 0 ? "+" : ""}${(
                  category.delta.amountMinor / 100
                ).toLocaleString("pl-PL", {
                  minimumFractionDigits: 0,
                })} zł`
              : "—"}
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
        <Badge className="h-4 shrink-0 px-1 py-0 text-[9px]" variant="outline">
          {category.sourceDocuments.length} doc(s)
        </Badge>
      </div>
    </div>
  )
}
