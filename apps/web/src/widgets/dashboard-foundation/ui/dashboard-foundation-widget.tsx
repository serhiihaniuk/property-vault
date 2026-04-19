import Link from "next/link";

import type { DashboardMonthBreakdownData } from "@/src/shared/api/client";
import { cn } from "@/src/shared/lib/utils";
import {
  Badge,
  DocumentChip,
  EmptyState,
  ErrorState,
  HashChip,
  KeyValueGrid,
  KeyValueRow,
  LoadingState,
  MetricLabel,
  StatusBadge,
  Surface,
  SurfaceBody,
  SurfaceDescription,
  SurfaceDivider,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
} from "@/src/shared/ui";

const LOCALE = "pl-PL";
const CURRENCY = "PLN";

export interface DashboardFoundationWidgetProps {
  data?: DashboardMonthBreakdownData;
  errorMessage?: string | null;
  isLoading: boolean;
  selectedYearValue?: string;
}

export function DashboardFoundationWidget({
  data,
  errorMessage,
  isLoading,
  selectedYearValue,
}: DashboardFoundationWidgetProps) {
  if (isLoading) {
    return (
      <Surface>
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Recent evidence</SurfaceTitle>
            <SurfaceDescription>
              Loading supporting documents and month history.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <LoadingState rows={5} label="Loading evidence…" />
        </SurfaceBody>
      </Surface>
    );
  }

  if (errorMessage) {
    return (
      <Surface>
        <SurfaceBody>
          <ErrorState
            title="Recent evidence unavailable"
            description={errorMessage}
          />
        </SurfaceBody>
      </Surface>
    );
  }

  if (!data?.summary || !data.selectedMonth) {
    return (
      <Surface>
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Recent evidence</SurfaceTitle>
            <SurfaceDescription>
              Document-backed month history appears here once monthly charge
              data is available.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
      </Surface>
    );
  }

  const latestMonthValue = data.months[0]?.period.value;
  const selectedMonthHistory = data.months.find(
    (month) => month.period.value === data.selectedMonth?.value,
  );
  const selectedSupportingDocuments =
    selectedMonthHistory?.sourceDocuments ?? data.supportingDocuments;

  return (
    <Surface>
      <SurfaceHeader>
        <SurfaceHeading>
          <SurfaceTitle>Recent evidence</SurfaceTitle>
          <SurfaceDescription>
            {selectedMonthHistory?.isCarriedForward
              ? `Schedule from ${selectedMonthHistory.sourceMonth.label} still in force for ${data.selectedMonth.label}.`
              : `Supporting documents backing ${data.selectedMonth.label}.`}
          </SurfaceDescription>
        </SurfaceHeading>
        <Badge variant="neutral" className="font-mono">
          {selectedSupportingDocuments.length}
          {" "}
          {selectedSupportingDocuments.length === 1 ? "doc" : "docs"}
        </Badge>
      </SurfaceHeader>

      <SurfaceBody>
        <section className="flex flex-col gap-2">
          <MetricLabel>Documents for this month</MetricLabel>
          {selectedSupportingDocuments.length === 0 ? (
            <EmptyState
              title="No supporting documents"
              description="Nothing is attached to this reporting month yet."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-dashed divide-border-default">
              {selectedSupportingDocuments.map((document) => (
                <li
                  key={document.hash}
                  className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      className="flex min-w-0 flex-col gap-0.5 text-left hover:underline"
                      href={`/documents/${document.hash}`}
                    >
                      <span className="truncate text-[13px] font-medium text-fg-primary">
                        {document.title}
                      </span>
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-fg-subtle">
                        {document.documentType}
                        {document.documentDate ? ` · ${document.documentDate}` : ""}
                      </span>
                    </Link>
                    <HashChip hash={document.hash} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <SurfaceDivider />

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <MetricLabel>Month history</MetricLabel>
            <span className="text-[11px] font-mono text-fg-subtle">
              {data.months.length} recorded
            </span>
          </div>
          <KeyValueGrid columns={1} divider="dashed">
            {data.months.slice(0, 6).map((month) => {
              const isSelected = month.period.value === data.selectedMonth?.value;
              const primaryDoc = month.sourceDocuments[0];

              return (
                <Link
                  key={month.period.value}
                  data-slot="kv-row"
                  aria-current={isSelected ? "page" : undefined}
                  href={buildHref({
                    monthValue: month.period.value,
                    latestMonthValue,
                    selectedYearValue,
                  })}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-sm px-1.5 py-1.5 transition-colors hover:bg-surface-elevated/70",
                    isSelected && "bg-surface-elevated",
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className={cn(
                        "font-mono tabular-nums text-fg-primary",
                        isSelected && "font-semibold",
                      )}>
                        {month.period.label}
                      </span>
                      {month.isCarriedForward ? (
                        <StatusBadge status="info" className="h-4 gap-1 px-1.5 text-[9.5px]">
                          Carried
                        </StatusBadge>
                      ) : null}
                    </div>
                    {primaryDoc ? (
                      <DocumentChip
                        label={primaryDoc.title}
                        className="max-w-full"
                      />
                    ) : (
                      <span className="text-[11px] text-fg-faint">No source document</span>
                    )}
                  </div>
                  <span className="shrink-0 pt-0.5 font-mono text-[12px] tabular-nums text-fg-secondary">
                    {formatMoneyShort(month.totalCharges.amountMinor)}
                  </span>
                </Link>
              );
            })}
            {data.months.length === 0 ? (
              <KeyValueRow label="History" value="No recorded months" />
            ) : null}
          </KeyValueGrid>
        </section>
      </SurfaceBody>
    </Surface>
  );
}

function buildHref({
  monthValue,
  latestMonthValue,
  selectedYearValue,
}: {
  monthValue: string | undefined;
  latestMonthValue: string | undefined;
  selectedYearValue: string | undefined;
}) {
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

function formatMoneyShort(amountMinor: number) {
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor);
  const major = new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.trunc(abs / 100));
  const minor = (abs % 100).toString().padStart(2, "0");
  return `${negative ? "−" : ""}${major}.${minor} ${CURRENCY}`;
}
