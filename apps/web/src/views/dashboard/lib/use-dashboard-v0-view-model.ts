"use client"

import { useMemo } from "react"
import { useQueries, useQuery } from "@tanstack/react-query"

import { usePropertyVaultApiClient } from "@/src/shared/api/api-client-provider"
import { PropertyVaultApiError } from "@/src/shared/api/client"

import {
  buildDashboardV0ViewModel,
  getHistoryMonthsForRange,
  type DashboardTimeRange,
} from "./dashboard-v0-adapter"

export function useDashboardV0ViewModel(timeRange: DashboardTimeRange) {
  const apiClient = usePropertyVaultApiClient()
  const dashboardQuery = useQuery({
    queryKey: ["dashboard", "month-breakdown", "latest"],
    queryFn: () => apiClient.getDashboardMonthBreakdown(),
  })
  const reconciliationQuery = useQuery({
    queryKey: ["financials", "year-reconciliation", "latest"],
    queryFn: () => apiClient.getYearlyReconciliation(),
  })
  const anomaliesQuery = useQuery({
    queryKey: ["anomalies", "open"],
    queryFn: () => apiClient.getOpenAnomalies(),
  })
  const documentsQuery = useQuery({
    queryKey: ["documents", "catalog", "all"],
    queryFn: () => apiClient.getDocuments(),
  })
  const historyRangeMonths = useMemo(
    () =>
      getHistoryMonthsForRange(dashboardQuery.data?.months ?? [], timeRange),
    [dashboardQuery.data?.months, timeRange]
  )
  const historyMonthValues = useMemo(
    () =>
      historyRangeMonths
        .map((month) => month.period.value)
        .filter((monthValue): monthValue is string => Boolean(monthValue))
        .filter(
          (monthValue) =>
            monthValue !== dashboardQuery.data?.selectedMonth?.value
        ),
    [dashboardQuery.data?.selectedMonth?.value, historyRangeMonths]
  )
  const historyQueries = useQueries({
    queries: historyMonthValues.map((monthValue) => ({
      queryKey: ["dashboard", "month-breakdown", monthValue],
      queryFn: () =>
        apiClient.getDashboardMonthBreakdown({
          query: { month: monthValue },
        }),
    })),
  })
  const historyError = historyQueries.find((query) => query.error)?.error

  return useMemo(
    () =>
      buildDashboardV0ViewModel({
        anomalies: anomaliesQuery.data,
        anomaliesError: getApiErrorMessage(anomaliesQuery.error),
        anomaliesLoading: anomaliesQuery.isPending,
        dashboard: dashboardQuery.data,
        dashboardError: getApiErrorMessage(dashboardQuery.error),
        dashboardLoading: dashboardQuery.isPending,
        documents: documentsQuery.data,
        documentsError: getApiErrorMessage(documentsQuery.error),
        documentsLoading: documentsQuery.isPending,
        historyError: getApiErrorMessage(historyError),
        historyBreakdowns: historyQueries.flatMap((query) =>
          query.data ? [query.data] : []
        ),
        historyLoading: historyQueries.some((query) => query.isPending),
        historyRangeMonths,
        reconciliation: reconciliationQuery.data,
        reconciliationError: getApiErrorMessage(reconciliationQuery.error),
        reconciliationLoading: reconciliationQuery.isPending,
        timeRange,
      }),
    [
      anomaliesQuery.data,
      anomaliesQuery.error,
      anomaliesQuery.isPending,
      dashboardQuery.data,
      dashboardQuery.error,
      dashboardQuery.isPending,
      documentsQuery.data,
      documentsQuery.error,
      documentsQuery.isPending,
      historyError,
      historyQueries,
      historyRangeMonths,
      reconciliationQuery.data,
      reconciliationQuery.error,
      reconciliationQuery.isPending,
      timeRange,
    ]
  )
}

function getApiErrorMessage(error: unknown): string | null {
  if (!error) {
    return null
  }

  if (error instanceof PropertyVaultApiError) {
    return error.problem?.detail ?? error.problem?.title ?? error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return "The live dashboard data could not be loaded."
}
