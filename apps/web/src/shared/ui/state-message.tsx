import * as React from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

import { cn } from "@/src/shared/lib/utils";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/src/shared/ui/alert";
import { Skeleton } from "@/src/shared/ui/skeleton";

/**
 * Skeleton placeholder for surfaces that are still loading their async data.
 *
 * Uses the shadcn `Skeleton` primitive but applies the design system's
 * elevated-surface tint and standard heights so loading states stay visually
 * consistent across dashboards.
 */
function LoadingState({
  className,
  rows = 3,
  showHeader = true,
  label,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  rows?: number;
  showHeader?: boolean;
  label?: string;
}) {
  return (
    <div
      data-slot="loading-state"
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      {showHeader ? (
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-32 bg-surface-elevated" />
          <Skeleton className="h-3 w-16 bg-surface-elevated" />
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-3.5 w-full bg-surface-elevated"
          />
        ))}
      </div>
      <span className="sr-only">{label ?? "Loading…"}</span>
    </div>
  );
}

function LoadingInline({
  className,
  label = "Loading…",
  ...props
}: React.ComponentProps<"span"> & { label?: string }) {
  return (
    <span
      data-slot="loading-inline"
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 text-[12px] text-fg-subtle",
        className,
      )}
      {...props}
    >
      <Loader2 className="size-3.5 animate-spin" aria-hidden />
      <span>{label}</span>
    </span>
  );
}

function EmptyState({
  className,
  icon: Icon = Inbox,
  title,
  description,
  action,
  ...props
}: Omit<React.ComponentProps<"div">, "children" | "title"> & {
  icon?: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-start gap-3 rounded-md border border-dashed border-border-default bg-surface-subtle/40 px-4 py-5 text-[12.5px]",
        className,
      )}
      {...props}
    >
      <div className="grid size-8 place-items-center rounded-md border border-border-default bg-surface-elevated text-fg-subtle">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-medium text-fg-primary">{title}</span>
        {description ? (
          <span className="text-fg-subtle">{description}</span>
        ) : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

function ErrorState({
  className,
  title = "Something went wrong",
  description,
  action,
  ...props
}: Omit<React.ComponentProps<typeof Alert>, "children" | "title"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Alert
      data-slot="error-state"
      variant="destructive"
      className={cn(
        "border-status-danger/25 bg-status-danger-bg text-status-danger",
        className,
      )}
      {...props}
    >
      <AlertTriangle aria-hidden />
      <AlertTitle>{title}</AlertTitle>
      {description ? (
        <AlertDescription className="text-status-danger/90">
          {description}
        </AlertDescription>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </Alert>
  );
}

export { LoadingState, LoadingInline, EmptyState, ErrorState };
