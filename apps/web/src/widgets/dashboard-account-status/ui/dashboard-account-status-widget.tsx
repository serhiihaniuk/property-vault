import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react"

import {
  extractTime,
  formatAmountShort,
  type Anomaly,
  type ReconciliationCoverage,
  type ReconciliationSummary,
} from "@/src/shared/lib/dashboard-v0"
import { cn } from "@/src/shared/lib/utils"
import { Badge } from "@/src/shared/ui/badge"

interface DashboardAccountStatusWidgetProps {
  anomalies: Anomaly[]
  generatedAt: string | null
  reconciliationCoverage: ReconciliationCoverage | null
  reconciliationSummary: ReconciliationSummary | null
  unavailableReason?: string | null
}

export function DashboardAccountStatusWidget({
  anomalies,
  generatedAt,
  reconciliationCoverage,
  reconciliationSummary,
  unavailableReason,
}: DashboardAccountStatusWidgetProps) {
  const openAnomalies = anomalies.filter((anomaly) => anomaly.status === "open")
  const criticalCount = openAnomalies.filter(
    (anomaly) => anomaly.severity === "critical"
  ).length
  const warningCount = openAnomalies.filter(
    (anomaly) => anomaly.severity === "warning"
  ).length
  const infoCount = openAnomalies.filter(
    (anomaly) => anomaly.severity === "info"
  ).length
  const netBalance = reconciliationSummary?.netBalance
    ? formatAmountShort(reconciliationSummary.netBalance)
    : null
  const isPositive = netBalance === null ? null : netBalance >= 0

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="mb-1 text-sm font-medium text-muted-foreground">
            Operational Status
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {criticalCount > 0 ? (
                <Badge
                  className="border-rose-400/30 px-1.5 py-0 text-xs"
                  variant="outline"
                >
                  <AlertTriangle className="mr-1 h-3 w-3 text-rose-400" />
                  <span className="text-rose-400">{criticalCount}</span>
                </Badge>
              ) : null}
              {warningCount > 0 ? (
                <Badge
                  className="border-amber-400/30 px-1.5 py-0 text-xs"
                  variant="outline"
                >
                  <AlertCircle className="mr-1 h-3 w-3 text-amber-400" />
                  <span className="text-amber-400">{warningCount}</span>
                </Badge>
              ) : null}
              {infoCount > 0 ? (
                <Badge
                  className="border-blue-400/30 px-1.5 py-0 text-xs"
                  variant="outline"
                >
                  <Info className="mr-1 h-3 w-3 text-blue-400" />
                  <span className="text-blue-400">{infoCount}</span>
                </Badge>
              ) : null}
              {openAnomalies.length === 0 ? (
                <Badge
                  className="border-emerald-400/30 px-1.5 py-0 text-xs"
                  variant="outline"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">All clear</span>
                </Badge>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">
              {openAnomalies.length} open anomalies
            </span>
          </div>
        </div>
        <Badge className="px-2 py-0.5 font-mono text-xs" variant="outline">
          synced {extractTime(generatedAt)}
        </Badge>
      </div>

      <div className="border-t border-border pt-4">
        <h4 className="mb-3 text-xs tracking-wider text-muted-foreground uppercase">
          Year Reconciliation ·{" "}
          {reconciliationCoverage?.throughMonth?.value.split("-")[0] ?? "—"}
        </h4>

        <div className="mb-3 grid grid-cols-2 gap-4">
          <div>
            <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
              Coverage
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold tabular-nums">
                {reconciliationCoverage?.monthsCovered ?? "—"}
              </span>
              <span className="text-sm text-muted-foreground">months</span>
              {reconciliationCoverage ? (
                <Badge
                  className={cn(
                    "ml-auto px-1.5 py-0 text-[10px]",
                    reconciliationCoverage.status === "complete"
                      ? "border-emerald-400/30 text-emerald-400"
                      : reconciliationCoverage.status === "year_to_date"
                        ? "border-blue-400/30 text-blue-400"
                        : "border-amber-400/30 text-amber-400"
                  )}
                  variant="outline"
                >
                  {reconciliationCoverage.status.replace("_", " ")}
                </Badge>
              ) : (
                <Badge
                  className="ml-auto px-1.5 py-0 text-[10px]"
                  variant="outline"
                >
                  unavailable
                </Badge>
              )}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] tracking-wider text-muted-foreground uppercase">
              Net Balance
            </div>
            <div
              className={cn(
                "font-mono text-lg font-semibold tabular-nums",
                isPositive === null
                  ? "text-muted-foreground"
                  : isPositive
                    ? "text-emerald-400"
                    : "text-rose-400"
              )}
            >
              {netBalance === null
                ? "—"
                : `${isPositive ? "+" : ""}${netBalance.toLocaleString(
                    "pl-PL",
                    {
                      minimumFractionDigits: 2,
                    }
                  )} zl`}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          <SummaryValue
            label="Scheduled"
            value={reconciliationSummary?.scheduledTotal ?? null}
          />
          <SummaryValue
            label="Actual"
            value={reconciliationSummary?.actualCostTotal ?? null}
          />
          <SummaryValue
            label="Credits"
            positive
            value={reconciliationSummary?.creditsTotal ?? null}
          />
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3 text-xs">
          <span className="text-muted-foreground">
            {reconciliationSummary
              ? `${reconciliationSummary.settledLineCount} settled · ${reconciliationSummary.openLineCount} open lines`
              : "Reconciliation unavailable"}
          </span>
          <span className="font-mono text-muted-foreground">
            {reconciliationCoverage?.throughMonth
              ? `through ${reconciliationCoverage.throughMonth.label}`
              : "through —"}
          </span>
        </div>

        {unavailableReason ? (
          <div className="mt-3 text-xs text-muted-foreground">
            {unavailableReason}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SummaryValue({
  label,
  positive = false,
  value,
}: {
  label: string
  positive?: boolean
  value: ReconciliationSummary["scheduledTotal"] | null
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          positive && value ? "text-emerald-400" : undefined
        )}
      >
        {value
          ? `${positive ? "+" : ""}${formatAmountShort(value).toLocaleString("pl-PL")}`
          : "—"}
      </span>
    </div>
  )
}
