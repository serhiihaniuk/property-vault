import * as React from "react";

import { cn } from "@/src/shared/lib/utils";

function AppShell({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="app-shell"
      className={cn(
        "min-h-svh bg-surface-app text-fg-primary [&_*]:[font-feature-settings:'cv11','ss01','ss03']",
        className,
      )}
      {...props}
    />
  );
}

function AppShellHeader({ className, ...props }: React.ComponentProps<"header">) {
  return (
    <header
      data-slot="app-shell-header"
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 border-b border-border-default bg-surface-app/80 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-surface-app/70",
        className,
      )}
      {...props}
    />
  );
}

function AppShellBrand({
  className,
  initials,
  product,
  context,
  ...props
}: React.ComponentProps<"div"> & {
  initials: string;
  product: string;
  context?: string;
}) {
  return (
    <div
      data-slot="app-shell-brand"
      className={cn("flex items-center gap-3", className)}
      {...props}
    >
      <span
        aria-hidden
        className="grid size-7 place-items-center rounded-md bg-fg-primary text-[13px] font-semibold tracking-tight text-surface-app"
      >
        {initials}
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-tight text-fg-primary">
          {product}
        </span>
        {context ? (
          <span className="font-mono text-[11px] text-fg-subtle">{context}</span>
        ) : null}
      </div>
    </div>
  );
}

function AppShellActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="app-shell-actions"
      className={cn("ml-auto flex items-center gap-2", className)}
      {...props}
    />
  );
}

function AppShellMain({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="app-shell-main"
      className={cn(
        "mx-auto w-full max-w-[1280px] px-4 pb-20 pt-6 md:px-6",
        className,
      )}
      {...props}
    />
  );
}

export {
  AppShell,
  AppShellHeader,
  AppShellBrand,
  AppShellActions,
  AppShellMain,
};
