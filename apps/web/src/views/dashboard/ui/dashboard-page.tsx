"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { usePropertyVaultApiClient } from "@/src/shared/api/api-client-provider";
import { PropertyVaultApiError } from "@/src/shared/api/client";
import { AnomalyFeedWidget } from "@/src/widgets/anomaly-feed/ui/anomaly-feed-widget";
import { DashboardFoundationWidget } from "@/src/widgets/dashboard-foundation/ui/dashboard-foundation-widget";
import { DashboardOverviewWidget } from "@/src/widgets/dashboard-overview/ui/dashboard-overview-widget";
import { DashboardSummaryWidget } from "@/src/widgets/dashboard-summary/ui/dashboard-summary-widget";
import { YearlyReconciliationWidget } from "@/src/widgets/yearly-reconciliation/ui/yearly-reconciliation-widget";

export function DashboardPage() {
  return (
    <Suspense fallback={<DashboardPageFallback />}>
      <DashboardPageContent />
    </Suspense>
  );
}

function DashboardPageContent() {
  const apiClient = usePropertyVaultApiClient();
  const searchParams = useSearchParams();
  const requestedMonth = searchParams.get("month") ?? undefined;
  const requestedYear = searchParams.get("year") ?? undefined;
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "month-breakdown", requestedMonth ?? "latest"],
    queryFn: () =>
      requestedMonth
        ? apiClient.getDashboardMonthBreakdown({
            query: {
              month: requestedMonth,
            },
          })
        : apiClient.getDashboardMonthBreakdown(),
  });
  const yearlyReconciliationQuery = useQuery({
    queryKey: ["financials", "yearly-reconciliation", requestedYear ?? "default"],
    queryFn: () =>
      requestedYear
        ? apiClient.getYearlyReconciliation({
            query: {
              year: requestedYear,
            },
          })
        : apiClient.getYearlyReconciliation(),
  });
  const anomalyFeedQuery = useQuery({
    queryKey: ["anomalies", "open"],
    queryFn: () => apiClient.getOpenAnomalies(),
  });
  const dashboardErrorMessage = getApiErrorMessage(
    dashboardQuery.error,
    "Dashboard data could not be loaded.",
  );
  const yearlyReconciliationErrorMessage = getApiErrorMessage(
    yearlyReconciliationQuery.error,
    "Yearly reconciliation data could not be loaded.",
  );
  const anomalyFeedErrorMessage = getApiErrorMessage(
    anomalyFeedQuery.error,
    "Open anomalies could not be loaded.",
  );

  return (
    <div className="flex flex-col gap-6">
      <DashboardOverviewWidget
        data={dashboardQuery.data}
        errorMessage={dashboardErrorMessage}
        isLoading={dashboardQuery.isPending}
        selectedYearValue={requestedYear}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DashboardSummaryWidget
          data={dashboardQuery.data}
          errorMessage={dashboardErrorMessage}
          isLoading={dashboardQuery.isPending}
        />
        <DashboardFoundationWidget
          data={dashboardQuery.data}
          errorMessage={dashboardErrorMessage}
          isLoading={dashboardQuery.isPending}
          selectedYearValue={requestedYear}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <YearlyReconciliationWidget
          data={yearlyReconciliationQuery.data}
          errorMessage={yearlyReconciliationErrorMessage}
          isLoading={yearlyReconciliationQuery.isPending}
          selectedMonthValue={requestedMonth}
        />
        <AnomalyFeedWidget
          data={anomalyFeedQuery.data}
          errorMessage={anomalyFeedErrorMessage}
          isLoading={anomalyFeedQuery.isPending}
        />
      </div>
    </div>
  );
}

function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof PropertyVaultApiError) {
    return error.problem?.detail ?? error.problem?.title ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallbackMessage;
}

function DashboardPageFallback() {
  return (
    <div className="flex flex-col gap-6">
      <DashboardOverviewWidget isLoading />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DashboardSummaryWidget isLoading />
        <DashboardFoundationWidget isLoading />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <YearlyReconciliationWidget isLoading />
        <AnomalyFeedWidget isLoading />
      </div>
    </div>
  );
}
