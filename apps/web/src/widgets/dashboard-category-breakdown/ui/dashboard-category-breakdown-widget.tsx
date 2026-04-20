import { type CategoryBreakdown } from "@/src/shared/lib/dashboard-v0"

import { CategoryCard } from "./category-card"

interface DashboardCategoryBreakdownWidgetProps {
  categories: CategoryBreakdown[]
  categoryCount: number
  changedCategoryCount: number
  previousMonthValue: string
  selectedMonthValue: string
}

export function DashboardCategoryBreakdownWidget({
  categories,
  categoryCount,
  changedCategoryCount,
  previousMonthValue,
  selectedMonthValue,
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
          period {previousMonthValue} → {selectedMonthValue}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
        {categories.slice(0, 8).map((category) => (
          <CategoryCard key={category.category} category={category} />
        ))}
      </div>
    </>
  )
}
