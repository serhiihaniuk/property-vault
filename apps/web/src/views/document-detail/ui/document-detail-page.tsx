"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { usePropertyVaultApiClient } from "@/src/shared/api/api-client-provider";
import { PropertyVaultApiError } from "@/src/shared/api/client";
import { badgeVariants } from "@/src/shared/ui/badge";
import { cn } from "@/src/shared/lib/utils";
import { DocumentProvenanceWidget } from "@/src/widgets/document-provenance/ui/document-provenance-widget";
import { DocumentRecordWidget } from "@/src/widgets/document-record/ui/document-record-widget";

export function DocumentDetailPage() {
  const params = useParams<{ hash?: string | string[] }>();
  const hash = Array.isArray(params.hash) ? params.hash[0] : params.hash;
  const apiClient = usePropertyVaultApiClient();
  const detailQuery = useQuery({
    enabled: typeof hash === "string" && hash.length > 0,
    queryKey: ["documents", "detail", hash ?? "missing"],
    queryFn: () => apiClient.getDocumentDetail({ pathParams: { hash: hash ?? "" } }),
  });
  const errorMessage = getDocumentDetailErrorMessage(detailQuery.error, hash);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link className={cn(badgeVariants({ variant: "outline" }))} href="/documents">
          Back to documents
        </Link>
        {hash ? (
          <span className={cn(badgeVariants({ variant: "ghost" }), "font-mono")}>
            {hash.slice(0, 12)}
          </span>
        ) : null}
      </div>
      <DocumentRecordWidget
        data={detailQuery.data}
        errorMessage={errorMessage}
        isLoading={detailQuery.isPending}
      />
      <DocumentProvenanceWidget
        data={detailQuery.data}
        errorMessage={errorMessage}
        isLoading={detailQuery.isPending}
      />
    </div>
  );
}

function getDocumentDetailErrorMessage(error: unknown, hash: string | undefined): string | null {
  if (!hash) {
    return "The requested document hash is missing from the route.";
  }

  if (!error) {
    return null;
  }

  if (error instanceof PropertyVaultApiError) {
    return error.problem?.detail ?? error.problem?.title ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Document detail could not be loaded.";
}
