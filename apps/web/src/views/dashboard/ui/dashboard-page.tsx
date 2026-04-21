"use client"

import { useState } from "react"

import { DashboardAccountStatusWidget } from "@/src/widgets/dashboard-account-status/ui/dashboard-account-status-widget"
import { DashboardCategoryBreakdownWidget } from "@/src/widgets/dashboard-category-breakdown/ui/dashboard-category-breakdown-widget"
import { DashboardDocumentsTableWidget } from "@/src/widgets/dashboard-documents-table/ui/dashboard-documents-table-widget"
import { DashboardMonthlyTrendWidget } from "@/src/widgets/dashboard-monthly-trend/ui/dashboard-monthly-trend-widget"
import { DashboardOpenItemsWidget } from "@/src/widgets/dashboard-open-items/ui/dashboard-open-items-widget"
import { DashboardPrimarySummaryWidget } from "@/src/widgets/dashboard-primary-summary/ui/dashboard-primary-summary-widget"

import { type DashboardTimeRange } from "../lib/dashboard-v0-adapter"
import { useDashboardV0ViewModel } from "../lib/use-dashboard-v0-view-model"
import { TopBar } from "./top-bar"

export function DashboardPage() {
  const [timeRange, setTimeRange] = useState<DashboardTimeRange>("12m")
  const viewModel = useDashboardV0ViewModel(timeRange)

  return (
    <div className="relative left-1/2 -my-6 min-h-svh w-screen -translate-x-1/2 overflow-x-clip bg-background">
      <div className="mx-auto max-w-[1600px] px-6 pb-12">
        <TopBar
          title="Finances"
          subtitle={viewModel.subtitle}
          property="63713"
          syncStatus={viewModel.syncStatus}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />

        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DashboardPrimarySummaryWidget
            currentMonthData={viewModel.primarySummary.currentMonthData}
            previousMonth={viewModel.primarySummary.previousMonth}
            selectedMonth={viewModel.primarySummary.selectedMonth}
            summary={viewModel.primarySummary.summary}
            unavailableReason={viewModel.primarySummary.unavailableReason}
          />
          <DashboardAccountStatusWidget
            anomalies={viewModel.accountStatus.anomalies}
            generatedAt={viewModel.accountStatus.generatedAt}
            reconciliationCoverage={
              viewModel.accountStatus.reconciliationCoverage
            }
            reconciliationSummary={
              viewModel.accountStatus.reconciliationSummary
            }
            unavailableReason={viewModel.accountStatus.unavailableReason}
          />
        </section>

        <section className="mb-6">
          <DashboardMonthlyTrendWidget
            categories={viewModel.monthlyTrend.categories}
            data={viewModel.monthlyTrend.data}
            rangeLabel={viewModel.monthlyTrend.rangeLabel}
            unavailableReason={viewModel.monthlyTrend.unavailableReason}
          />
        </section>

        <section className="mb-6">
          <DashboardCategoryBreakdownWidget
            categories={viewModel.categoryBreakdown.categories}
            categoryCount={viewModel.categoryBreakdown.categoryCount}
            changedCategoryCount={
              viewModel.categoryBreakdown.changedCategoryCount
            }
            previousMonthValue={viewModel.categoryBreakdown.previousMonthValue}
            selectedMonthValue={viewModel.categoryBreakdown.selectedMonthValue}
            unavailableReason={viewModel.categoryBreakdown.unavailableReason}
          />
        </section>

        <section className="mb-6">
          <DashboardOpenItemsWidget
            anomalies={viewModel.openItems.anomalies}
            reconciliationSummary={viewModel.openItems.reconciliationSummary}
            unavailableReason={viewModel.openItems.unavailableReason}
          />
        </section>

        <section>
          <DashboardDocumentsTableWidget
            documents={viewModel.documentsTable.documents}
            unavailableReason={viewModel.documentsTable.unavailableReason}
          />
        </section>
      </div>
    </div>
  )
}
