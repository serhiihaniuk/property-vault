import type { DocumentDetailData } from "@/src/shared/api/client";
import { Badge } from "@/src/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/src/shared/ui/card";
import { Separator } from "@/src/shared/ui/separator";

export interface DocumentProvenanceWidgetProps {
  data?: DocumentDetailData;
  errorMessage?: string | null;
  isLoading: boolean;
}

export function DocumentProvenanceWidget({
  data,
  errorMessage,
  isLoading,
}: DocumentProvenanceWidgetProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Provenance</CardTitle>
          <CardDescription>
            Loading source observations and extracted financial evidence.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (errorMessage) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Provenance unavailable</CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Provenance</CardTitle>
          <CardDescription>No provenance detail is available yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Source observations</CardTitle>
          <CardDescription>
            Where this canonical document was first seen before it was normalized into
            the app index.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data.sourceObservations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No source observations were recorded for this document.
            </p>
          ) : (
            data.sourceObservations.map((source, index) => (
              <div key={`${source.sourceKind}:${source.seenAt}`} className="flex flex-col gap-3">
                {index > 0 ? <Separator /> : null}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{source.sourceKindLabel}</h2>
                      <Badge variant="outline">{formatDateTime(source.seenAt)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {source.originalFilename ?? "Original filename unavailable"}
                    </p>
                  </div>
                </div>
                {source.reference.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No structured source fields were stored for this observation.
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {source.reference.map((field) => (
                      <div
                        key={`${field.label}:${field.value}`}
                        className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/30 p-3"
                      >
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {field.label}
                        </p>
                        <p className="text-sm font-mono">{field.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Financial evidence</CardTitle>
          <CardDescription>
            Extracted financial rows tied back to the document and source page when available.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {data.financialRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No normalized financial rows were extracted from this document.
            </p>
          ) : (
            data.financialRows.map((row, index) => (
              <div key={`${row.rowType}:${row.category}:${index}`} className="flex flex-col gap-3">
                {index > 0 ? <Separator /> : null}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{row.categoryLabel}</h2>
                      <Badge variant="secondary">{row.rowTypeLabel}</Badge>
                      <Badge variant="outline">{row.categoryGroupLabel}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {row.period?.label ?? "No normalized period"}
                      {" • "}
                      {row.sourcePage ? `Page ${row.sourcePage}` : "No source page"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <p className="font-mono text-sm font-medium">
                      {formatMoney(row.amount.amountMinor)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.unitPrice
                        ? `${formatMoney(row.unitPrice.amountMinor)} unit price`
                        : "No unit price"}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <MetadataField
                    label="Quantity"
                    value={
                      row.quantity ? `${row.quantity.value} ${row.quantity.unit}` : "n/a"
                    }
                  />
                  <MetadataField
                    label="Original category key"
                    value={row.category}
                    mono
                  />
                </div>
                {row.note ? (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                    {row.note}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetadataField({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/30 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono text-sm" : "text-sm"}>{value}</p>
    </div>
  );
}

function formatMoney(amountMinor: number) {
  return new Intl.NumberFormat("pl-PL", {
    currency: "PLN",
    style: "currency",
  }).format(amountMinor / 100);
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
