import * as React from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/src/shared/lib/utils";

const deltaVariants = cva(
  "inline-flex items-center gap-1 font-mono text-[12px] tabular-nums tracking-tight",
  {
    variants: {
      intent: {
        positive: "text-delta-positive",
        negative: "text-delta-negative",
        neutral: "text-delta-neutral",
        review: "text-delta-review",
      },
      size: {
        sm: "text-[11px]",
        md: "text-[12px]",
        lg: "text-[13px]",
      },
    },
    defaultVariants: {
      intent: "neutral",
      size: "md",
    },
  },
);

type DeltaIntent = NonNullable<VariantProps<typeof deltaVariants>["intent"]>;

const intentIcon: Record<DeltaIntent, React.ComponentType<{ className?: string }>> = {
  positive: ArrowDownRight,
  negative: ArrowUpRight,
  neutral: ArrowRight,
  review: Minus,
};

/**
 * Property-ops convention: a *higher cost* is a negative delta. Callers should
 * derive `intent` from the financial meaning of the change, not from the raw
 * sign of `valueLabel`.
 */
function DeltaValue({
  className,
  intent = "neutral",
  size,
  valueLabel,
  contextLabel,
  hideIcon = false,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> &
  VariantProps<typeof deltaVariants> & {
    valueLabel: React.ReactNode;
    contextLabel?: React.ReactNode;
    hideIcon?: boolean;
  }) {
  const Icon = intentIcon[intent ?? "neutral"];
  return (
    <span
      data-slot="delta-value"
      data-intent={intent}
      className={cn(deltaVariants({ intent, size }), className)}
      {...props}
    >
      {hideIcon ? null : <Icon className="size-3.5 shrink-0" aria-hidden />}
      <span>{valueLabel}</span>
      {contextLabel ? (
        <span className="text-fg-subtle">{contextLabel}</span>
      ) : null}
    </span>
  );
}

export { DeltaValue, deltaVariants, type DeltaIntent };
