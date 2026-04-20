import { AlertCircle, AlertTriangle, Bell, FileText, Info } from "lucide-react"

import {
  type Anomaly,
  type ReconciliationSummary,
} from "@/src/shared/lib/dashboard-v0"
import { cn } from "@/src/shared/lib/utils"
import { Badge } from "@/src/shared/ui/badge"

interface DashboardOpenItemsWidgetProps {
  anomalies: Anomaly[]
  reconciliationSummary: ReconciliationSummary
}

const severityColors = {
  critical: {
    bg: "bg-rose-400/5 hover:bg-rose-400/8",
    icon: "text-rose-400/80",
    text: "text-rose-400/90",
  },
  info: {
    bg: "bg-sky-400/5 hover:bg-sky-400/8",
    icon: "text-sky-400/70",
    text: "text-sky-400/80",
  },
  warning: {
    bg: "bg-amber-400/5 hover:bg-amber-400/8",
    icon: "text-amber-400/80",
    text: "text-amber-400/90",
  },
} satisfies Record<
  Anomaly["severity"],
  { bg: string; icon: string; text: string }
>

function SeverityIcon({ severity }: { severity: Anomaly["severity"] }) {
  const colors = severityColors[severity]

  switch (severity) {
    case "critical":
      return <AlertTriangle className={cn("h-3.5 w-3.5", colors.icon)} />
    case "warning":
      return <AlertCircle className={cn("h-3.5 w-3.5", colors.icon)} />
    case "info":
      return <Info className={cn("h-3.5 w-3.5", colors.icon)} />
    default:
      return null
  }
}

export function DashboardOpenItemsWidget({
  anomalies,
  reconciliationSummary,
}: DashboardOpenItemsWidgetProps) {
  const openAnomalies = anomalies.filter((anomaly) => anomaly.status === "open")
  const withDates = openAnomalies.filter((anomaly) => anomaly.date)
  const withoutDates = openAnomalies.filter((anomaly) => !anomaly.date)
  const isAllClear =
    openAnomalies.length === 0 && reconciliationSummary.openLineCount === 0

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-5 pb-0">
        <div>
          <h2 className="text-base font-medium text-foreground">
            Open Items & Anomalies
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Detected issues requiring attention
          </p>
        </div>
        <div className="flex items-center gap-2">
          {reconciliationSummary.openLineCount > 0 ? (
            <Badge className="border-amber-400/30 text-xs" variant="outline">
              <span className="mr-1 text-amber-400">
                {reconciliationSummary.openLineCount}
              </span>
              <span className="text-muted-foreground">
                reconciliation lines
              </span>
            </Badge>
          ) : null}
          <Badge className="text-xs" variant="outline">
            <span className="mr-1 text-foreground">{openAnomalies.length}</span>
            <span className="text-muted-foreground">anomalies</span>
          </Badge>
        </div>
      </div>

      {isAllClear ? (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10">
            <svg
              className="h-6 w-6 text-emerald-400/80"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M5 13l4 4L19 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="mb-1 text-sm font-medium text-foreground">
            All clear
          </h3>
          <p className="max-w-[240px] text-xs text-muted-foreground">
            No anomalies detected and all reconciliation lines are resolved.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Time-sensitive
              </h3>
            </div>
            <div className="space-y-2">
              {withDates.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No time-sensitive anomalies
                </div>
              ) : (
                withDates.map((anomaly) => {
                  const [day, month] = new Date(anomaly.date)
                    .toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })
                    .split(" ")

                  return (
                    <div
                      className={cn(
                        "flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors",
                        severityColors[anomaly.severity].bg
                      )}
                      key={anomaly.id}
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-secondary text-center">
                        <div>
                          <div className="text-xs font-medium text-foreground">
                            {day}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {month}
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <SeverityIcon severity={anomaly.severity} />
                          <span
                            className={cn(
                              "text-sm font-medium",
                              severityColors[anomaly.severity].text
                            )}
                          >
                            {anomaly.ruleLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {anomaly.summary}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Other anomalies
              </h3>
            </div>
            <div className="space-y-2">
              {withoutDates.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No other anomalies
                </div>
              ) : (
                withoutDates.map((anomaly) => (
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors",
                      severityColors[anomaly.severity].bg
                    )}
                    key={anomaly.id}
                  >
                    <div className="mt-0.5">
                      <SeverityIcon severity={anomaly.severity} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          severityColors[anomaly.severity].text
                        )}
                      >
                        {anomaly.summary}
                      </span>
                      {anomaly.context.length > 0 ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {anomaly.context
                            .slice(0, 2)
                            .map(
                              (context) => `${context.label}: ${context.value}`
                            )
                            .join(" · ")}
                        </p>
                      ) : null}
                      {anomaly.subjectDocument ? (
                        <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground/60">
                          {anomaly.subjectDocument.title}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
