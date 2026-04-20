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
  documentDate: string | null
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
  previousAmount: Amount | null
  delta: Amount | null
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
  previousTotalCharges: Amount | null
  totalDelta: Amount | null
  largestCategory: {
    category: string
    categoryLabel: string
    amount: Amount
  } | null
  topChange: {
    category: string
    categoryLabel: string
    changeStatus: "up" | "down" | "flat"
    delta: Amount
  } | null
}

export interface Anomaly {
  id: number
  ruleId: string
  ruleLabel: string
  severity: "critical" | "warning" | "info"
  severityLabel: string
  status: "open" | "resolved" | "dismissed"
  detectedAt: string
  date: string | null
  summary: string
  context: { label: string; value: string }[]
  subjectDocument?: SourceDocument | null
}

export interface ReconciliationCoverage {
  monthsCovered: number
  status: "year_to_date" | "complete" | "partial"
  throughMonth: Period | null
}

export interface ReconciliationSummary {
  scheduledTotal: Amount
  settlementAdvanceTotal: Amount | null
  actualCostTotal: Amount | null
  creditsTotal: Amount | null
  netBalance: Amount | null
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
  documentDate: string | null
  extractedAt: string
  confidence: number
  financialRowCount: number
  pageCount: number | null
  sourceCount: number
  status: "ok" | "needs_review" | "pending" | "failed"
  summaryPlain: string
  period: Period | null
}

export function formatAmountShort(amount: Amount): number {
  return amount.amountMinor / 100
}

export function extractTime(value: string | null): string {
  if (!value) {
    return "unknown"
  }

  if (!value.includes("T")) {
    return value
  }

  return value.split("T")[1]?.slice(0, 5) ?? value
}
