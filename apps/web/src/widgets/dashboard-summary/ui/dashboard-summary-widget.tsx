import {
  BanknoteArrowDown,
  CalendarRange,
  FileSearch,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/src/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/shared/ui/card";

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
    <Card>
      <CardHeader>
        <CardTitle>Core questions</CardTitle>
        <CardDescription>
          The first vertical slices can land on these surfaces without changing
          the route and ownership boundaries again.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-2">
        {dashboardCapabilities.map(({ title, description, note, Icon }) => (
          <Card key={title} size="sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <Badge variant="outline">
                  {note}
                </Badge>
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <Icon className="size-4" />
                </div>
              </div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
