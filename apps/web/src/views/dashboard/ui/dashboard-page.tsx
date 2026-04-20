"use client"

import { useState } from "react"

import { AccountStatusCard } from "./account-status-card"
import { CategoryCard } from "./category-card"
import { DocumentsTable } from "./documents-table"
import { type TimeRange } from "./dashboard-v0-helpers"
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
import { MonthlyTrendChart } from "./monthly-trend-chart"
import { OpenItemsPanel } from "./open-items-panel"
import { PrimarySummaryCard } from "./primary-summary-card"
import { TopBar } from "./top-bar"

export function DashboardPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("12m")

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
          <PrimarySummaryCard
            currentMonthData={currentMonthData}
            previousMonth={previousMonth}
            selectedMonth={selectedMonth}
            summary={dashboardSummary}
          />
          <AccountStatusCard
            anomalies={anomalies}
            generatedAt={generatedAt}
            reconciliationCoverage={reconciliationCoverage}
            reconciliationSummary={reconciliationSummary}
          />
        </section>

        <section className="mb-6">
          <MonthlyTrendChart data={monthlyTrend} categories={categories} />
        </section>

        <section className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-medium text-foreground">
                Breakdown by category
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                This month vs last · {dashboardSummary.categoryCount} categories
                · {dashboardSummary.changedCategoryCount} changed
              </p>
            </div>
            <div className="rounded bg-secondary/50 px-2 py-1 font-mono text-xs text-muted-foreground">
              period {previousMonth.value} → {selectedMonth.value}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            {categories.slice(0, 8).map((category) => (
              <CategoryCard key={category.category} category={category} />
            ))}
          </div>
        </section>

        <section className="mb-6">
          <OpenItemsPanel
            anomalies={anomalies}
            reconciliationSummary={reconciliationSummary}
          />
        </section>

        <section>
          <DocumentsTable documents={sourceDocuments} />
        </section>
      </div>
    </div>
  )
}
