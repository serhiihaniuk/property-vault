import Link from "next/link";

import type { DashboardMonthBreakdownData } from "@/src/shared/api/client";
import { Badge, badgeVariants } from "@/src/shared/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/shared/ui/card";
import { Separator } from "@/src/shared/ui/separator";

type DashboardTopChange = NonNullable<
  NonNullable<DashboardMonthBreakdownData["summary"]>["topChange"]
>;

export interface DashboardOverviewWidgetProps {
  data?: DashboardMonthBreakdownData;
  errorMessage?: string | null;
  isLoading: boolean;
  selectedYearValue?: string;
}

export function DashboardOverviewWidget({
  data,
  errorMessage,
  isLoading,
  selectedYearValue,
}: DashboardOverviewWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard month</CardTitle>
          <CardDescription>
            Loading the latest month summary and normalized charge breakdown.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard month unavailable</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data?.summary || !data.selectedMonth) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard month</CardTitle>
          <CardDescription>
            No monthly charge data has been synced into the app database yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const latestMonthValue = data.months[0]?.period.value;
  const previousMonthLabel = data.previousMonth?.label ?? "No previous available month";
  const selectedMonthHistory = data.months.find(
    (month) => month.period.value === data.selectedMonth?.value,
  );
  const sourceBadgeLabel = selectedMonthHistory?.isCarriedForward
    ? `Carried from ${selectedMonthHistory.sourceMonth.value}`
    : `Source ${selectedMonthHistory?.sourceMonth.value ?? data.selectedMonth.value}`;
  const supportingDocumentCount =
    selectedMonthHistory?.sourceDocuments.length ?? data.supportingDocuments.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{data.selectedMonth.label}</CardTitle>
            <CardDescription>
              Selected reporting month for the dashboard summary and normalized
              category breakdown.
            </CardDescription>
          </div>
          <CardAction className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{data.selectedMonth.value}</Badge>
            <Badge variant="outline">{sourceBadgeLabel}</Badge>
            <Badge variant="outline">{previousMonthLabel}</Badge>
          </CardAction>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {data.months.map((month) => {
            const isSelected = month.period.value === data.selectedMonth?.value;

            return (
              <Link
                key={month.period.value}
                className={badgeVariants({
                  variant: isSelected ? "secondary" : "outline",
                })}
                href={buildMonthHref(
                  month.period.value,
                  latestMonthValue,
                  selectedYearValue,
                )}
              >
                {month.period.label}
              </Link>
            );
          })}
        </div>
        <Separator />
        <div className="grid gap-4 lg:grid-cols-4">
          <MetricCard
            description={data.previousMonth ? `vs ${data.previousMonth.label}` : "First available month"}
            title="Total charges"
            value={formatMoney(data.summary.totalCharges.amountMinor)}
          />
          <MetricCard
            description={previousMonthLabel}
            title="Month change"
            value={
              data.summary.totalDelta
                ? formatSignedMoney(data.summary.totalDelta.amountMinor)
                : "n/a"
            }
          />
          <MetricCard
            description={`${data.summary.categoryCount} active in the selected month`}
            title="Changed categories"
            value={String(data.summary.changedCategoryCount)}
          />
          <MetricCard
            description="Largest category in the selected month"
            title="Largest line"
            value={
              data.summary.largestCategory
                ? `${data.summary.largestCategory.categoryLabel} • ${formatMoney(
                    data.summary.largestCategory.amount.amountMinor,
                  )}`
                : "n/a"
            }
          />
        </div>
      </CardContent>
      <CardFooter className="justify-between gap-3 max-md:flex-col max-md:items-start">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            {data.summary.topChange
              ? `${data.summary.topChange.categoryLabel} moved the most this month.`
              : "No category movement is available yet for a month-to-month comparison."}
          </p>
          <p className="text-sm text-muted-foreground">
            {supportingDocumentCount} supporting
            {" "}
            {supportingDocumentCount === 1 ? "document" : "documents"}
            {" "}
            {selectedMonthHistory?.isCarriedForward
              ? `from ${selectedMonthHistory.sourceMonth.label} remain in force for this month view.`
              : "back this month view."}
          </p>
        </div>
        {data.summary.topChange ? (
          <Badge variant={getStatusBadgeVariant(data.summary.topChange.changeStatus)}>
            {formatChangeStatus(data.summary.topChange.changeStatus)}
            {" "}
            {formatSignedMoney(data.summary.topChange.delta.amountMinor)}
          </Badge>
        ) : (
          <Badge variant="outline">No comparable prior month</Badge>
        )}
      </CardFooter>
    </Card>
  );
}

function MetricCard({
  description,
  title,
  value,
}: {
  description: string;
  title: string;
  value: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-lg">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function buildMonthHref(
  monthValue: string | undefined,
  latestMonthValue: string | undefined,
  selectedYearValue: string | undefined,
) {
  const searchParams = new URLSearchParams();

  if (monthValue && monthValue !== latestMonthValue) {
    searchParams.set("month", monthValue);
  }

  if (selectedYearValue) {
    searchParams.set("year", selectedYearValue);
  }

  const query = searchParams.toString();

  return query ? `/?${query}` : "/";
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

function formatChangeStatus(status: DashboardTopChange["changeStatus"]) {
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
  status: DashboardTopChange["changeStatus"],
) {
  if (status === "down") {
    return "destructive" as const;
  }

  if (status === "up" || status === "new") {
    return "secondary" as const;
  }

  return "outline" as const;
}
