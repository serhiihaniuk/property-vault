import type { DocumentDetailData } from "@/src/shared/api/client";
import {
  formatDocumentDateTime,
  getDocumentPeriodLabel,
} from "@/src/shared/lib/document-format";
import {
  Badge,
  EmptyState,
  ErrorState,
  KeyValueGrid,
  KeyValueRow,
  LoadingState,
  Money,
  ProvenanceBlock,
  ProvenanceHeader,
  ProvenanceItem,
  Surface,
  SurfaceActions,
  SurfaceBody,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
} from "@/src/shared/ui";

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
      <Surface density="comfortable" tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Provenance and evidence</SurfaceTitle>
            <SurfaceDescription>
              Loading source observations and normalized financial evidence.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <LoadingState label="Loading provenance and evidence" rows={8} />
        </SurfaceBody>
      </Surface>
    );
  }

  if (errorMessage) {
    return (
      <Surface density="comfortable" tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Provenance and evidence unavailable</SurfaceTitle>
            <SurfaceDescription>
              Source observations and financial rows could not be loaded.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <ErrorState title="Provenance unavailable" description={errorMessage} />
        </SurfaceBody>
      </Surface>
    );
  }

  if (!data) {
    return (
      <Surface density="comfortable" tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Provenance and evidence</SurfaceTitle>
            <SurfaceDescription>No provenance detail is available yet.</SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <EmptyState
            title="No provenance detail"
            description="Source observations and normalized financial rows appear here when available."
          />
        </SurfaceBody>
      </Surface>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)]">
      <Surface density="comfortable" tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Financial evidence</SurfaceTitle>
            <SurfaceDescription>
              Normalized monetary rows tied back to the document period, page, and
              supporting note where available.
            </SurfaceDescription>
          </SurfaceHeading>
          <SurfaceActions>
            <Badge variant="secondary">{data.financialRows.length} rows</Badge>
          </SurfaceActions>
        </SurfaceHeader>
        <SurfaceBody className="gap-3">
          {data.financialRows.length === 0 ? (
            <EmptyState
              title="No normalized financial rows"
              description="This document does not expose extracted financial evidence yet."
            />
          ) : (
            data.financialRows.map((row, index) => (
              <ProvenanceBlock key={`${row.rowType}:${row.category}:${index}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[13px] font-medium text-fg-primary">
                        {row.categoryLabel}
                      </h3>
                      <Badge variant="secondary">{row.rowTypeLabel}</Badge>
                      <Badge variant="outline">{row.categoryGroupLabel}</Badge>
                    </div>
                    <p className="text-[11.5px] text-fg-subtle">
                      {getDocumentPeriodLabel(row.period)}
                      {" / "}
                      {row.sourcePage ? `Page ${row.sourcePage}` : "Page n/a"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-right">
                    <Money
                      amountMinor={row.amount.amountMinor}
                      currency={row.amount.currency}
                      size="sm"
                    />
                    <span className="text-[11px] text-fg-subtle">
                      {row.unitPrice ? "Unit price captured" : "Unit price n/a"}
                    </span>
                  </div>
                </div>

                <KeyValueGrid className="gap-y-3 md:grid-cols-2" columns={2}>
                  <KeyValueRow
                    label="Quantity"
                    value={
                      row.quantity
                        ? `${row.quantity.value} ${row.quantity.unit}`
                        : "n/a"
                    }
                  />
                  <KeyValueRow
                    label="Unit price"
                    value={
                      row.unitPrice ? (
                        <Money
                          amountMinor={row.unitPrice.amountMinor}
                          currency={row.unitPrice.currency}
                          size="sm"
                        />
                      ) : (
                        "n/a"
                      )
                    }
                  />
                  <KeyValueRow label="Category key" value={row.category} />
                  <KeyValueRow
                    label="Source page"
                    value={row.sourcePage ? `Page ${row.sourcePage}` : "n/a"}
                  />
                </KeyValueGrid>

                {row.note ? (
                  <div className="rounded-md border border-border-default bg-surface-elevated/60 px-3 py-2 text-[12.5px] text-fg-secondary">
                    {row.note}
                  </div>
                ) : null}
              </ProvenanceBlock>
            ))
          )}
        </SurfaceBody>
      </Surface>

      <Surface density="comfortable" tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Source observations</SurfaceTitle>
            <SurfaceDescription>
              Where the canonical document was first seen before normalization into
              the app index.
            </SurfaceDescription>
          </SurfaceHeading>
          <SurfaceActions>
            <Badge variant="outline">{data.sourceObservations.length} sources</Badge>
          </SurfaceActions>
        </SurfaceHeader>
        <SurfaceBody className="gap-3">
          {data.sourceObservations.length === 0 ? (
            <EmptyState
              title="No source observations"
              description="The app has not stored any upstream sightings for this document yet."
            />
          ) : (
            data.sourceObservations.map((source, index) => (
              <ProvenanceBlock key={`${source.sourceKind}:${source.seenAt}:${index}`}>
                <ProvenanceHeader
                  hint={formatDocumentDateTime(source.seenAt)}
                  label={source.sourceKindLabel}
                />
                <div className="flex flex-col gap-2">
                  <p className="min-w-0 break-all font-mono text-[12px] text-fg-primary">
                    {source.originalFilename ?? "Original filename unavailable"}
                  </p>
                  {source.reference.length === 0 ? (
                    <p className="text-[12px] text-fg-subtle">
                      No structured source fields were stored for this observation.
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {source.reference.map((field) => (
                        <ProvenanceItem
                          key={`${field.label}:${field.value}`}
                          label={field.label}
                          value={field.value}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </ProvenanceBlock>
            ))
          )}
        </SurfaceBody>
      </Surface>
    </div>
  );
}
