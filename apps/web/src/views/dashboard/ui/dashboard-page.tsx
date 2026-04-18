import { ShieldCheck, Workflow, Wrench } from "lucide-react";

import { DashboardSummaryWidget } from "@/src/widgets/dashboard-summary/ui/dashboard-summary-widget";

const implementationPanels = [
  {
    title: "Serious structure first",
    description:
      "Pages now compose widgets through the minimal FSD layers, so later features can stay obvious instead of scattering route-level UI.",
    Icon: Workflow,
  },
  {
    title: "Private by default",
    description:
      "This shell is ready for invite-only auth and provider wiring without teaching components to talk to the database directly.",
    Icon: ShieldCheck,
  },
  {
    title: "Prepared for live data",
    description:
      "The next wave can focus on contracts, handlers, and application services because the shell no longer needs a structural rewrite.",
    Icon: Wrench,
  },
] as const;

export function DashboardPage() {
  return (
    <>
      <section className="rounded-[32px] border border-border/70 bg-background/80 p-6 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Dashboard shell
          </p>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            A contract-first workspace for property operations.
          </h2>
          <p className="text-sm leading-7 text-muted-foreground sm:text-base">
            This foundation is intentionally quiet about data until the route
            layer is ready. What it does provide already is a stable App Router
            shell, clear page-widget boundaries, and enough shared UI for the
            first vertical slices to land cleanly.
          </p>
        </div>
      </section>

      <DashboardSummaryWidget />

      <section className="grid gap-4 xl:grid-cols-3">
        {implementationPanels.map(({ title, description, Icon }) => (
          <article
            key={title}
            className="rounded-[28px] border border-border/70 bg-card/80 p-5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
              <Icon className="size-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold tracking-tight">
              {title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </article>
        ))}
      </section>
    </>
  );
}
