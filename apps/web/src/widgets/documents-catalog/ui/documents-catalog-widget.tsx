import Link from "next/link";
import { FileText } from "lucide-react";

import type { DocumentsCatalogData } from "@/src/shared/api/client";
import {
  formatDocumentConfidence,
  formatDocumentDate,
  formatDocumentDateTime,
  getDocumentPeriodLabel,
  getDocumentStatusTone,
  formatDocumentStatus,
} from "@/src/shared/lib/document-format";
import { cn } from "@/src/shared/lib/utils";
import {
  Badge,
  buttonVariants,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DenseCard,
  EmptyState,
  ErrorState,
  HashChip,
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
  TableRow,
} from "@/src/shared/ui";

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
      <Surface density="comfortable" tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Indexed catalog</SurfaceTitle>
            <SurfaceDescription>
              Loading indexed evidence records, extraction status, and available filters.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <LoadingState label="Loading document catalog" rows={8} />
        </SurfaceBody>
      </Surface>
    );
  }

  if (errorMessage) {
    return (
      <Surface density="comfortable" tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Indexed catalog unavailable</SurfaceTitle>
            <SurfaceDescription>
              The evidence catalog could not be loaded from the indexed app data.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <ErrorState
            title="Document catalog unavailable"
            description={errorMessage}
          />
        </SurfaceBody>
      </Surface>
    );
  }

  if (!data) {
    return (
      <Surface density="comfortable" tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Indexed catalog</SurfaceTitle>
            <SurfaceDescription>
              Document records appear here after canonical evidence is synced into
              Postgres.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          <EmptyState
            title="No indexed evidence yet"
            description="Sync the local evidence vault to populate the catalog, document detail, and provenance surfaces."
          />
        </SurfaceBody>
      </Surface>
    );
  }

  const totalIndexed = data.availableTypes.reduce((sum, item) => sum + item.count, 0);
  const needsAttentionCount = data.documents.filter((document) => document.status !== "ok")
    .length;

  return (
    <div className="flex flex-col gap-4">
      <Surface density="comfortable" tone="elevated">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Catalog overview</SurfaceTitle>
            <SurfaceDescription>
              Scannable evidence catalog with type filters, extraction state, and
              provenance-ready detail links.
            </SurfaceDescription>
          </SurfaceHeading>
          <SurfaceActions>
            <Badge variant="outline" className="font-mono">
              {formatDocumentDateTime(data.generatedAt)}
            </Badge>
          </SurfaceActions>
        </SurfaceHeader>
        <SurfaceBody className="gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <CatalogStatCard
              detail={`${data.availableTypes.length} indexed types`}
              label="Indexed records"
              value={String(totalIndexed)}
            />
            <CatalogStatCard
              detail={
                data.selectedDocumentType
                  ? "Filtered result set"
                  : "Current catalog view"
              }
              label="Shown"
              tone="info"
              value={String(data.documents.length)}
            />
            <CatalogStatCard
              detail={
                needsAttentionCount > 0
                  ? "Failed or needs review"
                  : "All visible records extracted cleanly"
              }
              label="Needs attention"
              tone={needsAttentionCount > 0 ? "warning" : "default"}
              value={String(needsAttentionCount)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterLink href="/documents" isSelected={!data.selectedDocumentType}>
              <span>All types</span>
              <span className="font-mono text-[11px] text-fg-subtle">{totalIndexed}</span>
            </FilterLink>
            {data.availableTypes.map((type) => {
              const isSelected = type.documentType === data.selectedDocumentType;

              return (
                <FilterLink
                  key={type.documentType}
                  href={`/documents?type=${encodeURIComponent(type.documentType)}`}
                  isSelected={isSelected}
                >
                  <span>{type.label}</span>
                  <span className="font-mono text-[11px] text-fg-subtle">{type.count}</span>
                </FilterLink>
              );
            })}
          </div>
        </SurfaceBody>
      </Surface>

      <Surface density="comfortable" tone="default">
        <SurfaceHeader>
          <SurfaceHeading>
            <SurfaceTitle>Indexed evidence table</SurfaceTitle>
            <SurfaceDescription>
              Dense review surface for document metadata, extracted coverage, and
              provenance drill-down.
            </SurfaceDescription>
          </SurfaceHeading>
        </SurfaceHeader>
        <SurfaceBody>
          {data.documents.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No matching documents"
              description={
                data.selectedDocumentType
                  ? "No indexed documents match the selected type yet."
                  : "No indexed documents are available yet."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <DataTable className="min-w-[1100px]">
                <DataTableHeader>
                  <TableRow>
                    <DataTableHead>Document</DataTableHead>
                    <DataTableHead>Period</DataTableHead>
                    <DataTableHead>Evidence</DataTableHead>
                    <DataTableHead>Extraction</DataTableHead>
                    <DataTableHead>Hash</DataTableHead>
                    <DataTableHead className="w-24 text-right">Detail</DataTableHead>
                  </TableRow>
                </DataTableHeader>
                <DataTableBody divider="dashed">
                  {data.documents.map((document) => (
                    <DataTableRow key={document.hash}>
                      <DataTableCell className="min-w-[320px]">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-col gap-1">
                              <Link
                                className="line-clamp-2 font-medium text-fg-primary transition-colors hover:text-fg-secondary"
                                href={`/documents/${document.hash}`}
                              >
                                {document.title}
                              </Link>
                              <p className="line-clamp-2 text-[11.5px] text-fg-subtle">
                                {document.summaryPlain}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{document.documentTypeLabel}</Badge>
                            {document.assetTag ? (
                              <Badge variant="outline" className="font-mono">
                                {document.assetTag}
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="min-w-[180px]">
                        <div className="flex flex-col gap-1 text-[11.5px]">
                          <span className="font-mono text-fg-primary">
                            {getDocumentPeriodLabel(document.period)}
                          </span>
                          <span className="text-fg-subtle">
                            Document date {formatDocumentDate(document.documentDate)}
                          </span>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="min-w-[170px]">
                        <div className="grid gap-1 text-[11.5px]">
                          <EvidenceLine label="Rows" value={String(document.financialRowCount)} />
                          <EvidenceLine label="Sources" value={String(document.sourceCount)} />
                          <EvidenceLine
                            label="Pages"
                            value={
                              document.pageCount ? String(document.pageCount) : "n/a"
                            }
                          />
                        </div>
                      </DataTableCell>
                      <DataTableCell className="min-w-[200px]">
                        <div className="flex flex-col gap-2">
                          <StatusBadge
                            status={getDocumentStatusTone(document.status)}
                            dot
                          >
                            {formatDocumentStatus(document.status)}
                          </StatusBadge>
                          <div className="grid gap-1 text-[11.5px]">
                            <EvidenceLine
                              label="Confidence"
                              value={formatDocumentConfidence(document.confidence)}
                            />
                            <EvidenceLine
                              label="Extracted"
                              value={formatDocumentDateTime(document.extractedAt)}
                            />
                          </div>
                        </div>
                      </DataTableCell>
                      <DataTableCell className="min-w-[140px]">
                        <HashChip hash={document.hash} />
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        <Link
                          className={cn(
                            buttonVariants({ size: "xs", variant: "ghost" }),
                            "ml-auto",
                          )}
                          href={`/documents/${document.hash}`}
                        >
                          Open
                        </Link>
                      </DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </div>
          )}
        </SurfaceBody>
      </Surface>
    </div>
  );
}

function CatalogStatCard({
  detail,
  label,
  tone = "default",
  value,
}: {
  detail: string;
  label: string;
  tone?: "default" | "info" | "warning";
  value: string;
}) {
  return (
    <DenseCard
      className={cn(
        tone === "info" && "border-status-info/25 bg-status-info-bg/50",
        tone === "warning" && "border-status-warning/25 bg-status-warning-bg/50",
      )}
      tone={tone === "default" ? "default" : "muted"}
    >
      <MetricLabel>{label}</MetricLabel>
      <MetricValue size="md">{value}</MetricValue>
      <span className="text-[11.5px] text-fg-subtle">{detail}</span>
    </DenseCard>
  );
}

function FilterLink({
  children,
  href,
  isSelected,
}: {
  children: React.ReactNode;
  href: string;
  isSelected: boolean;
}) {
  return (
    <Link
      className={cn(
        buttonVariants({
          size: "sm",
          variant: isSelected ? "secondary" : "outline",
        }),
        "h-7 gap-2 font-normal",
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

function EvidenceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-fg-subtle">{label}</span>
      <span className="font-mono tabular-nums text-fg-primary">{value}</span>
    </div>
  );
}
