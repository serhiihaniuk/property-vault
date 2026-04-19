import * as React from "react";

import { cn } from "@/src/shared/lib/utils";
import { Badge } from "@/src/shared/ui/badge";

type StatusKind =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "pending"
  | "missing"
  | "neutral";

type StatusBadgeProps = React.ComponentProps<typeof Badge> & {
  status?: StatusKind;
  dot?: boolean;
};

/**
 * Semantic status badge that composes the shared `Badge` primitive.
 *
 * Maps the design-system `status` token onto `Badge`'s variant API and adds
 * an optional leading dot — keeping the visual rhythm consistent with the
 * dashboard's category/anomaly chips while reusing the shadcn primitive.
 */
function StatusBadge({
  status = "neutral",
  dot = false,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge
      data-slot="status-badge"
      data-status={status}
      variant={status}
      className={cn("gap-1.5 font-medium", className)}
      {...props}
    >
      {dot ? (
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
      ) : null}
      {children}
    </Badge>
  );
}

export { StatusBadge, type StatusKind };
