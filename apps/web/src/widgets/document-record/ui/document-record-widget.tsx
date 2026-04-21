import type { DocumentDetailData } from "@/src/shared/api/client"
import {
  formatDocumentConfidence,
  formatDocumentDate,
  formatDocumentDateTime,
  getDocumentPeriodLabel,
} from "@/src/shared/lib/document-format"
import { cn } from "@/src/shared/lib/utils"
import {
  Badge,
  DenseCard,
  EmptyState,
  ErrorState,
  KeyValueGrid,
  KeyValueRow,
  LoadingState,
  MetricLabel,
  MetricValue,
  StatusBadge,
  Surface,
  SurfaceActions,
  SurfaceBody,
  SurfaceDescription,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
} from "@/src/shared/ui"

export interface DocumentRecordWidgetProps {
  data?: DocumentDetailData
  errorMessage?: string | null
  isLoading: boolean
}

export function DocumentRecordWidget({
  data,
  errorMessage,
  isLoading,
}: DocumentRecordWidgetProps) {
  const flagCount = data
    ? data.questionsForUser.length + data.warnings.length
    : 0

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
      <Surface density="comfortable" tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Extracted facts</SurfaceTitle>
            <SurfaceDescription>
              First-pass operator summary of normalized facts captured from this
              evidence record.
            </SurfaceDescription>
          </SurfaceHeading>
          {data ? (
            <SurfaceActions>
              <Badge variant="outline" className="font-mono">
                {data.keyFacts.length} facts
              </Badge>
            </SurfaceActions>
          ) : null}
        </SurfaceHeader>
        <SurfaceBody className="gap-4">
          {isLoading ? (
            <LoadingState
              label="Loading document record"
              rows={7}
              showHeader={false}
            />
          ) : errorMessage ? (
            <ErrorState
              title="Document detail unavailable"
              description={errorMessage}
            />
          ) : !data ? (
            <EmptyState
              title="No document record"
              description="Open a catalog entry to inspect extracted facts, metadata, and provenance."
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard
                  detail="Indexed extraction confidence"
                  label="Confidence"
                  value={formatDocumentConfidence(data.document.confidence)}
                />
                <SummaryCard
                  detail="Normalized monetary rows"
                  label="Financial rows"
                  value={String(data.financialRows.length)}
                />
                <SummaryCard
                  detail="Source sightings captured"
                  label="Source observations"
                  value={String(data.sourceObservations.length)}
                />
                <SummaryCard
                  detail="Questions plus warnings"
                  label="Flags"
                  tone={flagCount > 0 ? "warning" : "default"}
                  value={String(flagCount)}
                />
              </div>

              <Surface density="compact" tone="muted">
                <SurfaceHeader>
                  <SurfaceHeading>
                    <SurfaceTitle>Key facts</SurfaceTitle>
                    <SurfaceDescription>
                      Short extracted facts intended to speed up first review.
                    </SurfaceDescription>
                  </SurfaceHeading>
                </SurfaceHeader>
                <SurfaceBody>
                  {data.keyFacts.length === 0 ? (
                    <EmptyState
                      title="No extracted facts"
                      description="This record does not expose a short fact summary yet."
                    />
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {data.keyFacts.map((fact) => (
                        <DenseCard key={`${fact.label}:${fact.value}`} tone="muted">
                          <MetricLabel>{fact.label}</MetricLabel>
                          <p className="text-[13.5px] text-fg-primary">
                            {fact.value}
                          </p>
                        </DenseCard>
                      ))}
                    </div>
                  )}
                </SurfaceBody>
              </Surface>
            </>
          )}
        </SurfaceBody>
      </Surface>

      <div className="grid gap-4">
        <Surface density="comfortable" tone="default">
          <SurfaceHeader>
            <SurfaceHeading>
              <SurfaceTitle>Document metadata</SurfaceTitle>
              <SurfaceDescription>
                Stable metadata used to orient period, file characteristics, and
                supporting record context.
              </SurfaceDescription>
            </SurfaceHeading>
          </SurfaceHeader>
          <SurfaceBody>
            {isLoading ? (
              <LoadingState
                label="Loading document metadata"
                rows={6}
                showHeader={false}
              />
            ) : errorMessage ? (
              <ErrorState
                title="Document metadata unavailable"
                description={errorMessage}
              />
            ) : !data ? (
              <EmptyState
                title="No metadata yet"
                description="Select an indexed document to inspect its metadata."
              />
            ) : (
              <KeyValueGrid divider="dashed">
                <KeyValueRow
                  label="Document date"
                  value={formatDocumentDate(data.document.documentDate)}
                />
                <KeyValueRow
                  label="Reporting period"
                  value={getDocumentPeriodLabel(data.document.period)}
                />
                <KeyValueRow
                  label="Pages"
                  value={
                    data.document.pageCount
                      ? String(data.document.pageCount)
                      : "n/a"
                  }
                />
                <KeyValueRow label="MIME" value={data.document.mime} />
                <KeyValueRow
                  label="Asset tag"
                  value={data.document.assetTag ?? "n/a"}
                />
                <KeyValueRow
                  label="OCR"
                  value={data.document.needsOcr ? "Needed" : "Not needed"}
                />
                <KeyValueRow
                  label="Supporting note"
                  value={data.document.noteAvailable ? "Available" : "Missing"}
                />
              </KeyValueGrid>
            )}
          </SurfaceBody>
        </Surface>

        <Surface density="comfortable" tone="default">
          <SurfaceHeader>
            <SurfaceHeading>
              <SurfaceTitle>Extraction trace</SurfaceTitle>
              <SurfaceDescription>
                Traceability for when the record was ingested, extracted, and
                rendered in the app.
              </SurfaceDescription>
            </SurfaceHeading>
          </SurfaceHeader>
          <SurfaceBody>
            {isLoading ? (
              <LoadingState
                label="Loading extraction trace"
                rows={5}
                showHeader={false}
              />
            ) : errorMessage ? (
              <ErrorState
                title="Extraction trace unavailable"
                description={errorMessage}
              />
            ) : !data ? (
              <EmptyState
                title="No extraction trace"
                description="Select an indexed document to inspect ingestion and extraction timing."
              />
            ) : (
              <KeyValueGrid divider="dashed">
                <KeyValueRow
                  label="Ingested"
                  value={formatDocumentDateTime(data.document.ingestedAt)}
                />
                <KeyValueRow
                  label="Extracted"
                  value={formatDocumentDateTime(data.document.extractedAt)}
                />
                <KeyValueRow
                  label="Extracted by"
                  value={data.document.extractedBy}
                />
                <KeyValueRow
                  label="Extractor version"
                  value={data.document.extractorVersion}
                />
                <KeyValueRow
                  label="View generated"
                  value={formatDocumentDateTime(data.generatedAt)}
                />
              </KeyValueGrid>
            )}
          </SurfaceBody>
        </Surface>

        <MessageSurface
          description="Items that still need a human answer or a follow-up in the source evidence."
          emptyTitle="No open questions"
          errorMessage={errorMessage}
          isLoading={isLoading}
          items={data?.questionsForUser ?? []}
          title="Questions for user"
        />

        <MessageSurface
          description="Warnings recorded during extraction, review, or normalization."
          emptyTitle="No warnings"
          errorMessage={errorMessage}
          isLoading={isLoading}
          items={data?.warnings ?? []}
          title="Warnings"
          tone="warning"
        />
      </div>
    </div>
  )
}

function SummaryCard({
  detail,
  label,
  tone = "default",
  value,
}: {
  detail: string
  label: string
  tone?: "default" | "warning"
  value: string
}) {
  return (
    <DenseCard
      className={cn(
        tone === "warning" && "border-status-warning/25 bg-status-warning-bg/50"
      )}
      tone={tone === "default" ? "default" : "muted"}
    >
      <MetricLabel>{label}</MetricLabel>
      <MetricValue size="md">{value}</MetricValue>
      <span className="text-[11.5px] text-fg-subtle">{detail}</span>
    </DenseCard>
  )
}

function MessageSurface({
  description,
  emptyTitle,
  errorMessage,
  isLoading,
  items,
  title,
  tone = "neutral",
}: {
  description: string
  emptyTitle: string
  errorMessage?: string | null
  isLoading: boolean
  items: string[]
  title: string
  tone?: "neutral" | "warning"
}) {
  return (
    <Surface
      className={cn(
        tone === "warning" && "border-status-warning/25 bg-status-warning-bg/30"
      )}
      density="comfortable"
      tone={tone === "warning" ? "muted" : "default"}
    >
      <SurfaceHeader>
        <SurfaceHeading>
          <SurfaceTitle>{title}</SurfaceTitle>
          <SurfaceDescription>{description}</SurfaceDescription>
        </SurfaceHeading>
        <SurfaceActions>
          <StatusBadge status={tone === "warning" ? "warning" : "neutral"}>
            {items.length}
          </StatusBadge>
        </SurfaceActions>
      </SurfaceHeader>
      <SurfaceBody>
        {isLoading ? (
          <LoadingState
            label={`Loading ${title.toLowerCase()}`}
            rows={3}
            showHeader={false}
          />
        ) : errorMessage ? (
          <ErrorState
            title={`${title} unavailable`}
            description={errorMessage}
          />
        ) : items.length === 0 ? (
          <EmptyState title={emptyTitle} description={description} />
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <DenseCard key={item} tone="muted">
                <p className="text-[12.5px] text-fg-primary">{item}</p>
              </DenseCard>
            ))}
          </div>
        )}
      </SurfaceBody>
    </Surface>
  )
}
