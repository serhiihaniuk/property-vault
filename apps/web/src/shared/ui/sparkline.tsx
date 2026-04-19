"use client";

import * as React from "react";
import { Area, AreaChart, YAxis } from "recharts";

import { cn } from "@/src/shared/lib/utils";
import {
  ChartContainer,
  type ChartConfig,
} from "@/src/shared/ui/chart";

type SparklineIntent = "neutral" | "positive" | "negative" | "warning";

type SparklineProps = Omit<
  React.ComponentProps<typeof ChartContainer>,
  "children" | "config"
> & {
  values: ReadonlyArray<number>;
  intent?: SparklineIntent;
  showArea?: boolean;
  ariaLabel?: string;
};

const INTENT_COLOR: Record<SparklineIntent, string> = {
  neutral: "var(--color-fg-secondary)",
  positive: "var(--color-delta-positive)",
  negative: "var(--color-delta-negative)",
  warning: "var(--color-status-warning)",
};

/**
 * Inline mini-trend built on top of the shadcn `chart` primitive (recharts
 * `AreaChart`). Sized for dense category cards.
 *
 * Returns `null` for fewer than two data points so callers don't need to
 * handle empty trend data themselves.
 */
function Sparkline({
  values,
  intent = "neutral",
  showArea = true,
  ariaLabel,
  className,
  ...props
}: SparklineProps) {
  const data = React.useMemo(
    () => values.map((value, index) => ({ index, value })),
    [values],
  );

  const config = React.useMemo<ChartConfig>(
    () => ({
      value: {
        label: "Trend",
        color: INTENT_COLOR[intent],
      },
    }),
    [intent],
  );

  if (values.length < 2) {
    return null;
  }

  return (
    <ChartContainer
      data-slot="sparkline"
      data-intent={intent}
      role="img"
      aria-label={ariaLabel ?? "trend"}
      config={config}
      className={cn(
        "aspect-auto h-7 w-full [&_.recharts-surface]:overflow-visible",
        className,
      )}
      {...props}
    >
      <AreaChart
        data={data}
        margin={{ top: 1, right: 0, bottom: 1, left: 0 }}
      >
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-value)"
          strokeWidth={1.25}
          fill={showArea ? "var(--color-value)" : "transparent"}
          fillOpacity={showArea ? 0.16 : 0}
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export { Sparkline, type SparklineIntent };
