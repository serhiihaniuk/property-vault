import Link from "next/link";

import type { YearlyReconciliationData } from "@/src/shared/api/client";
import { Badge, badgeVariants } from "@/src/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/shared/ui/card";
import { Separator } from "@/src/shared/ui/separator";

export interface YearlyReconciliationWidgetProps {
  data?: YearlyReconciliationData;
  errorMessage?: string | null;
  isLoading: boolean;
  selectedMonthValue?: string;
}

export function YearlyReconciliationWidget({
  data,
  errorMessage,
  isLoading,
  selectedMonthValue,
}: YearlyReconciliationWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Year reconciliation</CardTitle>
          <CardDescription>
            Loading carried-forward charge schedules against settlement evidence.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Year reconciliation unavailable</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data?.selectedYear || !data.summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Year reconciliation</CardTitle>
          <CardDescription>
            Yearly settlement comparisons will appear here once carried-forward
            charge schedules and settlement records are available.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{data.selectedYear.label}</CardTitle>
            <CardDescription>
              Effective month-by-month schedules reconciled against settlement
              evidence for the selected reporting year.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{data.selectedYear.value}</Badge>
            <Badge variant="outline">
              {formatCoverageStatus(data.coverage.status, data.coverage.throughMonth?.label)}
            </Badge>
            <Badge variant="outline">
              {data.lines.length}
              {" "}
              lines
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {data.availableYears.map((year) => {
            const isSelected = year.value === data.selectedYear?.value;

            return (
              <Link
                key={year.value}
                className={badgeVariants({
                  variant: isSelected ? "secondary" : "outline",
                })}
                href={buildYearHref(year.value, selectedMonthValue)}
              >
                {year.label}
              </Link>
            );
          })}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetricCard
            description="Carried-forward schedule total"
            title="Scheduled"
            value={formatMoney(data.summary.scheduledTotal.amountMinor)}
          />
          <SummaryMetricCard
            description="Settlement advance totals"
            title="Advances"
            value={formatNullableMoney(data.summary.settlementAdvanceTotal?.amountMinor)}
          />
          <SummaryMetricCard
            description="Recorded settlement costs"
            title="Actual cost"
            value={formatNullableMoney(data.summary.actualCostTotal?.amountMinor)}
          />
          <SummaryMetricCard
            description={`${data.summary.openLineCount} line items still need attention`}
            title="Net result"
            value={formatNullableSignedMoney(data.summary.netBalance?.amountMinor)}
          />
        </div>
        <div className="rounded-lg border border-border/70">
          <div className="hidden grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] gap-3 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid">
            <span>Line</span>
            <span>Scheduled</span>
            <span>Advances</span>
            <span>Actual cost</span>
            <span>Net</span>
          </div>
          <div className="flex flex-col">
            {data.lines.map((line, index) => (
              <div key={line.category} className="flex flex-col">
                {index > 0 ? <Separator /> : null}
                <div className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] lg:items-start">
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{line.categoryLabel}</h2>
                      <Badge variant={getStatusBadgeVariant(line.status)}>
                        {line.statusLabel}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {line.coverageMonths}
                      {" "}
                      {line.coverageMonths === 1 ? "month" : "months"}
                      {" "}
                      of effective schedule coverage
                      {line.scheduleDelta
                        ? `; schedule vs advances ${formatSignedMoney(
                            line.scheduleDelta.amountMinor,
                          )}`
                        : ""}
                    </p>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                      <DocumentPreview
                        documents={line.scheduleDocuments}
                        hrefPrefix="/documents"
                        label="Schedule"
                      />
                      <DocumentPreview
                        documents={line.settlementDocuments}
                        hrefPrefix="/documents"
                        label="Settlement"
                      />
                    </div>
                  </div>
                  <MetricColumn
                    label="Scheduled"
                    value={formatMoney(line.scheduledAmount.amountMinor)}
                  />
                  <MetricColumn
                    label="Advances"
                    value={formatNullableMoney(line.settlementAdvanceAmount?.amountMinor)}
                  />
                  <MetricColumn
                    label="Actual cost"
                    value={formatNullableMoney(line.actualCostAmount?.amountMinor)}
                  />
                  <MetricColumn
                    label="Net result"
                    value={formatNullableSignedMoney(line.netBalance?.amountMinor)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryMetricCard({
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

function MetricColumn({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground lg:hidden">
        {label}
      </span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

function DocumentPreview({
  documents,
  hrefPrefix,
  label,
}: {
  documents: YearlyReconciliationData["lines"][number]["scheduleDocuments"];
  hrefPrefix: string;
  label: string;
}) {
  const primaryDocument = documents[0];

  if (!primaryDocument) {
    return <span>{label}: none</span>;
  }

  const remainingCount = documents.length - 1;

  return (
    <span>
      {label}
      {": "}
      <Link className="hover:text-foreground hover:underline" href={`${hrefPrefix}/${primaryDocument.hash}`}>
        {primaryDocument.title}
      </Link>
      {remainingCount > 0 ? ` (+${remainingCount} more)` : ""}
    </span>
  );
}

function buildYearHref(yearValue: string | undefined, selectedMonthValue: string | undefined) {
  const searchParams = new URLSearchParams();

  if (yearValue) {
    searchParams.set("year", yearValue);
  }

  if (selectedMonthValue) {
    searchParams.set("month", selectedMonthValue);
  }

  const query = searchParams.toString();

  return query ? `/?${query}` : "/";
}

function formatCoverageStatus(
  status: YearlyReconciliationData["coverage"]["status"],
  throughMonthLabel: string | undefined,
) {
  if (status === "full_year") {
    return "Full year";
  }

  if (status === "year_to_date") {
    return throughMonthLabel ? `Year to date through ${throughMonthLabel}` : "Year to date";
  }

  return throughMonthLabel ? `Partial through ${throughMonthLabel}` : "Partial year";
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

function formatNullableMoney(amountMinor: number | undefined) {
  if (typeof amountMinor !== "number") {
    return "n/a";
  }

  return formatMoney(amountMinor);
}

function formatNullableSignedMoney(amountMinor: number | undefined) {
  if (typeof amountMinor !== "number") {
    return "n/a";
  }

  return formatSignedMoney(amountMinor);
}

function getStatusBadgeVariant(status: YearlyReconciliationData["lines"][number]["status"]) {
  if (status === "due") {
    return "destructive" as const;
  }

  if (status === "credit") {
    return "secondary" as const;
  }

  return "outline" as const;
}
