import {
  BanknoteArrowDown,
  CalendarRange,
  FileSearch,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/src/shared/ui/button";

const dashboardCapabilities = [
  {
    title: "What changed this month",
    description:
      "Monthly movement will surface new charges, deltas, and fresh evidence with clear provenance.",
    note: "Monthly review shell",
    Icon: CalendarRange,
  },
  {
    title: "What should be paid",
    description:
      "Upcoming obligations will become a focused payable view instead of a document-by-document hunt.",
    note: "Payment triage shell",
    Icon: BanknoteArrowDown,
  },
  {
    title: "Which document supports a fact",
    description:
      "Cross-linked document detail views will anchor every financial claim to its supporting source.",
    note: "Provenance shell",
    Icon: FileSearch,
  },
  {
    title: "Which anomalies need attention",
    description:
      "Open items and unusual movements will become visible as a dedicated review surface, not a surprise.",
    note: "Anomaly shell",
    Icon: TriangleAlert,
  },
] as const;

export function DashboardSummaryWidget() {
  return (
    <section className="rounded-[32px] border border-border/70 bg-background/80 p-6 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8">
      <div className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
            Core questions
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            The shell already knows which answers it needs to deliver.
          </h2>
          <p className="text-sm leading-7 text-muted-foreground">
            The first live slices will plug real routes and application
            services into these surfaces, while keeping the page layer clean and
            predictable for later expansion.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-fit rounded-full px-4"
          disabled
        >
          Data wiring next
        </Button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {dashboardCapabilities.map(({ title, description, note, Icon }) => (
          <article
            key={title}
            className="rounded-[28px] border border-border/70 bg-card/85 p-5 transition-colors hover:bg-card"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {note}
                </span>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight">
                    {title}
                  </h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </div>
              </div>

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-secondary-foreground">
                <Icon className="size-5" />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
