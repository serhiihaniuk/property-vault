import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/src/shared/lib/utils";

function MetricLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="metric-label"
      className={cn(
        "text-[11px] uppercase tracking-[0.06em] text-fg-subtle",
        className,
      )}
      {...props}
    />
  );
}

const metricValueVariants = cva(
  "inline-flex items-baseline gap-1.5 font-mono font-medium tracking-tight text-fg-primary tabular-nums",
  {
    variants: {
      size: {
        hero: "text-[3rem] leading-none",
        lg: "text-[1.75rem] leading-tight",
        md: "text-[1.125rem] leading-tight",
        sm: "text-[0.95rem] leading-tight",
      },
      tone: {
        default: "text-fg-primary",
        muted: "text-fg-secondary",
        positive: "text-delta-positive",
        negative: "text-delta-negative",
        warning: "text-status-warning",
      },
    },
    defaultVariants: {
      size: "lg",
      tone: "default",
    },
  },
);

type MetricValueProps = React.ComponentProps<"span"> &
  VariantProps<typeof metricValueVariants>;

function MetricValue({ className, size, tone, ...props }: MetricValueProps) {
  return (
    <span
      data-slot="metric-value"
      className={cn(metricValueVariants({ size, tone }), className)}
      {...props}
    />
  );
}

function MetricSub({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="metric-sub"
      className={cn(
        "font-mono text-[12.5px] font-normal tracking-tight text-fg-subtle tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Display a money amount stored as `amount_minor` (integer grosz / cents).
 *
 * Major and minor units render with separate weights so dense metric cards
 * keep visual rhythm without sacrificing precision in audits.
 */
function Money({
  amountMinor,
  currency = "PLN",
  size = "lg",
  tone = "default",
  showCurrency = true,
  showSign = false,
  locale = "pl-PL",
  className,
  ...props
}: Omit<MetricValueProps, "children" | "size" | "tone"> & {
  amountMinor: number | bigint | null | undefined;
  currency?: string;
  size?: VariantProps<typeof metricValueVariants>["size"];
  tone?: VariantProps<typeof metricValueVariants>["tone"];
  showCurrency?: boolean;
  showSign?: boolean;
  locale?: string;
}) {
  if (amountMinor === null || amountMinor === undefined) {
    return (
      <MetricValue
        size={size}
        tone="muted"
        className={cn("text-fg-subtle", className)}
        {...props}
      >
        —
      </MetricValue>
    );
  }

  const value = typeof amountMinor === "bigint" ? Number(amountMinor) : amountMinor;
  const negative = value < 0;
  const abs = Math.abs(value);
  const major = Math.trunc(abs / 100);
  const minor = abs % 100;

  const majorFormatted = new Intl.NumberFormat(locale, {
    useGrouping: true,
    maximumFractionDigits: 0,
  }).format(major);

  const sign = negative ? "−" : showSign ? "+" : "";

  return (
    <MetricValue size={size} tone={tone} className={className} {...props}>
      <span>
        {sign}
        {majorFormatted}
      </span>
      <span className="text-fg-subtle">.{minor.toString().padStart(2, "0")}</span>
      {showCurrency ? (
        <span className="text-[0.6em] font-normal uppercase tracking-[0.04em] text-fg-subtle">
          {currency}
        </span>
      ) : null}
    </MetricValue>
  );
}

export { MetricLabel, MetricValue, MetricSub, Money, metricValueVariants };
