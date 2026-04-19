import Link from "next/link";

import type { YearlyReconciliationData } from "@/src/shared/api/client";
import { cn } from "@/src/shared/lib/utils";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DocumentChip,
  ErrorState,
  LoadingState,
  MetricLabel,
  Money,
  StatusBadge,
  Surface,
  SurfaceBody,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
  type StatusKind,
  badgeVariants,
} from "@/src/shared/ui";

type Line = YearlyReconciliationData["lines"][number];
type CoverageStatus = YearlyReconciliationData["coverage"]["status"];
type LineStatus = Line["status"];

const LOCALE = "pl-PL";
const CURRENCY = "PLN";

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
      <Surface>
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Year reconciliation</SurfaceTitle>
            <SurfaceDescription>
              Loading schedule and settlement totals.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <LoadingState rows={5} label="Loading reconciliation…" />
        </SurfaceBody>
      </Surface>
    );
  }

  if (errorMessage) {
    return (
      <Surface>
        <SurfaceBody>
          <ErrorState
            title="Year reconciliation unavailable"
            description={errorMessage}
          />
        </SurfaceBody>
      </Surface>
    );
  }

  if (!data?.selectedYear || !data.summary) {
    return (
      <Surface>
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Year reconciliation</SurfaceTitle>
            <SurfaceDescription>
              Yearly settlement comparisons appear here once carried-forward
              schedules and settlement records are available.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
      </Surface>
    );
  }

  return (
    <Surface>
      <SurfaceHeader>
        <SurfaceHeading>
          <SurfaceTitle>{data.selectedYear.label}</SurfaceTitle>
          <SurfaceDescription>
            Effective month-by-month schedules reconciled against settlement
            evidence.
          </SurfaceDescription>
        </SurfaceHeading>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="neutral" className="font-mono">
            {data.selectedYear.value}
          </StatusBadge>
          <StatusBadge status={statusForCoverage(data.coverage.status)} dot>
            {formatCoverageStatus(
              data.coverage.status,
              data.coverage.throughMonth?.label,
            )}
          </StatusBadge>
        </div>
      </SurfaceHeader>

      <SurfaceBody>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-mono uppercase tracking-[0.06em] text-fg-subtle">
            Years
          </span>
          {data.availableYears.map((year) => {
            const isSelected = year.value === data.selectedYear?.value;

            return (
              <Link
                key={year.value}
                className={cn(
                  badgeVariants({
                    variant: isSelected ? "neutral" : "outline",
                  }),
                  "font-mono text-[11.5px] tabular-nums",
                  isSelected && "border-border-strong text-fg-primary",
                )}
                href={buildHref(year.value, selectedMonthValue)}
                aria-current={isSelected ? "page" : undefined}
              >
                {year.label}
              </Link>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile
            label="Scheduled"
            value={data.summary.scheduledTotal.amountMinor}
            hint="Carried-forward total"
          />
          <SummaryTile
            label="Advances"
            value={data.summary.settlementAdvanceTotal?.amountMinor}
            hint="Settlement advances"
          />
          <SummaryTile
            label="Actual cost"
            value={data.summary.actualCostTotal?.amountMinor}
            hint="Recorded settlement"
          />
          <SummaryTile
            label="Net result"
            value={data.summary.netBalance?.amountMinor}
            hint={`${data.summary.openLineCount} open lines`}
            signed
          />
        </div>

        <div className="overflow-hidden rounded-md border border-border-default">
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Line</DataTableHead>
                <DataTableHead numeric>Scheduled</DataTableHead>
                <DataTableHead numeric>Advances</DataTableHead>
                <DataTableHead numeric>Actual cost</DataTableHead>
                <DataTableHead numeric>Net</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {data.lines.map((line) => (
                <DataTableRow key={line.category}>
                  <DataTableCell>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12.5px] font-medium text-fg-primary">
                          {line.categoryLabel}
                        </span>
                        <StatusBadge status={statusForLine(line.status)} dot>
                          {line.statusLabel}
                        </StatusBadge>
                      </div>
                      <span className="text-[11px] text-fg-subtle">
                        {line.coverageMonths}
                        {" "}
                        {line.coverageMonths === 1 ? "month" : "months"} covered
                      </span>
                      <LineDocuments
                        label="Schedule"
                        documents={line.scheduleDocuments}
                      />
                      <LineDocuments
                        label="Settlement"
                        documents={line.settlementDocuments}
                      />
                    </div>
                  </DataTableCell>
                  <DataTableCell numeric>
                    {formatMoneyShort(line.scheduledAmount.amountMinor)}
                  </DataTableCell>
                  <DataTableCell numeric>
                    {line.settlementAdvanceAmount
                      ? formatMoneyShort(
                          line.settlementAdvanceAmount.amountMinor,
                        )
                      : "—"}
                  </DataTableCell>
                  <DataTableCell numeric>
                    {line.actualCostAmount
                      ? formatMoneyShort(line.actualCostAmount.amountMinor)
                      : "—"}
                  </DataTableCell>
                  <DataTableCell numeric>
                    {line.netBalance
                      ? formatSignedMoneyShort(line.netBalance.amountMinor)
                      : "—"}
                  </DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </div>
      </SurfaceBody>
    </Surface>
  );
}

function SummaryTile({
  hint,
  label,
  signed = false,
  value,
}: {
  hint: string;
  label: string;
  signed?: boolean;
  value: number | undefined;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border-muted bg-surface-subtle/50 p-3">
      <MetricLabel>{label}</MetricLabel>
      {typeof value === "number" ? (
        <Money
          amountMinor={value}
          size="md"
          currency={CURRENCY}
          locale={LOCALE}
          showCurrency={false}
          showSign={signed}
        />
      ) : (
        <span className="font-mono text-[14px] text-fg-subtle">—</span>
      )}
      <span className="text-[11px] text-fg-subtle">{hint}</span>
    </div>
  );
}

function LineDocuments({
  documents,
  label,
}: {
  documents: Line["scheduleDocuments"];
  label: string;
}) {
  const primary = documents[0];
  const remaining = Math.max(0, documents.length - 1);

  if (!primary) {
    return (
      <span className="text-[11px] text-fg-faint">
        {label}: none
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
      <span className="font-mono uppercase tracking-[0.05em]">{label}</span>
      <DocumentChip
        label={primary.title}
        href={`/documents/${primary.hash}`}
      />
      {remaining > 0 ? (
        <span className="font-mono text-[10.5px]">+{remaining}</span>
      ) : null}
    </div>
  );
}

function statusForLine(status: LineStatus): StatusKind {
  if (status === "due") {
    return "danger";
  }

  if (status === "credit") {
    return "success";
  }

  return "neutral";
}

function statusForCoverage(status: CoverageStatus): StatusKind {
  if (status === "full_year") {
    return "success";
  }

  if (status === "year_to_date") {
    return "info";
  }

  return "pending";
}

function buildHref(yearValue: string | undefined, selectedMonthValue: string | undefined) {
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
  status: CoverageStatus,
  throughMonthLabel: string | undefined,
) {
  if (status === "full_year") {
    return "Full year";
  }

  if (status === "year_to_date") {
    return throughMonthLabel ? `YTD · ${throughMonthLabel}` : "Year to date";
  }

  return throughMonthLabel ? `Partial · ${throughMonthLabel}` : "Partial";
}

function formatMoneyShort(amountMinor: number) {
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const major = new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.trunc(abs / 100));
  const minor = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "−" : ""}${major}.${minor}`;
}

function formatSignedMoneyShort(amountMinor: number) {
  const formatted = formatMoneyShort(Math.abs(amountMinor));

  if (amountMinor > 0) {
    return `+${formatted}`;
  }

  if (amountMinor < 0) {
    return `−${formatted}`;
  }

  return formatted;
}
