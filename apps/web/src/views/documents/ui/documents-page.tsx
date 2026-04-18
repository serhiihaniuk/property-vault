"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { usePropertyVaultApiClient } from "@/src/shared/api/api-client-provider";
import { PropertyVaultApiError } from "@/src/shared/api/client";
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

  return (
    <DocumentsCatalogWidget
      data={documentsQuery.data}
      errorMessage={errorMessage}
      isLoading={documentsQuery.isPending}
    />
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
  return <DocumentsCatalogWidget isLoading />;
}
