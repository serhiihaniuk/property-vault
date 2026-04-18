import type { DocumentDetailData } from "@/src/shared/api/client";
import { Badge } from "@/src/shared/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/shared/ui/card";

export interface DocumentRecordWidgetProps {
  data?: DocumentDetailData;
  errorMessage?: string | null;
  isLoading: boolean;
}

export function DocumentRecordWidget({
  data,
  errorMessage,
  isLoading,
}: DocumentRecordWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Document detail</CardTitle>
          <CardDescription>
            Loading indexed metadata, extracted facts, and record state.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Document detail unavailable</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Document detail</CardTitle>
          <CardDescription>No document detail is available yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>{data.document.title}</CardTitle>
            <CardDescription>{data.document.summaryPlain}</CardDescription>
          </div>
          <CardAction className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{data.document.documentTypeLabel}</Badge>
            <Badge variant={getStatusBadgeVariant(data.document.status)}>
              {formatStatus(data.document.status)}
            </Badge>
          </CardAction>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetadataField
              label="Document date"
              value={
                data.document.documentDate ? formatDate(data.document.documentDate) : "n/a"
              }
            />
            <MetadataField
              label="Reporting period"
              value={data.document.period?.label ?? "No normalized period"}
            />
            <MetadataField
              label="Extraction confidence"
              value={`${Math.round(data.document.confidence * 100)}%`}
            />
            <MetadataField
              label="Ingested"
              value={formatDateTime(data.document.ingestedAt)}
            />
            <MetadataField
              label="Extracted"
              value={formatDateTime(data.document.extractedAt)}
            />
            <MetadataField
              label="Pages"
              value={data.document.pageCount ? String(data.document.pageCount) : "n/a"}
            />
            <MetadataField label="MIME" value={data.document.mime} />
            <MetadataField
              label="OCR"
              value={data.document.needsOcr ? "Needed" : "Not needed"}
            />
            <MetadataField
              label="Supporting note"
              value={data.document.noteAvailable ? "Available" : "Missing"}
            />
          </div>
          <Card size="sm">
            <CardHeader>
              <CardTitle>Key facts</CardTitle>
              <CardDescription>
                Extracted facts intended to summarize the document quickly.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {data.keyFacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No key facts were extracted for this document.
                </p>
              ) : (
                data.keyFacts.map((fact) => (
                  <div
                    key={`${fact.label}:${fact.value}`}
                    className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/30 p-3"
                  >
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {fact.label}
                    </p>
                    <p className="text-sm">{fact.value}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4">
          <MessageCard
            description="Items that may need a human follow-up."
            items={data.questionsForUser}
            title="Questions for user"
          />
          <MessageCard
            description="Warnings captured during extraction or review."
            items={data.warnings}
            title="Warnings"
            variant="warning"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function MessageCard({
  description,
  items,
  title,
  variant = "default",
}: {
  description: string;
  items: string[];
  title: string;
  variant?: "default" | "warning";
}) {
  return (
    <Card size="sm" className={variant === "warning" ? "ring-destructive/20" : undefined}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">None recorded.</p>
        ) : (
          items.map((item) => (
            <div
              key={item}
              className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm"
            >
              {item}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function MetadataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/30 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function formatStatus(status: DocumentDetailData["document"]["status"]) {
  switch (status) {
    case "failed":
      return "Failed";
    case "needs_review":
      return "Needs review";
    case "ok":
      return "OK";
    default:
      return "Status";
  }
}

function getStatusBadgeVariant(status: DocumentDetailData["document"]["status"]) {
  if (status === "failed") {
    return "destructive" as const;
  }

  if (status === "needs_review") {
    return "secondary" as const;
  }

  return "outline" as const;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}
