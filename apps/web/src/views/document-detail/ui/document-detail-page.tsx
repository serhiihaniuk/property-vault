"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { usePropertyVaultApiClient } from "@/src/shared/api/api-client-provider";
import { PropertyVaultApiError } from "@/src/shared/api/client";
import {
  formatDocumentDate,
  formatDocumentDateTime,
  formatDocumentStatus,
  getDocumentPeriodLabel,
  getDocumentStatusTone,
} from "@/src/shared/lib/document-format";
import { cn } from "@/src/shared/lib/utils";
import { buttonVariants } from "@/src/shared/ui/button";
import {
  Badge,
  HashChip,
  LoadingInline,
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderHeading,
  PageHeaderTitle,
  StatusBadge,
} from "@/src/shared/ui";
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
  const detailData = detailQuery.data;
  const document = detailData?.document;

  return (
    <div className="relative left-1/2 -my-6 min-h-svh w-screen -translate-x-1/2 overflow-x-clip bg-background">
      <div className="mx-auto max-w-[1600px] px-6 pb-12">
        <div className="border-b border-border-default pt-6 pb-6">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
              href="/documents"
            >
              Back to documents
            </Link>
            {hash ? <HashChip hash={hash} /> : null}
            {document ? (
              <StatusBadge status={getDocumentStatusTone(document.status)} dot>
                {formatDocumentStatus(document.status)}
              </StatusBadge>
            ) : null}
          </div>

          <PageHeader className="pt-4 pb-0">
            <PageHeaderHeading>
              <PageHeaderEyebrow>Document detail</PageHeaderEyebrow>
              <PageHeaderTitle>{document?.title ?? "Document detail"}</PageHeaderTitle>
              <PageHeaderDescription>
                {document?.summaryPlain ??
                  "Indexed metadata, extracted facts, and provenance grouped for audit-friendly review."}
              </PageHeaderDescription>
            </PageHeaderHeading>
            <PageHeaderActions>
              {detailQuery.isPending && !detailQuery.data ? (
                <LoadingInline label="Loading document trace" />
              ) : document && detailData ? (
                <>
                  <Badge variant="secondary">{document.documentTypeLabel}</Badge>
                  <Badge variant="outline">
                    {getDocumentPeriodLabel(document.period)}
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    {formatDocumentDate(document.documentDate)}
                  </Badge>
                  <Badge variant="outline" className="font-mono">
                    {formatDocumentDateTime(detailData.generatedAt)}
                  </Badge>
                </>
              ) : errorMessage ? (
                <StatusBadge status="danger" dot>
                  Detail unavailable
                </StatusBadge>
              ) : null}
            </PageHeaderActions>
          </PageHeader>
        </div>

        <div className="flex flex-col gap-4 pt-6">
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
      </div>
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
