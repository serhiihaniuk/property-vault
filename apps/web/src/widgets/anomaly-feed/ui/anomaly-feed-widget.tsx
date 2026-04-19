import Link from "next/link";

import type { OpenAnomaliesData } from "@/src/shared/api/client";
import { Badge } from "@/src/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/shared/ui/card";
import { Separator } from "@/src/shared/ui/separator";

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
      <Card>
        <CardHeader>
          <CardTitle>Open anomalies</CardTitle>
          <CardDescription>
            Loading the current anomaly feed and severity counts.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Open anomalies unavailable</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Open anomalies</CardTitle>
          <CardDescription>
            The latest unresolved anomalies will appear here after sync and
            anomaly detection populate the app database.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const groupedAnomalies = groupAnomalies(data.anomalies);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Open anomalies</CardTitle>
            <CardDescription>
              Outstanding warnings and critical items pulled from the current
              anomaly table.
            </CardDescription>
          </div>
          <Badge variant="secondary">
            {data.openCount}
            {" "}
            open
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {data.countsBySeverity.map((bucket) => (
            <Badge key={bucket.severity} variant={getSeverityBadgeVariant(bucket.severity)}>
              {formatSeverityLabel(bucket.severity)}
              {": "}
              {bucket.count}
            </Badge>
          ))}
        </div>
        {groupedAnomalies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open anomalies are recorded right now.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {groupedAnomalies.map((group) => (
              <Card key={group.ruleId} size="sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <CardTitle>{group.ruleLabel}</CardTitle>
                      <CardDescription>
                        {group.items.length}
                        {" "}
                        {group.items.length === 1 ? "item" : "items"}
                        {" "}
                        still unresolved
                      </CardDescription>
                    </div>
                    <Badge variant={getSeverityBadgeVariant(group.items[0]?.severity ?? "info")}>
                      {group.items[0]?.severityLabel ?? "Info"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {group.items.map((anomaly, index) => (
                    <div key={anomaly.id} className="flex flex-col gap-3">
                      {index > 0 ? <Separator /> : null}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-col gap-1">
                            <p className="font-medium">{anomaly.summary}</p>
                            <p className="text-xs text-muted-foreground">
                              Detected
                              {" "}
                              {formatDateTime(anomaly.detectedAt)}
                            </p>
                          </div>
                          <Badge variant={getSeverityBadgeVariant(anomaly.severity)}>
                            {anomaly.severityLabel}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {anomaly.date ? (
                            <Badge variant="outline">{anomaly.date}</Badge>
                          ) : null}
                          {anomaly.subjectDocument ? (
                            <Link
                              className="text-sm font-medium hover:text-foreground hover:underline"
                              href={`/documents/${anomaly.subjectDocument.hash}`}
                            >
                              {anomaly.subjectDocument.title}
                            </Link>
                          ) : null}
                          {anomaly.context.map((field) => (
                            <Badge
                              key={`${anomaly.id}-${field.label}`}
                              variant="outline"
                            >
                              {field.label}
                              {": "}
                              {field.value}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function groupAnomalies(anomalies: OpenAnomaliesData["anomalies"]) {
  const grouped = new Map<
    string,
    {
      items: OpenAnomaliesData["anomalies"];
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

function getSeverityBadgeVariant(severity: OpenAnomaliesData["anomalies"][number]["severity"]) {
  if (severity === "critical") {
    return "destructive" as const;
  }

  if (severity === "warning") {
    return "secondary" as const;
  }

  return "outline" as const;
}

function formatSeverityLabel(severity: OpenAnomaliesData["anomalies"][number]["severity"]) {
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
