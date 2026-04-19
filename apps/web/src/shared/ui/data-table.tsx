import * as React from "react";

import { cn } from "@/src/shared/lib/utils";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/shared/ui/table";

/**
 * Dense, audit-friendly wrapper around the shadcn `Table` primitive.
 *
 * Adds:
 *   - dashed row dividers and tightened cell padding for operator density,
 *   - mono / tabular-nums utility classes via `numeric` cell prop,
 *   - reduced header weight aligned with the rest of the design system.
 *
 * Composition stays identical to shadcn `Table`, so views can drop in here
 * instead of the raw primitive without learning a new API.
 */
function DataTable({ className, ...props }: React.ComponentProps<typeof Table>) {
  return (
    <Table
      data-variant="data-table"
      className={cn("text-[12.5px]", className)}
      {...props}
    />
  );
}

function DataTableHeader({
  className,
  ...props
}: React.ComponentProps<typeof TableHeader>) {
  return (
    <TableHeader
      className={cn(
        "[&_tr]:border-b-border-default [&_tr:hover]:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

function DataTableHead({
  className,
  numeric = false,
  ...props
}: React.ComponentProps<typeof TableHead> & { numeric?: boolean }) {
  return (
    <TableHead
      className={cn(
        "h-9 px-2 py-2 text-[10.5px] font-normal uppercase tracking-[0.06em] text-fg-subtle",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

function DataTableBody({
  className,
  divider = "dashed",
  ...props
}: React.ComponentProps<typeof TableBody> & {
  divider?: "dashed" | "solid" | "none";
}) {
  return (
    <TableBody
      className={cn(
        divider === "dashed" &&
          "[&_tr]:border-b [&_tr]:border-dashed [&_tr]:border-border-default [&_tr:last-child]:border-b-0",
        divider === "solid" &&
          "[&_tr]:border-b [&_tr]:border-border-default [&_tr:last-child]:border-b-0",
        divider === "none" && "[&_tr]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

function DataTableRow({
  className,
  ...props
}: React.ComponentProps<typeof TableRow>) {
  return (
    <TableRow
      className={cn(
        "border-border-default hover:bg-surface-elevated/60 data-[state=selected]:bg-surface-elevated",
        className,
      )}
      {...props}
    />
  );
}

function DataTableCell({
  className,
  numeric = false,
  muted = false,
  ...props
}: React.ComponentProps<typeof TableCell> & {
  numeric?: boolean;
  muted?: boolean;
}) {
  return (
    <TableCell
      className={cn(
        "px-2 py-2 align-middle text-fg-primary",
        numeric && "text-right font-mono tabular-nums",
        muted && "text-fg-secondary",
        className,
      )}
      {...props}
    />
  );
}

export {
  DataTable,
  DataTableHeader,
  DataTableHead,
  DataTableBody,
  DataTableRow,
  DataTableCell,
  TableCaption,
  TableFooter,
};
