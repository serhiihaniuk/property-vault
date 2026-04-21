import { ExternalLink, FileText } from "lucide-react"

import {
  type DashboardSurfaceStateKind,
  type DocumentListItem,
} from "@/src/shared/lib/dashboard-v0"
import { cn } from "@/src/shared/lib/utils"
import { Badge, StateSurface } from "@/src/shared/ui"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/shared/ui/table"

interface DashboardDocumentsTableWidgetProps {
  documents: DocumentListItem[]
  state: DashboardSurfaceStateKind
  unavailableReason?: string | null
}

function DocumentTypeBadge({
  type,
}: {
  type: DocumentListItem["documentType"]
}) {
  const colors: Record<DocumentListItem["documentType"], string> = {
    monthly_charge: "text-blue-400 border-blue-400/30",
    resolution: "text-purple-400 border-purple-400/30",
    settlement: "text-emerald-400 border-emerald-400/30",
  }

  const labels: Record<DocumentListItem["documentType"], string> = {
    monthly_charge: "zawiadomienie",
    resolution: "uchwała",
    settlement: "rozliczenie",
  }

  return (
    <Badge
      className={cn("text-xs font-normal", colors[type])}
      variant="outline"
    >
      {labels[type]}
    </Badge>
  )
}

function ExtractionStatusBadge({
  confidence,
  status,
}: {
  confidence: number
  status: DocumentListItem["status"]
}) {
  const config: Record<
    DocumentListItem["status"],
    { color: string; dot: string }
  > = {
    failed: { color: "text-rose-400", dot: "bg-rose-400" },
    needs_review: { color: "text-amber-400", dot: "bg-amber-400" },
    ok: { color: "text-emerald-400", dot: "bg-emerald-400" },
    pending: { color: "text-amber-400", dot: "bg-amber-400" },
  }

  const state = config[status] ?? {
    color: "text-muted-foreground",
    dot: "bg-muted-foreground",
  }

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", state.color)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", state.dot)} />
      {status === "ok"
        ? `extracted - ${confidence.toFixed(2)}`
        : status.replace("_", " ")}
    </div>
  )
}

export function DashboardDocumentsTableWidget({
  documents,
  state,
  unavailableReason,
}: DashboardDocumentsTableWidgetProps) {
  if (state === "loading") {
    return (
      <StateSurface
        description="Loading recent evidence and supporting source records tied to the live dashboard state."
        label="Loading recent source documents"
        rows={6}
        title="Recent source documents"
        variant="loading"
      />
    )
  }

  if (state === "error") {
    return (
      <StateSurface
        description="Supporting documents for the live dashboard state could not be loaded."
        stateDescription={unavailableReason ?? undefined}
        stateTitle="Recent source documents unavailable"
        title="Recent source documents unavailable"
        variant="error"
      />
    )
  }

  if (state === "empty") {
    return (
      <StateSurface
        description="Recent evidence records appear here once the relevant catalog data is available."
        icon={FileText}
        stateDescription={
          unavailableReason ??
          "Index documents to surface the evidence supporting the live dashboard state."
        }
        stateTitle="No recent source documents"
        title="Recent source documents"
        variant="empty"
      />
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium">Recent source documents</h3>
        {unavailableReason ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {unavailableReason}
          </p>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-normal text-muted-foreground">
              Title
            </TableHead>
            <TableHead className="text-xs font-normal text-muted-foreground">
              Type
            </TableHead>
            <TableHead className="text-xs font-normal text-muted-foreground">
              Date
            </TableHead>
            <TableHead className="text-xs font-normal text-muted-foreground">
              Hash
            </TableHead>
            <TableHead className="text-xs font-normal text-muted-foreground">
              Status
            </TableHead>
            <TableHead className="text-xs font-normal text-muted-foreground">
              Period
            </TableHead>
            <TableHead className="w-8 text-xs font-normal text-muted-foreground" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => (
            <TableRow className="group cursor-pointer" key={document.hash}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{document.title}</span>
                </div>
              </TableCell>
              <TableCell>
                <DocumentTypeBadge type={document.documentType} />
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {document.documentDate ?? "-"}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {document.hash}
              </TableCell>
              <TableCell>
                <ExtractionStatusBadge
                  confidence={document.confidence}
                  status={document.status}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {document.period?.label ?? "-"}
              </TableCell>
              <TableCell>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
