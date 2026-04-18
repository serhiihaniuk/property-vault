import type { ReactNode } from "react";
import {
  DatabaseZap,
  FileCheck2,
  ShieldCheck,
  Waypoints,
} from "lucide-react";

const capabilityLabels = [
  "Dashboard",
  "Documents",
  "Financials",
  "Settings",
] as const;

const operatingPrinciples = [
  {
    title: "Local-first evidence",
    description:
      "Canonical documents remain in the vault, while the app consumes structured data after sync.",
    Icon: FileCheck2,
  },
  {
    title: "Invite-only access",
    description:
      "Every route is private by default, with access controlled through the auth layer instead of public onboarding.",
    Icon: ShieldCheck,
  },
  {
    title: "Contract-first transport",
    description:
      "REST endpoints and OpenAPI contracts sit between the UI shell and application services.",
    Icon: Waypoints,
  },
  {
    title: "Predictable boundaries",
    description:
      "Widgets and pages stay focused, and components never reach directly into database code.",
    Icon: DatabaseZap,
  },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-svh overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute right-[-6rem] top-24 h-80 w-80 rounded-full bg-amber-400/12 blur-3xl dark:bg-amber-200/10" />
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-background via-background/80 to-transparent" />
      </div>

      <div className="mx-auto flex min-h-svh w-full max-w-7xl flex-col gap-6 px-6 py-6 sm:px-8 lg:px-10 lg:py-8">
        <header className="rounded-[32px] border border-border/70 bg-background/80 p-6 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.5)] backdrop-blur xl:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                  <span className="text-sm font-semibold tracking-[0.25em]">PV</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.35em] text-muted-foreground">
                    Invite-only operations
                  </p>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    Property Vault
                  </h1>
                </div>
              </div>

              <p className="text-sm leading-7 text-muted-foreground sm:text-base">
                A serious shell for evidence-backed property operations: monthly
                movement, payable items, reconciliation, provenance, and open
                issues will all land here through thin routes and predictable
                page-widget boundaries.
              </p>

              <div className="flex flex-wrap gap-2">
                {capabilityLabels.map((label, index) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full border border-border/70 bg-secondary/55 px-3 py-1 text-xs font-medium text-secondary-foreground"
                  >
                    {label}
                    {index === 0 ? " now" : " soon"}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:max-w-xl">
              <div className="rounded-[24px] border border-border/70 bg-card/80 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
                  Evidence posture
                </p>
                <p className="mt-3 text-sm font-medium">
                  Local records stay canonical.
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  The deployable app reads structured Postgres data, not raw
                  vault files, after sync and provenance-safe indexing.
                </p>
              </div>

              <div className="rounded-[24px] border border-border/70 bg-card/80 p-4">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
                  Boundary discipline
                </p>
                <p className="mt-3 text-sm font-medium">
                  Thin routes, thick use cases.
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  The shell is ready for provider wiring, REST handlers, and
                  vertical slices without routing around the architecture.
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <main className="space-y-6">{children}</main>

          <aside className="space-y-4">
            <section className="rounded-[28px] border border-border/70 bg-background/80 p-5 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.45)] backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Operating model
              </p>

              <div className="mt-4 space-y-4">
                {operatingPrinciples.map(({ title, description, Icon }) => (
                  <article key={title} className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                      <Icon className="size-4" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-sm font-medium">{title}</h2>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-border/70 bg-card/80 p-5">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                Shell outcome
              </p>
              <h2 className="mt-3 text-lg font-semibold tracking-tight">
                Ready for the first live slices
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                This structure leaves the next tasks free to add providers, API
                transport, and route-backed widgets without reshaping the app
                shell again.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
