import {
  type CategoryBreakdown,
  type DashboardSurfaceStateKind,
} from "@/src/shared/lib/dashboard-v0"
import { StateSurface } from "@/src/shared/ui"

import { CategoryCard } from "./category-card"

interface DashboardCategoryBreakdownWidgetProps {
  categories: CategoryBreakdown[]
  categoryCount: number
  changedCategoryCount: number
  previousMonthValue: string | null
  selectedMonthValue: string | null
  state: DashboardSurfaceStateKind
  unavailableReason?: string | null
}

export function DashboardCategoryBreakdownWidget({
  categories,
  categoryCount,
  changedCategoryCount,
  previousMonthValue,
  selectedMonthValue,
  state,
  unavailableReason,
}: DashboardCategoryBreakdownWidgetProps) {
  if (state === "loading") {
    return (
      <StateSurface
        description="Loading this month versus last month category totals and document-backed comparison context."
        label="Loading category breakdown"
        rows={8}
        title="Breakdown by category"
        variant="loading"
      />
    )
  }

  if (state === "error") {
    return (
      <StateSurface
        description="Category-level month-over-month comparison could not be loaded."
        stateDescription={unavailableReason ?? undefined}
        stateTitle="Category breakdown unavailable"
        title="Breakdown by category unavailable"
        variant="error"
      />
    )
  }

  if (state === "empty") {
    return (
      <StateSurface
        description="Category cards appear here once indexed monthly charge rows are available."
        stateDescription={
          unavailableReason ??
          "Sync the latest dashboard month to populate category comparison cards."
        }
        stateTitle="No category breakdown yet"
        title="Breakdown by category"
        variant="empty"
      />
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium text-foreground">
            Breakdown by category
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This month vs last · {categoryCount} categories ·{" "}
            {changedCategoryCount} changed
          </p>
        </div>
        <div className="rounded bg-secondary/50 px-2 py-1 font-mono text-xs text-muted-foreground">
          {previousMonthValue && selectedMonthValue
            ? `period ${previousMonthValue} → ${selectedMonthValue}`
            : "period unavailable"}
        </div>
      </div>
      {unavailableReason ? (
        <div className="mb-4 text-xs text-muted-foreground">
          {unavailableReason}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
        {categories.slice(0, 8).map((category) => (
          <CategoryCard key={category.category} category={category} />
        ))}
      </div>
    </>
  )
}
