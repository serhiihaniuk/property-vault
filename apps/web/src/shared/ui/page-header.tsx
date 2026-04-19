import * as React from "react";

import { cn } from "@/src/shared/lib/utils";

function PageHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 pb-4",
        className,
      )}
      {...props}
    />
  );
}

function PageHeaderHeading({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header-heading"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  );
}

function PageHeaderEyebrow({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="page-header-eyebrow"
      className={cn(
        "font-mono text-[11px] uppercase tracking-[0.08em] text-fg-subtle",
        className,
      )}
      {...props}
    />
  );
}

function PageHeaderTitle({ className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      data-slot="page-header-title"
      className={cn(
        "font-heading text-[1.4rem] font-semibold leading-tight tracking-tight text-fg-primary",
        className,
      )}
      {...props}
    />
  );
}

function PageHeaderDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="page-header-description"
      className={cn("max-w-prose text-[12.5px] text-fg-subtle", className)}
      {...props}
    />
  );
}

function PageHeaderActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="page-header-actions"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}

export {
  PageHeader,
  PageHeaderHeading,
  PageHeaderEyebrow,
  PageHeaderTitle,
  PageHeaderDescription,
  PageHeaderActions,
};
