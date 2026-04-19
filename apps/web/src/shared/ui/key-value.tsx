import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/src/shared/lib/utils";

const kvGridVariants = cva("grid gap-x-4 gap-y-2 text-[12.5px]", {
  variants: {
    columns: {
      1: "grid-cols-1",
      2: "grid-cols-2",
      3: "grid-cols-3",
    },
    divider: {
      none: "",
      dashed: "[&>[data-slot=kv-row]]:border-b [&>[data-slot=kv-row]]:border-dashed [&>[data-slot=kv-row]]:border-border-default [&>[data-slot=kv-row]:last-child]:border-b-0 [&>[data-slot=kv-row]]:py-1.5",
      solid:
        "[&>[data-slot=kv-row]]:border-b [&>[data-slot=kv-row]]:border-border-default [&>[data-slot=kv-row]:last-child]:border-b-0 [&>[data-slot=kv-row]]:py-1.5",
    },
  },
  defaultVariants: {
    columns: 1,
    divider: "none",
  },
});

function KeyValueGrid({
  className,
  columns,
  divider,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof kvGridVariants>) {
  return (
    <div
      data-slot="kv-grid"
      className={cn(kvGridVariants({ columns, divider }), className)}
      {...props}
    />
  );
}

function KeyValueRow({
  className,
  label,
  value,
  hint,
  align = "between",
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  align?: "between" | "stack";
}) {
  if (align === "stack") {
    return (
      <div
        data-slot="kv-row"
        className={cn("flex flex-col gap-0.5", className)}
        {...props}
      >
        <span className="text-[11px] uppercase tracking-[0.04em] text-fg-subtle">
          {label}
        </span>
        <span className="font-mono text-[13px] tabular-nums text-fg-primary">
          {value}
        </span>
        {hint ? (
          <span className="text-[11px] text-fg-subtle">{hint}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-slot="kv-row"
      className={cn(
        "flex items-baseline justify-between gap-3",
        className,
      )}
      {...props}
    >
      <span className="text-fg-secondary">{label}</span>
      <span className="flex items-baseline gap-2 text-right font-mono tabular-nums text-fg-primary">
        {value}
        {hint ? (
          <span className="text-[11px] font-sans text-fg-subtle">{hint}</span>
        ) : null}
      </span>
    </div>
  );
}

export { KeyValueGrid, KeyValueRow, kvGridVariants };
