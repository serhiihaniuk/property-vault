"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { usePropertyVaultApiClient } from "@/src/shared/api/api-client-provider";
import { PropertyVaultApiError } from "@/src/shared/api/client";
import { DashboardFoundationWidget } from "@/src/widgets/dashboard-foundation/ui/dashboard-foundation-widget";
import { DashboardOverviewWidget } from "@/src/widgets/dashboard-overview/ui/dashboard-overview-widget";
import { DashboardSummaryWidget } from "@/src/widgets/dashboard-summary/ui/dashboard-summary-widget";

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
  const errorMessage = getDashboardErrorMessage(dashboardQuery.error);

  return (
    <div className="flex flex-col gap-6">
      <DashboardOverviewWidget
        data={dashboardQuery.data}
        errorMessage={errorMessage}
        isLoading={dashboardQuery.isPending}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DashboardSummaryWidget
          data={dashboardQuery.data}
          errorMessage={errorMessage}
          isLoading={dashboardQuery.isPending}
        />
        <DashboardFoundationWidget
          data={dashboardQuery.data}
          errorMessage={errorMessage}
          isLoading={dashboardQuery.isPending}
        />
      </div>
    </div>
  );
}

function getDashboardErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof PropertyVaultApiError) {
    return error.problem?.detail ?? error.problem?.title ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Dashboard data could not be loaded.";
}

function DashboardPageFallback() {
  return (
    <div className="flex flex-col gap-6">
      <DashboardOverviewWidget isLoading />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DashboardSummaryWidget isLoading />
        <DashboardFoundationWidget isLoading />
      </div>
    </div>
  );
}
