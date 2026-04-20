export interface Amount {
  amountMinor: number
  currency: string
}

export interface Period {
  kind: "month" | "year" | "custom"
  label: string
  value: string
  startDate?: string
  endDate?: string
}

export interface SourceDocument {
  hash: string
  title: string
  documentType: "monthly_charge" | "settlement" | "resolution"
  documentDate: string
}

export interface CategoryHistoryPoint {
  month: string
  value: number
}

export interface CategoryBreakdown {
  category: string
  categoryLabel: string
  categoryGroup: string
  categoryGroupLabel: string
  amount: Amount
  previousAmount: Amount
  delta: Amount
  changeStatus: "up" | "down" | "flat" | "new" | "no_previous"
  sharePercent: number
  sourceDocuments: SourceDocument[]
  history?: CategoryHistoryPoint[]
}

export interface MonthData {
  isCarriedForward: boolean
  period: Period
  sourceMonth: Period
  totalCharges: Amount
  sourceDocuments: SourceDocument[]
}

export interface DashboardSummary {
  categoryCount: number
  changedCategoryCount: number
  totalCharges: Amount
  previousTotalCharges: Amount
  totalDelta: Amount
  largestCategory: {
    category: string
    categoryLabel: string
    amount: Amount
  }
  topChange: {
    category: string
    categoryLabel: string
    changeStatus: "up" | "down" | "flat"
    delta: Amount
  }
}

export interface Anomaly {
  id: number
  ruleId: string
  ruleLabel: string
  severity: "critical" | "warning" | "info"
  severityLabel: string
  status: "open" | "resolved" | "dismissed"
  detectedAt: string
  date: string
  summary: string
  context: { label: string; value: string }[]
  subjectDocument?: SourceDocument
}

export interface ReconciliationCoverage {
  monthsCovered: number
  status: "year_to_date" | "complete" | "partial"
  throughMonth: Period
}

export interface ReconciliationSummary {
  scheduledTotal: Amount
  settlementAdvanceTotal: Amount
  actualCostTotal: Amount
  creditsTotal: Amount
  netBalance: Amount
  openLineCount: number
  settledLineCount: number
}

export interface MonthlyTrendData {
  month: string
  total: number
  carriedForward: boolean
  hasAnomaly: boolean
}

export interface DocumentListItem {
  hash: string
  title: string
  documentType: "monthly_charge" | "settlement" | "resolution"
  documentTypeLabel: string
  documentDate: string
  extractedAt: string
  confidence: number
  financialRowCount: number
  pageCount: number
  sourceCount: number
  status: "ok" | "needs_review" | "pending" | "failed"
  summaryPlain: string
  period: Period | null
}

export function formatAmountShort(amount: Amount): number {
  return amount.amountMinor / 100
}

export function extractTime(value: string): string {
  if (!value.includes("T")) {
    return value
  }

  return value.split("T")[1]?.slice(0, 5) ?? value
}
