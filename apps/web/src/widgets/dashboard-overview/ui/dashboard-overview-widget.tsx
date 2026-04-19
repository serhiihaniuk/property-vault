import Link from "next/link";

import type { DashboardMonthBreakdownData } from "@/src/shared/api/client";
import {
  DeltaValue,
  ErrorState,
  LoadingState,
  MetricLabel,
  MetricSub,
  Money,
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderHeading,
  PageHeaderTitle,
  Sparkline,
  StatusBadge,
  Surface,
  SurfaceBody,
  SurfaceDivider,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
  badgeVariants,
} from "@/src/shared/ui";
import { cn } from "@/src/shared/lib/utils";

import {
  DASHBOARD_LOCALE,
  DASHBOARD_CURRENCY,
  buildDashboardHref,
  deltaIntentForCost,
  formatChangeStatus,
  formatSignedMoney,
} from "./overview-helpers";

type DashboardSummary = NonNullable<DashboardMonthBreakdownData["summary"]>;

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
      <Surface density="comfortable">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Finances</SurfaceTitle>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <LoadingState rows={4} label="Loading latest month summary…" />
        </SurfaceBody>
      </Surface>
    );
  }

  if (errorMessage) {
    return (
      <Surface density="comfortable">
        <SurfaceBody>
          <ErrorState
            title="Dashboard month unavailable"
            description={errorMessage}
          />
        </SurfaceBody>
      </Surface>
    );
  }

  if (!data?.summary || !data.selectedMonth) {
    return (
      <Surface density="comfortable">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Finances</SurfaceTitle>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <p className="text-[12.5px] text-fg-subtle">
            No monthly charge data has been synced into the app database yet.
          </p>
        </SurfaceBody>
      </Surface>
    );
  }

  const summary = data.summary;
  const latestMonthValue = data.months[0]?.period.value;
  const selectedMonthHistory = data.months.find(
    (month) => month.period.value === data.selectedMonth?.value,
  );
  const sourceBadgeLabel = selectedMonthHistory?.isCarriedForward
    ? `Carried from ${selectedMonthHistory.sourceMonth.label}`
    : `Source month`;
  const supportingDocumentCount =
    selectedMonthHistory?.sourceDocuments.length ?? data.supportingDocuments.length;

  const trendValues = [...data.months]
    .reverse()
    .map((month) => month.totalCharges.amountMinor);

  const deltaIntent = summary.totalDelta
    ? deltaIntentForCost(summary.totalDelta.amountMinor)
    : "neutral";

  return (
    <Surface density="comfortable">
      <PageHeader className="pb-0">
        <PageHeaderHeading>
          <PageHeaderEyebrow>
            {data.selectedMonth.label}
            {" · "}
            {sourceBadgeLabel}
          </PageHeaderEyebrow>
          <PageHeaderTitle>Finances</PageHeaderTitle>
          <PageHeaderDescription>
            Snapshot of the selected reporting month: total, context versus the
            prior month, and how this month is split across categories.
          </PageHeaderDescription>
        </PageHeaderHeading>
        <PageHeaderActions>
          <StatusBadge status="neutral">{data.selectedMonth.value}</StatusBadge>
          {selectedMonthHistory?.isCarriedForward ? (
            <StatusBadge status="info" dot>
              Carried
            </StatusBadge>
          ) : (
            <StatusBadge status="success" dot>
              Source
            </StatusBadge>
          )}
        </PageHeaderActions>
      </PageHeader>

      <SurfaceDivider className="my-4" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <MetricLabel>Total this month</MetricLabel>
            <div className="flex flex-wrap items-baseline gap-4">
              <Money
                amountMinor={summary.totalCharges.amountMinor}
                size="hero"
                currency={DASHBOARD_CURRENCY}
                locale={DASHBOARD_LOCALE}
              />
              {summary.totalDelta ? (
                <DeltaValue
                  intent={deltaIntent}
                  size="lg"
                  valueLabel={formatSignedMoney(summary.totalDelta.amountMinor)}
                  contextLabel={
                    data.previousMonth
                      ? `vs ${data.previousMonth.label}`
                      : "vs previous"
                  }
                />
              ) : (
                <span className="font-mono text-[12px] text-fg-subtle">
                  no previous month
                </span>
              )}
            </div>
            <MetricSub>
              {supportingDocumentCount}
              {" "}
              supporting
              {" "}
              {supportingDocumentCount === 1 ? "document" : "documents"}
              {" · "}
              {summary.categoryCount}
              {" active "}
              {summary.categoryCount === 1 ? "category" : "categories"}
            </MetricSub>
          </div>

          <div className="rounded-md border border-border-muted bg-surface-subtle/50 p-3">
            <div className="flex items-center justify-between gap-3">
              <MetricLabel>Trend · {trendValues.length}mo</MetricLabel>
              {trendValues.length >= 2 ? (
                <span className="font-mono text-[11px] text-fg-subtle">
                  latest → right
                </span>
              ) : null}
            </div>
            {trendValues.length >= 2 ? (
              <Sparkline
                className="mt-2 h-10"
                values={trendValues}
                intent="neutral"
                ariaLabel="Monthly total trend"
              />
            ) : (
              <p className="mt-2 text-[12px] text-fg-subtle">
                Trend appears after at least two recorded months.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            label="Previous month"
            value={
              summary.previousTotalCharges ? (
                <Money
                  amountMinor={summary.previousTotalCharges.amountMinor}
                  size="md"
                  showCurrency={false}
                  currency={DASHBOARD_CURRENCY}
                  locale={DASHBOARD_LOCALE}
                />
              ) : (
                <span className="font-mono text-[14px] text-fg-subtle">—</span>
              )
            }
            hint={data.previousMonth?.label ?? "No previous"}
          />
          <MetricTile
            label="Changed"
            value={
              <span className="font-mono text-[18px] tabular-nums text-fg-primary">
                {summary.changedCategoryCount}
                <span className="text-fg-subtle">
                  /{summary.categoryCount}
                </span>
              </span>
            }
            hint="categories moved"
          />
          <MetricTile
            label="Largest line"
            value={
              summary.largestCategory ? (
                <Money
                  amountMinor={summary.largestCategory.amount.amountMinor}
                  size="md"
                  showCurrency={false}
                  currency={DASHBOARD_CURRENCY}
                  locale={DASHBOARD_LOCALE}
                />
              ) : (
                <span className="font-mono text-[14px] text-fg-subtle">—</span>
              )
            }
            hint={summary.largestCategory?.categoryLabel ?? "No category"}
          />
          <MetricTile
            label="Top change"
            value={
              summary.topChange ? (
                <DeltaValue
                  intent={deltaIntentForCost(summary.topChange.delta.amountMinor)}
                  size="lg"
                  valueLabel={formatSignedMoney(summary.topChange.delta.amountMinor)}
                  hideIcon
                />
              ) : (
                <span className="font-mono text-[14px] text-fg-subtle">—</span>
              )
            }
            hint={
              summary.topChange
                ? formatTopChangeHint(summary.topChange)
                : "No movement"
            }
          />
        </div>
      </div>

      <SurfaceDivider className="mt-5" />

      <div className="flex flex-wrap items-center gap-2 pt-4">
        <span className="text-[11px] font-mono uppercase tracking-[0.06em] text-fg-subtle">
          Months
        </span>
        {data.months.map((month) => {
          const isSelected = month.period.value === data.selectedMonth?.value;

          return (
            <Link
              key={month.period.value}
              className={cn(
                badgeVariants({
                  variant: isSelected ? "neutral" : "outline",
                }),
                "font-mono text-[11.5px] tabular-nums",
                isSelected && "border-border-strong text-fg-primary",
              )}
              href={buildDashboardHref({
                monthValue: month.period.value,
                latestMonthValue,
                selectedYearValue,
              })}
              aria-current={isSelected ? "page" : undefined}
            >
              {month.period.label}
            </Link>
          );
        })}
      </div>
    </Surface>
  );
}

function MetricTile({
  hint,
  label,
  value,
}: {
  hint: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border-muted bg-surface-subtle/50 p-3">
      <MetricLabel>{label}</MetricLabel>
      <div className="flex items-baseline gap-2">{value}</div>
      <span className="text-[11.5px] text-fg-subtle">{hint}</span>
    </div>
  );
}

function formatTopChangeHint(topChange: DashboardSummary["topChange"]) {
  if (!topChange) {
    return "";
  }

  return `${topChange.categoryLabel} · ${formatChangeStatus(topChange.changeStatus)}`;
}
