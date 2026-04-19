import type { DashboardMonthBreakdownData } from "@/src/shared/api/client";
import { cn } from "@/src/shared/lib/utils";
import {
  DeltaValue,
  DenseCard,
  DocumentChip,
  ErrorState,
  LoadingState,
  MetricSub,
  Money,
  Sparkline,
  StatusBadge,
  Surface,
  SurfaceBody,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
  type DeltaIntent,
  type StatusKind,
} from "@/src/shared/ui";

type ChangeStatus =
  DashboardMonthBreakdownData["breakdown"][number]["changeStatus"];

type BreakdownItem = DashboardMonthBreakdownData["breakdown"][number];

const LOCALE = "pl-PL";
const CURRENCY = "PLN";

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
      <Surface density="comfortable">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Breakdown by category</SurfaceTitle>
            <SurfaceDescription>
              Loading normalized charge rows for the selected month.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <LoadingState rows={6} label="Loading category breakdown…" />
        </SurfaceBody>
      </Surface>
    );
  }

  if (errorMessage) {
    return (
      <Surface density="comfortable">
        <SurfaceBody>
          <ErrorState
            title="Category breakdown unavailable"
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
            <SurfaceTitle>Breakdown by category</SurfaceTitle>
            <SurfaceDescription>
              Monthly category totals appear here after charge data is synced.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
      </Surface>
    );
  }

  const groupedBreakdown = groupBreakdown(data.breakdown);
  const totalMonthAmountMinor = data.summary.totalCharges.amountMinor;

  return (
    <Surface density="comfortable">
      <SurfaceHeader>
        <SurfaceHeading>
          <SurfaceTitle>Breakdown by category</SurfaceTitle>
          <SurfaceDescription>
            {data.selectedMonth.label}
            {" · "}
            {data.summary.categoryCount}
            {" "}
            {data.summary.categoryCount === 1 ? "category" : "categories"}
            {data.summary.changedCategoryCount > 0
              ? ` · ${data.summary.changedCategoryCount} moved vs prev`
              : ""}
          </SurfaceDescription>
        </SurfaceHeading>
      </SurfaceHeader>
      <SurfaceBody>
        <div className="flex flex-col gap-4">
          {groupedBreakdown.map((group) => (
            <div key={group.label} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 border-b border-dashed border-border-default pb-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11.5px] font-mono uppercase tracking-[0.06em] text-fg-subtle">
                    {group.label}
                  </span>
                  <span className="text-[11px] text-fg-faint">
                    {group.items.length}
                    {" "}
                    {group.items.length === 1 ? "line" : "lines"}
                  </span>
                </div>
                <span className="font-mono text-[12px] tabular-nums text-fg-secondary">
                  {formatMoneyShort(group.totalAmountMinor)}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item) => (
                  <CategoryCard
                    key={item.category}
                    item={item}
                    totalMonthAmountMinor={totalMonthAmountMinor}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </SurfaceBody>
    </Surface>
  );
}

function CategoryCard({
  item,
  totalMonthAmountMinor,
}: {
  item: BreakdownItem;
  totalMonthAmountMinor: number;
}) {
  const status = statusKindForChange(item.changeStatus);
  const deltaIntent = item.delta
    ? deltaIntentForCost(item.delta.amountMinor)
    : "neutral";

  const sparklineValues = buildTwoPointTrend(item);
  const sparklineIntent = sparklineIntentFor(deltaIntent);

  const shareBarWidth =
    totalMonthAmountMinor > 0
      ? Math.min(100, (item.amount.amountMinor / totalMonthAmountMinor) * 100)
      : 0;

  const primaryDocument = item.sourceDocuments[0];
  const remainingDocumentCount = Math.max(0, item.sourceDocuments.length - 1);

  return (
    <DenseCard className="gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="truncate text-[13px] font-medium text-fg-primary">
            {item.categoryLabel}
          </h3>
          <MetricSub className="font-sans text-[11px] normal-case tracking-normal text-fg-subtle">
            {item.sharePercent.toFixed(1)}
            % of month
          </MetricSub>
        </div>
        <StatusBadge status={status} dot className="text-[10.5px]">
          {formatChangeStatus(item.changeStatus)}
        </StatusBadge>
      </div>

      <div className="flex items-end justify-between gap-3">
        <Money
          amountMinor={item.amount.amountMinor}
          size="md"
          currency={CURRENCY}
          locale={LOCALE}
          showCurrency={false}
        />
        {item.delta ? (
          <DeltaValue
            intent={deltaIntent}
            size="sm"
            valueLabel={formatSignedMoney(item.delta.amountMinor)}
            hideIcon
          />
        ) : (
          <span className="font-mono text-[11px] text-fg-subtle">—</span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {sparklineValues ? (
          <Sparkline
            values={sparklineValues}
            intent={sparklineIntent}
            ariaLabel={`${item.categoryLabel} trend`}
            className="h-6"
          />
        ) : (
          <div
            className="h-6 rounded-sm border border-dashed border-border-muted"
            aria-hidden
          />
        )}
        <div
          className="h-[3px] w-full overflow-hidden rounded-full bg-border-muted"
          aria-hidden
        >
          <div
            className={cn(
              "h-full",
              deltaIntent === "negative" && "bg-delta-negative/70",
              deltaIntent === "positive" && "bg-delta-positive/70",
              (deltaIntent === "neutral" || deltaIntent === "review") &&
                "bg-fg-subtle/60",
            )}
            style={{ width: `${shareBarWidth}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[11.5px] text-fg-subtle">
        <div className="flex items-center justify-between gap-2">
          <span>Prev month</span>
          <span className="font-mono tabular-nums text-fg-secondary">
            {item.previousAmount
              ? formatMoneyShort(item.previousAmount.amountMinor)
              : "—"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {primaryDocument ? (
            <DocumentChip
              label={primaryDocument.title}
              href={`/documents/${primaryDocument.hash}`}
              reference={primaryDocument.documentDate ?? undefined}
            />
          ) : (
            <span className="text-fg-faint">No source document</span>
          )}
          {remainingDocumentCount > 0 ? (
            <span className="font-mono text-[10.5px] text-fg-subtle">
              +{remainingDocumentCount} more
            </span>
          ) : null}
        </div>
      </div>
    </DenseCard>
  );
}

function buildTwoPointTrend(item: BreakdownItem) {
  if (!item.previousAmount) {
    return null;
  }

  return [item.previousAmount.amountMinor, item.amount.amountMinor];
}

function sparklineIntentFor(intent: DeltaIntent) {
  if (intent === "negative") {
    return "negative" as const;
  }

  if (intent === "positive") {
    return "positive" as const;
  }

  return "neutral" as const;
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

function formatSignedMoney(amountMinor: number) {
  const formatted = formatMoneyShort(Math.abs(amountMinor));

  if (amountMinor > 0) {
    return `+${formatted}`;
  }

  if (amountMinor < 0) {
    return `−${formatted}`;
  }

  return formatted;
}

function formatChangeStatus(status: ChangeStatus) {
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
      return "No prev";
    default:
      return "Change";
  }
}

function deltaIntentForCost(amountMinor: number): DeltaIntent {
  if (amountMinor > 0) {
    return "negative";
  }

  if (amountMinor < 0) {
    return "positive";
  }

  return "neutral";
}

function statusKindForChange(status: ChangeStatus): StatusKind {
  switch (status) {
    case "down":
      return "success";
    case "up":
      return "warning";
    case "new":
      return "info";
    case "flat":
      return "neutral";
    case "no_previous":
      return "missing";
    default:
      return "neutral";
  }
}
