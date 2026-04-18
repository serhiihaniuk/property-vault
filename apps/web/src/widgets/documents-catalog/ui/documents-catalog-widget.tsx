import Link from "next/link";

import type { DocumentsCatalogData } from "@/src/shared/api/client";
import { Badge, badgeVariants } from "@/src/shared/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/shared/ui/card";
import { cn } from "@/src/shared/lib/utils";

export interface DocumentsCatalogWidgetProps {
  data?: DocumentsCatalogData;
  errorMessage?: string | null;
  isLoading: boolean;
}

export function DocumentsCatalogWidget({
  data,
  errorMessage,
  isLoading,
}: DocumentsCatalogWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Loading the indexed evidence catalog and document type filters.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Documents unavailable</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Document records will appear here after canonical evidence is synced into
            Postgres.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              Indexed evidence records with extraction status, period context, and
              provenance counts.
            </CardDescription>
          </div>
          <CardAction className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{data.documents.length} shown</Badge>
            <Badge variant="outline">
              {data.availableTypes.reduce((sum, item) => sum + item.count, 0)} total indexed
            </Badge>
          </CardAction>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Link
            className={cn(
              badgeVariants({
                variant: data.selectedDocumentType ? "outline" : "secondary",
              }),
            )}
            href="/documents"
          >
            All types
          </Link>
          {data.availableTypes.map((type) => {
            const isSelected = type.documentType === data.selectedDocumentType;

            return (
              <Link
                key={type.documentType}
                className={cn(
                  badgeVariants({
                    variant: isSelected ? "secondary" : "outline",
                  }),
                )}
                href={`/documents?type=${encodeURIComponent(type.documentType)}`}
              >
                {type.label}
                {" "}
                <span className="font-mono">{type.count}</span>
              </Link>
            );
          })}
        </div>
        {data.documents.length === 0 ? (
          <Card size="sm">
            <CardHeader>
              <CardTitle>No matching documents</CardTitle>
              <CardDescription>
                {data.selectedDocumentType
                  ? "No indexed documents match the selected type yet."
                  : "No indexed documents are available yet."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.documents.map((document) => (
              <Card key={document.hash} size="sm">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle className="line-clamp-2">
                        <Link
                          className="hover:text-primary"
                          href={`/documents/${document.hash}`}
                        >
                          {document.title}
                        </Link>
                      </CardTitle>
                      <CardDescription>{document.summaryPlain}</CardDescription>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Badge variant="secondary">{document.documentTypeLabel}</Badge>
                      <Badge variant={getStatusBadgeVariant(document.status)}>
                        {formatStatus(document.status)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetadataField
                      label="Document date"
                      value={document.documentDate ? formatDate(document.documentDate) : "n/a"}
                    />
                    <MetadataField
                      label="Reporting period"
                      value={document.period?.label ?? "No normalized period"}
                    />
                    <MetadataField
                      label="Financial rows"
                      value={String(document.financialRowCount)}
                    />
                    <MetadataField
                      label="Source observations"
                      value={String(document.sourceCount)}
                    />
                    <MetadataField
                      label="Extraction confidence"
                      value={`${Math.round(document.confidence * 100)}%`}
                    />
                    <MetadataField
                      label="Pages"
                      value={document.pageCount ? String(document.pageCount) : "n/a"}
                    />
                  </div>
                  {document.assetTag ? (
                    <p className="text-sm text-muted-foreground">
                      Asset tag:
                      {" "}
                      <span className="font-mono text-foreground">{document.assetTag}</span>
                    </p>
                  ) : null}
                </CardContent>
                <CardFooter className="justify-between gap-3 max-md:flex-col max-md:items-start">
                  <p className="text-sm text-muted-foreground">
                    Extracted
                    {" "}
                    {formatDateTime(document.extractedAt)}
                  </p>
                  <Link
                    className={cn(badgeVariants({ variant: "outline" }))}
                    href={`/documents/${document.hash}`}
                  >
                    Open provenance
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
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

function formatStatus(status: DocumentsCatalogData["documents"][number]["status"]) {
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

function getStatusBadgeVariant(status: DocumentsCatalogData["documents"][number]["status"]) {
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
