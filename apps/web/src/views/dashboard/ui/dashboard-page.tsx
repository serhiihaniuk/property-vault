"use client"

import { useState } from "react"

import { DashboardAccountStatusWidget } from "@/src/widgets/dashboard-account-status/ui/dashboard-account-status-widget"
import { DashboardCategoryBreakdownWidget } from "@/src/widgets/dashboard-category-breakdown/ui/dashboard-category-breakdown-widget"
import { DashboardDocumentsTableWidget } from "@/src/widgets/dashboard-documents-table/ui/dashboard-documents-table-widget"
import { DashboardMonthlyTrendWidget } from "@/src/widgets/dashboard-monthly-trend/ui/dashboard-monthly-trend-widget"
import { DashboardOpenItemsWidget } from "@/src/widgets/dashboard-open-items/ui/dashboard-open-items-widget"
import { DashboardPrimarySummaryWidget } from "@/src/widgets/dashboard-primary-summary/ui/dashboard-primary-summary-widget"

import {
  anomalies,
  categories,
  currentMonthData,
  dashboardSummary,
  generatedAt,
  monthlyTrend,
  previousMonth,
  reconciliationCoverage,
  reconciliationSummary,
  selectedMonth,
  sourceDocuments,
} from "./dashboard-v0-mock"
import { TopBar } from "./top-bar"

export function DashboardPage() {
  const [timeRange, setTimeRange] = useState<"6m" | "12m" | "24m" | "all">(
    "12m"
  )

  return (
    <div className="relative left-1/2 -my-6 min-h-svh w-screen -translate-x-1/2 overflow-x-clip bg-background">
      <div className="mx-auto max-w-[1600px] px-6 pb-12">
        <TopBar
          title="Finances"
          subtitle={`Latest state · ${selectedMonth.label}`}
          property="63713"
          syncFreshness={generatedAt}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />

        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DashboardPrimarySummaryWidget
            currentMonthData={currentMonthData}
            previousMonth={previousMonth}
            selectedMonth={selectedMonth}
            summary={dashboardSummary}
          />
          <DashboardAccountStatusWidget
            anomalies={anomalies}
            generatedAt={generatedAt}
            reconciliationCoverage={reconciliationCoverage}
            reconciliationSummary={reconciliationSummary}
          />
        </section>

        <section className="mb-6">
          <DashboardMonthlyTrendWidget
            categories={categories}
            data={monthlyTrend}
          />
        </section>

        <section className="mb-6">
          <DashboardCategoryBreakdownWidget
            categories={categories}
            categoryCount={dashboardSummary.categoryCount}
            changedCategoryCount={dashboardSummary.changedCategoryCount}
            previousMonthValue={previousMonth.value}
            selectedMonthValue={selectedMonth.value}
          />
        </section>

        <section className="mb-6">
          <DashboardOpenItemsWidget
            anomalies={anomalies}
            reconciliationSummary={reconciliationSummary}
          />
        </section>

        <section>
          <DashboardDocumentsTableWidget documents={sourceDocuments} />
        </section>
      </div>
    </div>
  )
}
