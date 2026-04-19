import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/src/shared/lib/utils";

const surfaceVariants = cva(
  "group/surface relative flex flex-col rounded-lg border border-border-default bg-surface-card text-card-foreground shadow-(--shadow-card) transition-colors",
  {
    variants: {
      tone: {
        default: "",
        elevated: "bg-surface-elevated border-border-strong",
        muted: "bg-surface-subtle",
      },
      density: {
        comfortable: "gap-3 p-5",
        compact: "gap-2.5 p-4",
        dense: "gap-2 p-3.5",
      },
      interactive: {
        true: "cursor-pointer hover:border-border-strong hover:bg-surface-elevated",
        false: "",
      },
    },
    defaultVariants: {
      tone: "default",
      density: "compact",
      interactive: false,
    },
  },
);

type SurfaceProps = React.ComponentProps<"div"> &
  VariantProps<typeof surfaceVariants>;

function Surface({
  className,
  tone,
  density,
  interactive,
  ...props
}: SurfaceProps) {
  return (
    <div
      data-slot="surface"
      data-tone={tone ?? "default"}
      data-density={density ?? "compact"}
      className={cn(surfaceVariants({ tone, density, interactive }), className)}
      {...props}
    />
  );
}

function SurfaceHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="surface-header"
      className={cn(
        "flex items-start justify-between gap-3",
        "[&_+_[data-slot=surface-body]]:pt-0",
        className,
      )}
      {...props}
    />
  );
}

function SurfaceHeading({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="surface-heading"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    />
  );
}

function SurfaceTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="surface-title"
      className={cn(
        "text-[13.5px] font-medium tracking-tight text-fg-primary",
        className,
      )}
      {...props}
    />
  );
}

function SurfaceDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="surface-description"
      className={cn("text-[11.5px] text-fg-subtle", className)}
      {...props}
    />
  );
}

function SurfaceActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="surface-actions"
      className={cn("flex shrink-0 items-center gap-2", className)}
      {...props}
    />
  );
}

function SurfaceBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="surface-body"
      className={cn("flex flex-1 flex-col gap-3", className)}
      {...props}
    />
  );
}

function SurfaceFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="surface-footer"
      className={cn(
        "mt-1 flex items-center justify-between gap-3 border-t border-border-default pt-3 text-[12px] text-fg-subtle",
        className,
      )}
      {...props}
    />
  );
}

function SurfaceDivider({
  className,
  variant = "solid",
  ...props
}: React.ComponentProps<"div"> & { variant?: "solid" | "dashed" }) {
  return (
    <div
      data-slot="surface-divider"
      role="separator"
      className={cn(
        "h-px w-full",
        variant === "dashed"
          ? "border-t border-dashed border-border-default"
          : "bg-border-default",
        className,
      )}
      {...props}
    />
  );
}

/**
 * `DenseCard` — short alias for the dense, operator-console card variant.
 *
 * Use when a card hosts a category/tile/metric grid and needs the tightest
 * default density (matches the prototype's category cards).
 */
function DenseCard({ className, ...props }: SurfaceProps) {
  return (
    <Surface
      data-variant="dense-card"
      density="dense"
      className={cn(className)}
      {...props}
    />
  );
}

export {
  Surface,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
  SurfaceDescription,
  SurfaceActions,
  SurfaceBody,
  SurfaceFooter,
  SurfaceDivider,
  DenseCard,
  surfaceVariants,
};
