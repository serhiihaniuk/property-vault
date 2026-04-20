import * as React from "react";
import { FileText, Hash } from "lucide-react";

import { cn } from "@/src/shared/lib/utils";

function DocumentChip({
  className,
  label,
  href,
  reference,
  icon: Icon = FileText,
  ...props
}: Omit<React.ComponentProps<"a">, "children"> & {
  label: React.ReactNode;
  reference?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const Component = href ? "a" : "span";
  return (
    <Component
      data-slot="document-chip"
      className={cn(
        "group/doc-chip inline-flex items-center gap-1.5 rounded border border-border-default bg-surface-elevated px-1.5 py-0.5 text-[11.5px] text-fg-secondary",
        href &&
          "transition-colors hover:border-border-strong hover:text-fg-primary",
        className,
      )}
      href={href}
      {...props}
    >
      <Icon className="size-3 shrink-0 text-fg-subtle" aria-hidden />
      <span className="truncate">{label}</span>
      {reference ? (
        <span className="font-mono text-[10.5px] text-fg-subtle">
          {reference}
        </span>
      ) : null}
    </Component>
  );
}

function ProvenanceBlock({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="provenance-block"
      className={cn(
        "min-w-0 flex flex-col gap-2 rounded-md border border-border-default bg-surface-subtle/50 p-3 text-[12px]",
        className,
      )}
      {...props}
    />
  );
}

function ProvenanceHeader({
  className,
  label = "Source",
  hint,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div
      data-slot="provenance-header"
      className={cn(
        "flex items-center justify-between gap-2 text-[10.5px] uppercase tracking-[0.06em] text-fg-subtle",
        className,
      )}
      {...props}
    >
      <span>{label}</span>
      {hint ? <span className="font-mono normal-case">{hint}</span> : null}
    </div>
  );
}

function ProvenanceItem({
  className,
  label,
  value,
  mono = true,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  label: React.ReactNode;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      data-slot="provenance-item"
      className={cn(
        "grid gap-1 text-[12px] sm:grid-cols-[minmax(7.5rem,9rem)_minmax(0,1fr)] sm:items-start sm:gap-x-3",
        className,
      )}
      {...props}
    >
      <span className="pt-0.5 text-fg-subtle">{label}</span>
      <span
        className={cn(
          "min-w-0 break-all text-left text-fg-primary whitespace-normal",
          mono && "font-mono tabular-nums",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function HashChip({
  className,
  hash,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & { hash: string }) {
  const display = hash.length > 14 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
  return (
    <span
      data-slot="hash-chip"
      title={hash}
      className={cn(
        "inline-flex items-center gap-1 rounded border border-border-muted bg-surface-elevated px-1 py-0.5 font-mono text-[10.5px] text-fg-subtle",
        className,
      )}
      {...props}
    >
      <Hash className="size-2.5" aria-hidden />
      {display}
    </span>
  );
}

export {
  DocumentChip,
  ProvenanceBlock,
  ProvenanceHeader,
  ProvenanceItem,
  HashChip,
};
