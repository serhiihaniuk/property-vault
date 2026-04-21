import {
  type CategoryBreakdown,
  type DashboardSurfaceStateKind,
} from "@/src/shared/lib/dashboard-v0"
import { Skeleton } from "@/src/shared/ui"

import {
  CategoryCard,
  CategoryCardChartSkeleton,
  CategoryCardChartSlot,
} from "./category-card"

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
  const isLoading = state === "loading"
  const stateMessage =
    isLoading
      ? null
      : state === "error"
      ? unavailableReason ??
        "Category-level month-over-month comparison could not be loaded."
      : state === "empty"
        ? unavailableReason ??
          "Sync the latest dashboard month to populate category comparison cards."
        : unavailableReason

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
      {stateMessage ? (
        <div className="mb-4 text-xs text-muted-foreground">
          {stateMessage}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, index) => (
            <CategoryCardPlaceholder key={index} />
          ))
        ) : categories.length > 0 ? (
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

function CategoryCardPlaceholder() {
  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-sm" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-12" />
          </div>
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      <div className="mb-3 flex items-baseline gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-4 w-8" />
        <Skeleton className="ml-auto h-4 w-12" />
      </div>

      <CategoryCardChartSlot>
        <CategoryCardChartSkeleton />
      </CategoryCardChartSlot>

      <div className="mb-2 flex items-center gap-3 border-b border-border/50 pb-2">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-10" />
      </div>

      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border/50 pt-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-14" />
      </div>
    </div>
  )
}
