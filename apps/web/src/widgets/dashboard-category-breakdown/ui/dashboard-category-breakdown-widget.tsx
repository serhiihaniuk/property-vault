import {
  type CategoryBreakdown,
  type DashboardSurfaceStateKind,
} from "@/src/shared/lib/dashboard-v0"
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Surface,
  SurfaceBody,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
} from "@/src/shared/ui"

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
      <Surface density="comfortable" tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Breakdown by category</SurfaceTitle>
            <SurfaceDescription>
              Loading this month versus last month category totals and
              document-backed comparison context.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <LoadingState
            label="Loading category breakdown"
            rows={8}
            showHeader={false}
          />
        </SurfaceBody>
      </Surface>
    )
  }

  if (state === "error") {
    return (
      <Surface density="comfortable" tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Breakdown by category unavailable</SurfaceTitle>
            <SurfaceDescription>
              Category-level month-over-month comparison could not be loaded.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <ErrorState
            description={unavailableReason}
            title="Category breakdown unavailable"
          />
        </SurfaceBody>
      </Surface>
    )
  }

  if (state === "empty") {
    return (
      <Surface density="comfortable" tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Breakdown by category</SurfaceTitle>
            <SurfaceDescription>
              Category cards appear here once indexed monthly charge rows are
              available.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <EmptyState
            title="No category breakdown yet"
            description={
              unavailableReason ??
              "Sync the latest dashboard month to populate category comparison cards."
            }
          />
        </SurfaceBody>
      </Surface>
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
