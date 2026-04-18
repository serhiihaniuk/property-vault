import type { DashboardMonthBreakdownData } from "@/src/shared/api/client";
import { Badge } from "@/src/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/shared/ui/card";
import { Separator } from "@/src/shared/ui/separator";

export interface DashboardSummaryWidgetProps {
  data?: DashboardMonthBreakdownData;
  errorMessage?: string | null;
  isLoading: boolean;
}

export function DashboardSummaryWidget({
  data,
  errorMessage,
  isLoading,
}: DashboardSummaryWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Category breakdown</CardTitle>
          <CardDescription>
            Loading normalized charge rows for the selected reporting month.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Category breakdown unavailable</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data?.summary || !data.selectedMonth) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Category breakdown</CardTitle>
          <CardDescription>
            Monthly category totals will appear here after monthly charge data is
            synced into Postgres.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const groupedBreakdown = groupBreakdown(data.breakdown);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category breakdown</CardTitle>
        <CardDescription>
          Normalized charge rows for
          {" "}
          {data.selectedMonth.label}
          , grouped into operator-friendly buckets.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-2">
        {groupedBreakdown.map((group) => (
          <Card key={group.label} size="sm">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle>{group.label}</CardTitle>
                  <CardDescription>
                    {group.items.length}
                    {" "}
                    {group.items.length === 1 ? "category" : "categories"}
                  </CardDescription>
                </div>
                <Badge variant="outline">{formatMoney(group.totalAmountMinor)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {group.items.map((item, index) => (
                <div key={item.category} className="flex flex-col gap-3">
                  {index > 0 ? <Separator /> : null}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{item.categoryLabel}</h2>
                        <Badge variant={getStatusBadgeVariant(item.changeStatus)}>
                          {formatChangeStatus(item.changeStatus)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.sharePercent.toFixed(1)}
                        % of this month total
                        {" • "}
                        {item.sourceDocuments.length}
                        {" "}
                        {item.sourceDocuments.length === 1 ? "document" : "documents"}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                      <p className="font-mono text-sm font-medium">
                        {formatMoney(item.amount.amountMinor)}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.delta
                          ? formatSignedMoney(item.delta.amountMinor)
                          : "n/a"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}

function groupBreakdown(items: DashboardMonthBreakdownData["breakdown"]) {
  const grouped = new Map<
    string,
    {
      items: DashboardMonthBreakdownData["breakdown"];
      label: string;
      totalAmountMinor: number;
    }
  >();

  for (const item of items) {
    const existing = grouped.get(item.categoryGroupLabel);

    if (existing) {
      existing.items.push(item);
      existing.totalAmountMinor += item.amount.amountMinor;
      continue;
    }

    grouped.set(item.categoryGroupLabel, {
      items: [item],
      label: item.categoryGroupLabel,
      totalAmountMinor: item.amount.amountMinor,
    });
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort(
        (left, right) => right.amount.amountMinor - left.amount.amountMinor,
      ),
    }))
    .sort((left, right) => right.totalAmountMinor - left.totalAmountMinor);
}

function formatMoney(amountMinor: number) {
  return new Intl.NumberFormat("pl-PL", {
    currency: "PLN",
    style: "currency",
  }).format(amountMinor / 100);
}

function formatSignedMoney(amountMinor: number) {
  const formatted = formatMoney(Math.abs(amountMinor));

  if (amountMinor > 0) {
    return `+${formatted}`;
  }

  if (amountMinor < 0) {
    return `-${formatted}`;
  }

  return formatted;
}

function formatChangeStatus(status: DashboardMonthBreakdownData["breakdown"][number]["changeStatus"]) {
  switch (status) {
    case "down":
      return "Down";
    case "new":
      return "New";
    case "up":
      return "Up";
    case "flat":
      return "Flat";
    case "no_previous":
      return "No previous";
    default:
      return "Change";
  }
}

function getStatusBadgeVariant(
  status: DashboardMonthBreakdownData["breakdown"][number]["changeStatus"],
) {
  if (status === "down") {
    return "destructive" as const;
  }

  if (status === "up" || status === "new") {
    return "secondary" as const;
  }

  return "outline" as const;
}
