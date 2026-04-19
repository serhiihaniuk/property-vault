import type { DashboardMonthBreakdownData } from "@/src/shared/api/client";
import type { DeltaIntent } from "@/src/shared/ui";
import type { StatusKind } from "@/src/shared/ui";

export const DASHBOARD_LOCALE = "pl-PL";
export const DASHBOARD_CURRENCY = "PLN";

type ChangeStatus =
  DashboardMonthBreakdownData["breakdown"][number]["changeStatus"];

export function buildDashboardHref({
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

export function formatMoney(amountMinor: number) {
  return new Intl.NumberFormat(DASHBOARD_LOCALE, {
    currency: DASHBOARD_CURRENCY,
    style: "currency",
  }).format(amountMinor / 100);
}

export function formatSignedMoney(amountMinor: number) {
  const formatted = formatMoney(Math.abs(amountMinor));

  if (amountMinor > 0) {
    return `+${formatted}`;
  }

  if (amountMinor < 0) {
    return `−${formatted}`;
  }

  return formatted;
}

export function formatChangeStatus(status: ChangeStatus) {
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

/**
 * Property-operations convention: a higher cost is a *negative* financial
 * delta even though the raw number is positive. Keep intent derivation here so
 * widgets stay aligned on color semantics.
 */
export function deltaIntentForCost(amountMinor: number): DeltaIntent {
  if (amountMinor > 0) {
    return "negative";
  }

  if (amountMinor < 0) {
    return "positive";
  }

  return "neutral";
}

export function statusKindForChange(status: ChangeStatus): StatusKind {
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
