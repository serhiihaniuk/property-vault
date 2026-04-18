import Link from "next/link";

import type { DashboardMonthBreakdownData } from "@/src/shared/api/client";
import { badgeVariants, Badge } from "@/src/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/shared/ui/card";
import { Separator } from "@/src/shared/ui/separator";

export interface DashboardFoundationWidgetProps {
  data?: DashboardMonthBreakdownData;
  errorMessage?: string | null;
  isLoading: boolean;
}

export function DashboardFoundationWidget({
  data,
  errorMessage,
  isLoading,
}: DashboardFoundationWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evidence and history</CardTitle>
          <CardDescription>
            Loading the supporting documents and recent month totals.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evidence and history unavailable</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data?.summary || !data.selectedMonth) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evidence and history</CardTitle>
          <CardDescription>
            Document-backed month history will appear here once monthly charge
            data is available.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const latestMonthValue = data.months[0]?.period.value;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence and history</CardTitle>
        <CardDescription>
          Supporting documents for
          {" "}
          {data.selectedMonth.label}
          {" "}
          plus recent monthly totals.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">Supporting documents</h2>
            <Badge variant="outline">
              {data.supportingDocuments.length}
              {" "}
              total
            </Badge>
          </div>
          {data.supportingDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No documents are attached to this month yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {data.supportingDocuments.map((document, index) => (
                <div key={document.hash} className="flex flex-col gap-3">
                  {index > 0 ? <Separator /> : null}
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{document.documentType}</Badge>
                      {document.documentDate ? (
                        <Badge variant="outline">{document.documentDate}</Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-medium">{document.title}</h3>
                      <p className="break-all font-mono text-xs text-muted-foreground">
                        {document.hash}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Separator />
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-medium">Month history</h2>
            <Badge variant="outline">
              {data.months.length}
              {" "}
              recorded
            </Badge>
          </div>
          <div className="flex flex-col gap-2">
            {data.months.map((month) => {
              const isSelected = month.period.value === data.selectedMonth?.value;

              return (
                <Link
                  key={month.period.value}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2 text-sm transition-colors hover:bg-muted/50"
                  href={buildMonthHref(month.period.value, latestMonthValue)}
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-medium">{month.period.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {month.period.value}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatMoney(month.totalCharges.amountMinor)}
                    </span>
                    <span
                      className={badgeVariants({
                        variant: isSelected ? "secondary" : "outline",
                      })}
                    >
                      {isSelected ? "Selected" : "Open"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function buildMonthHref(monthValue: string | undefined, latestMonthValue: string | undefined) {
  if (!monthValue || monthValue === latestMonthValue) {
    return "/";
  }

  return `/?month=${encodeURIComponent(monthValue)}`;
}

function formatMoney(amountMinor: number) {
  return new Intl.NumberFormat("pl-PL", {
    currency: "PLN",
    style: "currency",
  }).format(amountMinor / 100);
}
