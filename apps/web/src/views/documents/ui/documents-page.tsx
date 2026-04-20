"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { usePropertyVaultApiClient } from "@/src/shared/api/api-client-provider";
import { PropertyVaultApiError } from "@/src/shared/api/client";
import { formatDocumentDateTime } from "@/src/shared/lib/document-format";
import {
  Badge,
  LoadingInline,
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderHeading,
  PageHeaderTitle,
  StatusBadge,
} from "@/src/shared/ui";
import { DocumentsCatalogWidget } from "@/src/widgets/documents-catalog/ui/documents-catalog-widget";

export function DocumentsPage() {
  return (
    <Suspense fallback={<DocumentsPageFallback />}>
      <DocumentsPageContent />
    </Suspense>
  );
}

function DocumentsPageContent() {
  const apiClient = usePropertyVaultApiClient();
  const searchParams = useSearchParams();
  const requestedDocumentType = searchParams.get("type") ?? undefined;
  const documentsQuery = useQuery({
    queryKey: ["documents", "catalog", requestedDocumentType ?? "all"],
    queryFn: () =>
      requestedDocumentType
        ? apiClient.getDocuments({
            query: {
              documentType: requestedDocumentType,
            },
          })
        : apiClient.getDocuments(),
  });
  const errorMessage = getDocumentsErrorMessage(documentsQuery.error);
  const selectedType = documentsQuery.data?.availableTypes.find(
    (type) => type.documentType === documentsQuery.data?.selectedDocumentType,
  );
  const totalIndexed =
    documentsQuery.data?.availableTypes.reduce(
      (sum, item) => sum + item.count,
      0,
    ) ?? 0;
  const needsAttentionCount =
    documentsQuery.data?.documents.filter((document) => document.status !== "ok")
      .length ?? 0;

  return (
    <DocumentsPageScaffold
      actions={
        documentsQuery.isPending && !documentsQuery.data ? (
          <LoadingInline label="Loading evidence catalog" />
        ) : documentsQuery.data ? (
          <>
            <Badge variant="outline" className="font-mono">
              {totalIndexed} indexed
            </Badge>
            <Badge variant="secondary">{documentsQuery.data.documents.length} shown</Badge>
            <StatusBadge
              status={needsAttentionCount > 0 ? "warning" : "success"}
              dot
            >
              {needsAttentionCount > 0
                ? `${needsAttentionCount} need review`
                : "No review backlog"}
            </StatusBadge>
            {selectedType ? (
              <Badge variant="outline">{selectedType.label}</Badge>
            ) : null}
            <Badge variant="outline" className="font-mono">
              {formatDocumentDateTime(documentsQuery.data.generatedAt)}
            </Badge>
          </>
        ) : errorMessage ? (
          <StatusBadge status="danger" dot>
            Catalog unavailable
          </StatusBadge>
        ) : null
      }
      description={
        selectedType
          ? `Filtered to ${selectedType.label.toLowerCase()} documents with indexed extraction and provenance detail.`
          : "Audit-friendly catalog of indexed evidence, extraction state, and provenance-heavy drill-down."
      }
    >
      <DocumentsCatalogWidget
        data={documentsQuery.data}
        errorMessage={errorMessage}
        isLoading={documentsQuery.isPending}
      />
    </DocumentsPageScaffold>
  );
}

function getDocumentsErrorMessage(error: unknown): string | null {
  if (!error) {
    return null;
  }

  if (error instanceof PropertyVaultApiError) {
    return error.problem?.detail ?? error.problem?.title ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Document catalog could not be loaded.";
}

function DocumentsPageFallback() {
  return (
    <DocumentsPageScaffold
      actions={<LoadingInline label="Loading evidence catalog" />}
    >
      <DocumentsCatalogWidget isLoading />
    </DocumentsPageScaffold>
  );
}

function DocumentsPageScaffold({
  actions,
  children,
  description = "Audit-friendly catalog of indexed evidence, extraction state, and provenance-heavy drill-down.",
}: {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
}) {
  return (
    <div className="relative left-1/2 -my-6 min-h-svh w-screen -translate-x-1/2 overflow-x-clip bg-background">
      <div className="mx-auto max-w-[1600px] px-6 pb-12">
        <PageHeader className="border-b border-border-default pt-6 pb-6">
          <PageHeaderHeading>
            <PageHeaderEyebrow>Evidence catalog</PageHeaderEyebrow>
            <PageHeaderTitle>Documents</PageHeaderTitle>
            <PageHeaderDescription>{description}</PageHeaderDescription>
          </PageHeaderHeading>
          {actions ? <PageHeaderActions>{actions}</PageHeaderActions> : null}
        </PageHeader>

        <div className="pt-6">{children}</div>
      </div>
    </div>
  );
}
