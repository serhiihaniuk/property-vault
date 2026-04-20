import { type CategoryBreakdown } from "@/src/shared/lib/dashboard-v0"

import { CategoryCard } from "./category-card"

interface DashboardCategoryBreakdownWidgetProps {
  categories: CategoryBreakdown[]
  categoryCount: number
  changedCategoryCount: number
  previousMonthValue: string | null
  selectedMonthValue: string | null
  unavailableReason?: string | null
}

export function DashboardCategoryBreakdownWidget({
  categories,
  categoryCount,
  changedCategoryCount,
  previousMonthValue,
  selectedMonthValue,
  unavailableReason,
}: DashboardCategoryBreakdownWidgetProps) {
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
        {categories.length > 0 ? (
          categories
            .slice(0, 8)
            .map((category) => (
              <CategoryCard key={category.category} category={category} />
            ))
        ) : (
          <div className="col-span-full rounded-lg border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
            No category breakdown is available yet.
          </div>
        )}
      </div>
    </>
  )
}
