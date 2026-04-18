import { DashboardFoundationWidget } from "@/src/widgets/dashboard-foundation/ui/dashboard-foundation-widget";
import { DashboardOverviewWidget } from "@/src/widgets/dashboard-overview/ui/dashboard-overview-widget";
import { DashboardSummaryWidget } from "@/src/widgets/dashboard-summary/ui/dashboard-summary-widget";

export function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <DashboardOverviewWidget />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DashboardSummaryWidget />
        <DashboardFoundationWidget />
      </div>
    </div>
  );
}
