import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  FileText,
  Info,
} from "lucide-react"

import {
  type Anomaly,
  type DashboardSurfaceStateKind,
  type ReconciliationSummary,
} from "@/src/shared/lib/dashboard-v0"
import { cn } from "@/src/shared/lib/utils"
import { Badge, EmptyState, ErrorState, LoadingState } from "@/src/shared/ui"

interface DashboardOpenItemsWidgetProps {
  anomalies: Anomaly[]
  reconciliationSummary: ReconciliationSummary | null
  state: DashboardSurfaceStateKind
  unavailableReason?: string | null
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
  state,
  unavailableReason,
}: DashboardOpenItemsWidgetProps) {
  const isLoading = state === "loading"
  const isError = state === "error"
  const isEmpty = state === "empty"
  const openAnomalies = anomalies.filter((anomaly) => anomaly.status === "open")
  const withDates = openAnomalies.filter((anomaly) => anomaly.date)
  const withoutDates = openAnomalies.filter((anomaly) => !anomaly.date)
  const isAllClear =
    state === "ready" &&
    openAnomalies.length === 0 &&
    (reconciliationSummary?.openLineCount ?? 0) === 0 &&
    !unavailableReason
  const errorMessage =
    unavailableReason ??
    "Open issues could not be loaded from anomalies and reconciliation data."
  const emptyMessage =
    unavailableReason ??
    "Sync anomaly and reconciliation data to populate this queue."

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
          {reconciliationSummary && reconciliationSummary.openLineCount > 0 ? (
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

      {state === "ready" && unavailableReason ? (
        <div className="px-5 pt-3 text-xs text-muted-foreground">
          {unavailableReason}
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
          <OpenItemsSection
            icon={<Bell className="h-3.5 w-3.5 text-muted-foreground" />}
            title="Time-sensitive"
          >
            <LoadingState
              className="rounded-md border border-dashed border-border/70 bg-background/30 p-4"
              label="Loading time-sensitive anomalies"
              rows={4}
              showHeader={false}
            />
          </OpenItemsSection>
          <OpenItemsSection
            icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
            title="Other anomalies"
          >
            <LoadingState
              className="rounded-md border border-dashed border-border/70 bg-background/30 p-4"
              label="Loading other anomalies"
              rows={4}
              showHeader={false}
            />
          </OpenItemsSection>
        </div>
      ) : isError ? (
        <div className="p-5">
          <ErrorState
            title="Open items unavailable"
            description={errorMessage}
          />
        </div>
      ) : isEmpty ? (
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
          <OpenItemsSection
            icon={<Bell className="h-3.5 w-3.5 text-muted-foreground" />}
            title="Time-sensitive"
          >
            <EmptyState
              className="px-3 py-4"
              icon={Bell}
              title="No time-sensitive queue yet"
              description={emptyMessage}
            />
          </OpenItemsSection>
          <OpenItemsSection
            icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
            title="Other anomalies"
          >
            <EmptyState
              className="px-3 py-4"
              icon={FileText}
              title="No general review queue yet"
              description={emptyMessage}
            />
          </OpenItemsSection>
        </div>
      ) : isAllClear ? (
        <div className="p-5">
          <EmptyState
            className="border-status-success/25 bg-status-success-bg/40"
            icon={CheckCircle2}
            title="All clear"
            description="No anomalies detected and all reconciliation lines are resolved."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
          <OpenItemsSection
            icon={<Bell className="h-3.5 w-3.5 text-muted-foreground" />}
            title="Time-sensitive"
          >
            <div className="space-y-2">
              {withDates.length === 0 ? (
                <EmptyState
                  className="px-3 py-4"
                  icon={Bell}
                  title="No time-sensitive anomalies"
                  description="Dated issues will appear here when action is tied to a specific month or deadline."
                />
              ) : (
                withDates.map((anomaly) => {
                  const [day, month] = new Date(anomaly.date ?? "")
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
          </OpenItemsSection>

          <OpenItemsSection
            icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
            title="Other anomalies"
          >
            <div className="space-y-2">
              {withoutDates.length === 0 ? (
                <EmptyState
                  className="px-3 py-4"
                  icon={FileText}
                  title="No other anomalies"
                  description="General review items without a specific date will appear here."
                />
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
          </OpenItemsSection>
        </div>
      )}
    </div>
  )
}

function OpenItemsSection({
  children,
  icon,
  title,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  title: string
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h3 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {title}
        </h3>
      </div>
      {children}
    </div>
  )
}
