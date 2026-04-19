import type { OpenAnomaliesData } from "@/src/shared/api/client";
import {
  DocumentChip,
  EmptyState,
  ErrorState,
  LoadingState,
  MetricLabel,
  StatusBadge,
  Surface,
  SurfaceBody,
  SurfaceDescription,
  SurfaceDivider,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
  type StatusKind,
} from "@/src/shared/ui";

type Severity = OpenAnomaliesData["anomalies"][number]["severity"];
type Anomaly = OpenAnomaliesData["anomalies"][number];

export interface AnomalyFeedWidgetProps {
  data?: OpenAnomaliesData;
  errorMessage?: string | null;
  isLoading: boolean;
}

export function AnomalyFeedWidget({
  data,
  errorMessage,
  isLoading,
}: AnomalyFeedWidgetProps) {
  if (isLoading) {
    return (
      <Surface>
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Open anomalies</SurfaceTitle>
            <SurfaceDescription>
              Loading unresolved anomaly feed.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <LoadingState rows={4} label="Loading anomalies…" />
        </SurfaceBody>
      </Surface>
    );
  }

  if (errorMessage) {
    return (
      <Surface>
        <SurfaceBody>
          <ErrorState
            title="Open anomalies unavailable"
            description={errorMessage}
          />
        </SurfaceBody>
      </Surface>
    );
  }

  if (!data) {
    return (
      <Surface>
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Open anomalies</SurfaceTitle>
            <SurfaceDescription>
              Unresolved anomalies appear here after sync and detection
              populate the app database.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
      </Surface>
    );
  }

  const groupedAnomalies = groupAnomalies(data.anomalies);

  return (
    <Surface>
      <SurfaceHeader>
        <SurfaceHeading>
          <SurfaceTitle>Open anomalies</SurfaceTitle>
          <SurfaceDescription>
            Outstanding warnings and critical items from the current anomaly
            table.
          </SurfaceDescription>
        </SurfaceHeading>
        <StatusBadge status={data.openCount > 0 ? "warning" : "success"} dot>
          {data.openCount}
          {" "}
          open
        </StatusBadge>
      </SurfaceHeader>

      <SurfaceBody>
        <div className="flex flex-wrap gap-1.5">
          {data.countsBySeverity.map((bucket) => (
            <StatusBadge
              key={bucket.severity}
              status={statusForSeverity(bucket.severity)}
              className="text-[10.5px]"
            >
              {formatSeverityLabel(bucket.severity)}
              {": "}
              {bucket.count}
            </StatusBadge>
          ))}
        </div>

        <SurfaceDivider variant="dashed" />

        {groupedAnomalies.length === 0 ? (
          <EmptyState
            title="No open anomalies"
            description="Nothing is currently flagged as unresolved."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {groupedAnomalies.map((group) => (
              <section key={group.ruleId} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <MetricLabel>{group.ruleLabel}</MetricLabel>
                    <span className="text-[11px] text-fg-subtle">
                      {group.items.length}
                      {" "}
                      {group.items.length === 1 ? "item" : "items"}
                      {" "}
                      unresolved
                    </span>
                  </div>
                  <StatusBadge
                    status={statusForSeverity(group.items[0]?.severity ?? "info")}
                  >
                    {group.items[0]?.severityLabel ?? "Info"}
                  </StatusBadge>
                </div>

                <ul className="flex flex-col divide-y divide-dashed divide-border-default rounded-md border border-border-muted bg-surface-subtle/40">
                  {group.items.map((anomaly) => (
                    <li
                      key={anomaly.id}
                      className="flex flex-col gap-1.5 px-3 py-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-[12.5px] text-fg-primary">
                          {anomaly.summary}
                        </p>
                        <StatusBadge
                          status={statusForSeverity(anomaly.severity)}
                          dot
                          className="shrink-0 text-[10px]"
                        >
                          {anomaly.severityLabel}
                        </StatusBadge>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-fg-subtle">
                        <span className="font-mono">
                          {formatDateTime(anomaly.detectedAt)}
                        </span>
                        {anomaly.date ? (
                          <span className="font-mono text-fg-secondary">
                            · {anomaly.date}
                          </span>
                        ) : null}
                        {anomaly.subjectDocument ? (
                          <DocumentChip
                            label={anomaly.subjectDocument.title}
                            href={`/documents/${anomaly.subjectDocument.hash}`}
                          />
                        ) : null}
                        {anomaly.context.map((field) => (
                          <span
                            key={`${anomaly.id}-${field.label}`}
                            className="rounded border border-border-muted bg-surface-elevated px-1 py-0.5 font-mono text-[10.5px] text-fg-secondary"
                          >
                            <span className="text-fg-subtle">{field.label}:</span>
                            {" "}
                            {field.value}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </SurfaceBody>
    </Surface>
  );
}

function groupAnomalies(anomalies: OpenAnomaliesData["anomalies"]) {
  const grouped = new Map<
    string,
    {
      items: Anomaly[];
      ruleId: string;
      ruleLabel: string;
    }
  >();

  for (const anomaly of anomalies) {
    const existing = grouped.get(anomaly.ruleId);

    if (existing) {
      existing.items.push(anomaly);
      continue;
    }

    grouped.set(anomaly.ruleId, {
      items: [anomaly],
      ruleId: anomaly.ruleId,
      ruleLabel: anomaly.ruleLabel,
    });
  }

  return Array.from(grouped.values());
}

function statusForSeverity(severity: Severity): StatusKind {
  if (severity === "critical") {
    return "danger";
  }

  if (severity === "warning") {
    return "warning";
  }

  return "info";
}

function formatSeverityLabel(severity: Severity) {
  switch (severity) {
    case "critical":
      return "Critical";
    case "warning":
      return "Warning";
    default:
      return "Info";
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

