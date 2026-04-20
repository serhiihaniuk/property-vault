import type {
  DashboardMonthBreakdownData,
  DocumentsCatalogData,
  OpenAnomaliesData,
  YearlyReconciliationData,
} from "@/src/shared/api/client"
import type {
  Anomaly,
  CategoryBreakdown,
  DashboardSummary,
  DocumentListItem,
  MonthData,
  MonthlyTrendData,
  Period,
  ReconciliationCoverage,
  ReconciliationSummary,
  SourceDocument,
} from "@/src/shared/lib/dashboard-v0"

export type DashboardTimeRange = "6m" | "12m" | "24m" | "all"

export interface PrimarySummaryVM {
  currentMonthData: MonthData | null
  previousMonth: Period | null
  selectedMonth: Period | null
  summary: DashboardSummary | null
  unavailableReason: string | null
}

export interface AccountStatusVM {
  anomalies: Anomaly[]
  generatedAt: string | null
  reconciliationCoverage: ReconciliationCoverage | null
  reconciliationSummary: ReconciliationSummary | null
  unavailableReason: string | null
}

export interface MonthlyTrendVM {
  categories: CategoryBreakdown[]
  data: MonthlyTrendData[]
  rangeLabel: string
  unavailableReason: string | null
}

export interface CategoryBreakdownVM {
  categories: CategoryBreakdown[]
  categoryCount: number
  changedCategoryCount: number
  previousMonthValue: string | null
  selectedMonthValue: string | null
  unavailableReason: string | null
}

export interface OpenItemsVM {
  anomalies: Anomaly[]
  reconciliationSummary: ReconciliationSummary | null
  unavailableReason: string | null
}

export interface DocumentsTableVM {
  documents: DocumentListItem[]
  unavailableReason: string | null
}

export interface DashboardV0ViewModel {
  accountStatus: AccountStatusVM
  categoryBreakdown: CategoryBreakdownVM
  documentsTable: DocumentsTableVM
  generatedAt: string | null
  monthlyTrend: MonthlyTrendVM
  openItems: OpenItemsVM
  primarySummary: PrimarySummaryVM
  subtitle: string
}

export interface BuildDashboardV0ViewModelInput {
  anomalies: OpenAnomaliesData | undefined
  anomaliesError: string | null
  anomaliesLoading: boolean
  dashboard: DashboardMonthBreakdownData | undefined
  dashboardError: string | null
  dashboardLoading: boolean
  documents: DocumentsCatalogData | undefined
  documentsError: string | null
  documentsLoading: boolean
  historyError: string | null
  historyBreakdowns: DashboardMonthBreakdownData[]
  historyLoading: boolean
  historyRangeMonths: DashboardMonthBreakdownData["months"]
  reconciliation: YearlyReconciliationData | undefined
  reconciliationError: string | null
  reconciliationLoading: boolean
  timeRange: DashboardTimeRange
}

const TIME_RANGE_LIMITS: Record<Exclude<DashboardTimeRange, "all">, number> = {
  "12m": 12,
  "24m": 24,
  "6m": 6,
}

export function getHistoryMonthsForRange(
  months: DashboardMonthBreakdownData["months"],
  timeRange: DashboardTimeRange
) {
  if (timeRange === "all") {
    return months
  }

  return months.slice(0, TIME_RANGE_LIMITS[timeRange])
}

export function buildDashboardV0ViewModel({
  anomalies,
  anomaliesError,
  anomaliesLoading,
  dashboard,
  dashboardError,
  dashboardLoading,
  documents,
  documentsError,
  documentsLoading,
  historyError,
  historyBreakdowns,
  historyLoading,
  historyRangeMonths,
  reconciliation,
  reconciliationError,
  reconciliationLoading,
  timeRange,
}: BuildDashboardV0ViewModelInput): DashboardV0ViewModel {
  const normalizedAnomalies = (anomalies?.anomalies ?? []).map(mapAnomaly)
  const breakdownItems = dashboard?.breakdown ?? []
  const selectedMonth = mapPeriod(dashboard?.selectedMonth ?? null)
  const previousMonth = mapPeriod(dashboard?.previousMonth ?? null)
  const selectedMonthHistory = dashboard?.selectedMonth
    ? (dashboard.months.find(
        (month) => month.period.value === dashboard.selectedMonth?.value
      ) ?? null)
    : null

  const historyBreakdownMap = new Map<string, DashboardMonthBreakdownData>()

  if (dashboard?.selectedMonth?.value) {
    historyBreakdownMap.set(dashboard.selectedMonth.value, dashboard)
  }

  for (const monthBreakdown of historyBreakdowns) {
    if (monthBreakdown.selectedMonth?.value) {
      historyBreakdownMap.set(
        monthBreakdown.selectedMonth.value,
        monthBreakdown
      )
    }
  }

  const historyReady =
    historyRangeMonths.length > 0 &&
    historyRangeMonths.every((month) => {
      const periodValue = month.period.value

      if (!periodValue) {
        return false
      }

      return historyBreakdownMap.has(periodValue)
    })
  const selectedCategories = breakdownItems.map(mapSelectedCategoryBreakdown)
  const trendCategories =
    historyReady && !historyLoading
      ? buildTrendCategories(historyRangeMonths, historyBreakdownMap)
      : selectedCategories.map((category) => ({
          ...category,
          history: undefined,
        }))
  const monthlyTrendData =
    historyReady && !historyLoading
      ? buildMonthlyTrendData(historyRangeMonths, normalizedAnomalies)
      : []

  const primarySummaryUnavailableReason =
    resolvePrimarySummaryUnavailableReason({
      dashboard,
      dashboardError,
      dashboardLoading,
    })
  const anomalyUnavailableReason = resolveAnomalyUnavailableReason({
    anomalies,
    anomaliesError,
    anomaliesLoading,
  })
  const reconciliationUnavailableReason =
    resolveReconciliationUnavailableReason({
      reconciliation,
      reconciliationError,
      reconciliationLoading,
    })
  const historyUnavailableReason = resolveHistoryUnavailableReason({
    dashboardError,
    dashboardLoading,
    hasHistoryMonths: historyRangeMonths.length > 0,
    historyError,
    historyLoading,
    historyReady,
  })
  const documentsUnavailableReason = resolveDocumentsUnavailableReason({
    documents,
    documentsError,
    documentsLoading,
  })
  const mappedReconciliationCoverage = mapReconciliationCoverage(
    reconciliation?.coverage ?? null
  )
  const mappedReconciliationSummary = mapReconciliationSummary(
    reconciliation?.summary ?? null
  )
  const primarySummary: PrimarySummaryVM = {
    currentMonthData: selectedMonthHistory
      ? mapMonthData(selectedMonthHistory)
      : null,
    previousMonth,
    selectedMonth,
    summary: mapDashboardSummary(dashboard?.summary ?? null),
    unavailableReason: primarySummaryUnavailableReason,
  }

  return {
    accountStatus: {
      anomalies: normalizedAnomalies,
      generatedAt: pickLatestGeneratedAt([
        dashboard?.generatedAt,
        anomalies?.generatedAt,
        reconciliation?.generatedAt,
      ]),
      reconciliationCoverage: mappedReconciliationCoverage,
      reconciliationSummary: mappedReconciliationSummary,
      unavailableReason: mergeUnavailableReasons([
        anomalyUnavailableReason,
        reconciliationUnavailableReason,
      ]),
    },
    categoryBreakdown: {
      categories: trendCategories,
      categoryCount: dashboard?.summary?.categoryCount ?? breakdownItems.length,
      changedCategoryCount:
        dashboard?.summary?.changedCategoryCount ??
        breakdownItems.filter((item) => item.changeStatus !== "flat").length,
      previousMonthValue: dashboard?.previousMonth?.value ?? null,
      selectedMonthValue: dashboard?.selectedMonth?.value ?? null,
      unavailableReason: primarySummaryUnavailableReason,
    },
    documentsTable: {
      documents: buildDocumentTableDocuments({
        anomalies: normalizedAnomalies,
        dashboard,
        documents,
        reconciliation,
      }),
      unavailableReason: documentsUnavailableReason,
    },
    generatedAt: pickLatestGeneratedAt([
      dashboard?.generatedAt,
      anomalies?.generatedAt,
      reconciliation?.generatedAt,
      documents?.generatedAt,
    ]),
    monthlyTrend: {
      categories: trendCategories,
      data: monthlyTrendData,
      rangeLabel: buildTrendRangeLabel(timeRange),
      unavailableReason: historyUnavailableReason,
    },
    openItems: {
      anomalies: normalizedAnomalies,
      reconciliationSummary: mappedReconciliationSummary,
      unavailableReason: mergeUnavailableReasons([
        anomalyUnavailableReason,
        reconciliationUnavailableReason,
      ]),
    },
    primarySummary,
    subtitle: buildDashboardSubtitle({
      dashboard,
      dashboardError,
      dashboardLoading,
      selectedMonth,
    }),
  }
}

function resolveAnomalyUnavailableReason({
  anomalies,
  anomaliesError,
  anomaliesLoading,
}: {
  anomalies: OpenAnomaliesData | undefined
  anomaliesError: string | null
  anomaliesLoading: boolean
}) {
  if (anomaliesLoading) {
    return "Loading anomaly feed."
  }

  if (anomaliesError) {
    return anomaliesError
  }

  if (!anomalies) {
    return "Open anomalies are not available yet."
  }

  return null
}

function resolvePrimarySummaryUnavailableReason({
  dashboard,
  dashboardError,
  dashboardLoading,
}: {
  dashboard: DashboardMonthBreakdownData | undefined
  dashboardError: string | null
  dashboardLoading: boolean
}) {
  if (dashboardLoading) {
    return "Loading the latest dashboard month."
  }

  if (dashboardError) {
    return dashboardError
  }

  if (!dashboard?.summary || !dashboard.selectedMonth) {
    return "No monthly charge data is available yet."
  }

  return null
}

function mergeUnavailableReasons(reasons: Array<string | null>) {
  const present = Array.from(
    new Set(reasons.filter((reason): reason is string => Boolean(reason)))
  )

  if (present.length === 0) {
    return null
  }

  return present.join(" ")
}

function resolveReconciliationUnavailableReason({
  reconciliation,
  reconciliationError,
  reconciliationLoading,
}: {
  reconciliation: YearlyReconciliationData | undefined
  reconciliationError: string | null
  reconciliationLoading: boolean
}) {
  if (reconciliationLoading) {
    return "Loading yearly reconciliation."
  }

  if (reconciliationError) {
    return reconciliationError
  }

  if (!reconciliation?.summary || !reconciliation.selectedYear) {
    return "Yearly reconciliation is not available yet."
  }

  return null
}

function resolveHistoryUnavailableReason({
  dashboardError,
  dashboardLoading,
  hasHistoryMonths,
  historyError,
  historyLoading,
  historyReady,
}: {
  dashboardError: string | null
  dashboardLoading: boolean
  hasHistoryMonths: boolean
  historyError: string | null
  historyLoading: boolean
  historyReady: boolean
}) {
  if (dashboardLoading || historyLoading) {
    return "Loading monthly history."
  }

  if (dashboardError) {
    return dashboardError
  }

  if (historyError) {
    return historyError
  }

  if (!hasHistoryMonths) {
    return "Month history will appear after dashboard data is synced."
  }

  if (!historyReady) {
    return "Category history is not fully available for the selected range."
  }

  return null
}

function resolveDocumentsUnavailableReason({
  documents,
  documentsError,
  documentsLoading,
}: {
  documents: DocumentsCatalogData | undefined
  documentsError: string | null
  documentsLoading: boolean
}) {
  if (documentsLoading) {
    return "Loading indexed documents."
  }

  if (documentsError) {
    return documentsError
  }

  if (!documents || documents.documents.length === 0) {
    return "No indexed documents are available yet."
  }

  return null
}

function buildDashboardSubtitle({
  dashboard,
  dashboardError,
  dashboardLoading,
  selectedMonth,
}: {
  dashboard: DashboardMonthBreakdownData | undefined
  dashboardError: string | null
  dashboardLoading: boolean
  selectedMonth: Period | null
}) {
  if (dashboardLoading) {
    return "Live state · loading"
  }

  if (dashboardError) {
    return "Live state · unavailable"
  }

  if (!dashboard?.summary || !selectedMonth) {
    return "Latest state · no monthly charge data"
  }

  return `Latest state · ${selectedMonth.label}`
}

function buildTrendRangeLabel(timeRange: DashboardTimeRange) {
  if (timeRange === "all") {
    return "All recorded charges by category"
  }

  return `${timeRange.replace("m", "-month")} charges by category`
}

function mapDashboardSummary(
  summary: DashboardMonthBreakdownData["summary"]
): DashboardSummary | null {
  if (!summary) {
    return null
  }

  return {
    categoryCount: summary.categoryCount,
    changedCategoryCount: summary.changedCategoryCount,
    largestCategory: summary.largestCategory
      ? {
          amount: summary.largestCategory.amount,
          category: summary.largestCategory.category,
          categoryLabel: summary.largestCategory.categoryLabel,
        }
      : null,
    previousTotalCharges: summary.previousTotalCharges,
    topChange: summary.topChange
      ? {
          category: summary.topChange.category,
          categoryLabel: summary.topChange.categoryLabel,
          changeStatus:
            summary.topChange.changeStatus === "new" ||
            summary.topChange.changeStatus === "no_previous"
              ? "flat"
              : summary.topChange.changeStatus,
          delta: summary.topChange.delta,
        }
      : null,
    totalCharges: summary.totalCharges,
    totalDelta: summary.totalDelta,
  }
}

function mapMonthData(
  month: DashboardMonthBreakdownData["months"][number]
): MonthData {
  return {
    isCarriedForward: month.isCarriedForward,
    period: mapPeriod(month.period)!,
    sourceDocuments: month.sourceDocuments.map(mapSourceDocument),
    sourceMonth: mapPeriod(month.sourceMonth)!,
    totalCharges: month.totalCharges,
  }
}

function mapSelectedCategoryBreakdown(
  item: DashboardMonthBreakdownData["breakdown"][number]
): CategoryBreakdown {
  return {
    amount: item.amount,
    category: item.category,
    categoryGroup: item.categoryGroup ?? "other",
    categoryGroupLabel: item.categoryGroupLabel,
    categoryLabel: item.categoryLabel,
    changeStatus: item.changeStatus,
    delta: item.delta,
    previousAmount: item.previousAmount,
    sharePercent: item.sharePercent,
    sourceDocuments: item.sourceDocuments.map(mapSourceDocument),
  }
}

function buildTrendCategories(
  historyMonths: DashboardMonthBreakdownData["months"],
  historyBreakdownMap: Map<string, DashboardMonthBreakdownData>
) {
  const monthsOldestFirst = [...historyMonths].reverse()
  const selectedMonthValue = historyMonths[0]?.period.value
  const selectedBreakdown = selectedMonthValue
    ? (historyBreakdownMap.get(selectedMonthValue)?.breakdown ?? [])
    : []
  const selectedBreakdownMap = new Map(
    selectedBreakdown.map((item) => [item.category, item] as const)
  )
  const categories = new Map<
    string,
    {
      item: DashboardMonthBreakdownData["breakdown"][number]
      monthlyAmounts: Map<string, number>
    }
  >()

  for (const month of historyMonths) {
    if (!month.period.value) {
      continue
    }

    const breakdown =
      historyBreakdownMap.get(month.period.value)?.breakdown ?? []

    for (const item of breakdown) {
      const existing = categories.get(item.category)

      if (existing) {
        existing.monthlyAmounts.set(month.period.value, item.amount.amountMinor)
        continue
      }

      categories.set(item.category, {
        item,
        monthlyAmounts: new Map([
          [month.period.value, item.amount.amountMinor],
        ]),
      })
    }
  }

  return Array.from(categories.values())
    .map(({ item, monthlyAmounts }) => {
      const selectedItem = selectedBreakdownMap.get(item.category)
      const currency = selectedItem?.amount.currency ?? item.amount.currency

      return {
        amount: selectedItem?.amount ?? { amountMinor: 0, currency },
        category: item.category,
        categoryGroup: item.categoryGroup ?? "other",
        categoryGroupLabel: item.categoryGroupLabel,
        categoryLabel: item.categoryLabel,
        changeStatus: selectedItem?.changeStatus ?? "flat",
        delta: selectedItem?.delta ?? null,
        previousAmount: selectedItem?.previousAmount ?? null,
        sharePercent: selectedItem?.sharePercent ?? 0,
        sourceDocuments: (selectedItem?.sourceDocuments ?? []).map(
          mapSourceDocument
        ),
        history: monthsOldestFirst.map((month) => ({
          month: formatHistoryMonthLabel(month.period.label),
          value:
            ((month.period.value
              ? monthlyAmounts.get(month.period.value)
              : 0) ?? 0) / 100,
        })),
      }
    })
    .sort((left, right) => right.amount.amountMinor - left.amount.amountMinor)
}

function buildMonthlyTrendData(
  historyMonths: DashboardMonthBreakdownData["months"],
  anomalies: Anomaly[]
) {
  return [...historyMonths].reverse().map((month) => {
    const periodValue = month.period.value

    return {
      carriedForward: month.isCarriedForward,
      hasAnomaly: periodValue
        ? doesMonthHaveAnomaly(periodValue, anomalies)
        : false,
      month: month.period.label,
      total: month.totalCharges.amountMinor / 100,
    }
  })
}

function mapAnomaly(anomaly: OpenAnomaliesData["anomalies"][number]): Anomaly {
  return {
    context: anomaly.context,
    date: anomaly.date,
    detectedAt: anomaly.detectedAt,
    id: anomaly.id,
    ruleId: anomaly.ruleId,
    ruleLabel: anomaly.ruleLabel,
    severity: anomaly.severity,
    severityLabel: anomaly.severityLabel,
    status: anomaly.status,
    subjectDocument: mapOptionalSourceDocument(anomaly.subjectDocument),
    summary: anomaly.summary,
  }
}

function mapReconciliationCoverage(
  coverage: YearlyReconciliationData["coverage"] | null
): ReconciliationCoverage | null {
  if (!coverage) {
    return null
  }

  return {
    monthsCovered: coverage.monthsCovered,
    status: coverage.status === "full_year" ? "complete" : coverage.status,
    throughMonth: mapPeriod(coverage.throughMonth),
  }
}

function mapReconciliationSummary(
  summary: YearlyReconciliationData["summary"] | null
): ReconciliationSummary | null {
  if (!summary) {
    return null
  }

  return {
    actualCostTotal: summary.actualCostTotal,
    creditsTotal: summary.creditsTotal,
    netBalance: summary.netBalance,
    openLineCount: summary.openLineCount,
    scheduledTotal: summary.scheduledTotal,
    settledLineCount: summary.settledLineCount,
    settlementAdvanceTotal: summary.settlementAdvanceTotal,
  }
}

function buildDocumentTableDocuments({
  anomalies,
  dashboard,
  documents,
  reconciliation,
}: {
  anomalies: Anomaly[]
  dashboard: DashboardMonthBreakdownData | undefined
  documents: DocumentsCatalogData | undefined
  reconciliation: YearlyReconciliationData | undefined
}) {
  const catalogDocuments = (documents?.documents ?? []).map(mapCatalogDocument)
  const catalogByHash = new Map(
    catalogDocuments.map((document) => [document.hash, document] as const)
  )
  const selectedMonthHistory = dashboard?.selectedMonth
    ? (dashboard.months.find(
        (month) => month.period.value === dashboard.selectedMonth?.value
      ) ?? null)
    : null
  const relevantReferences = dedupeDocumentReferences([
    ...(selectedMonthHistory?.sourceDocuments ?? []).map(mapSourceDocument),
    ...(dashboard?.supportingDocuments ?? []).map(mapSourceDocument),
    ...(
      reconciliation?.lines.flatMap((line) => [
        ...line.scheduleDocuments,
        ...line.settlementDocuments,
      ]) ?? []
    ).map(mapSourceDocument),
    ...anomalies
      .map((anomaly) => anomaly.subjectDocument)
      .filter((document): document is SourceDocument => Boolean(document)),
  ])
  const relevantDocuments = relevantReferences.map((reference) => {
    const existing = catalogByHash.get(reference.hash)

    if (existing) {
      return existing
    }

    return createFallbackDocument(reference, dashboard?.generatedAt ?? null)
  })
  const remainingDocuments = catalogDocuments.filter(
    (document) =>
      !relevantDocuments.some((candidate) => candidate.hash === document.hash)
  )

  return [...relevantDocuments, ...remainingDocuments]
    .sort(compareDocumentsByRecency)
    .slice(0, 8)
}

function dedupeDocumentReferences(references: SourceDocument[]) {
  const unique = new Map<string, SourceDocument>()

  for (const reference of references) {
    if (!unique.has(reference.hash)) {
      unique.set(reference.hash, reference)
    }
  }

  return Array.from(unique.values())
}

function mapCatalogDocument(
  document: DocumentsCatalogData["documents"][number]
): DocumentListItem {
  const kind = normalizeDocumentKind(document.documentType)

  return {
    confidence: document.confidence,
    documentDate: document.documentDate,
    documentType: kind,
    documentTypeLabel: normalizeDocumentTypeLabel(kind),
    extractedAt: document.extractedAt,
    financialRowCount: document.financialRowCount,
    hash: document.hash,
    pageCount: document.pageCount,
    period: mapPeriod(document.period),
    sourceCount: document.sourceCount,
    status: mapDocumentStatus(document.status),
    summaryPlain: document.summaryPlain,
    title: document.title,
  }
}

function createFallbackDocument(
  document: SourceDocument,
  generatedAt: string | null
): DocumentListItem {
  const kind = normalizeDocumentKind(document.documentType)

  return {
    confidence: 0,
    documentDate: document.documentDate,
    documentType: kind,
    documentTypeLabel: normalizeDocumentTypeLabel(kind),
    extractedAt: generatedAt ?? "",
    financialRowCount: 0,
    hash: document.hash,
    pageCount: null,
    period: null,
    sourceCount: 1,
    status: "pending",
    summaryPlain:
      "Referenced by the live dashboard but not present in the document catalog response.",
    title: document.title,
  }
}

function compareDocumentsByRecency(
  left: DocumentListItem,
  right: DocumentListItem
) {
  const leftStamp = Date.parse(left.documentDate ?? left.extractedAt)
  const rightStamp = Date.parse(right.documentDate ?? right.extractedAt)

  if (Number.isFinite(leftStamp) && Number.isFinite(rightStamp)) {
    return rightStamp - leftStamp
  }

  if (Number.isFinite(leftStamp)) {
    return -1
  }

  if (Number.isFinite(rightStamp)) {
    return 1
  }

  return right.extractedAt.localeCompare(left.extractedAt)
}

function doesMonthHaveAnomaly(periodValue: string, anomalies: Anomaly[]) {
  return anomalies.some((anomaly) => {
    if (anomaly.date?.startsWith(periodValue)) {
      return true
    }

    if (anomaly.subjectDocument?.documentDate?.startsWith(periodValue)) {
      return true
    }

    return anomaly.context.some((field) => field.value === periodValue)
  })
}

function normalizeDocumentKind(
  documentType: string | null | undefined
): DocumentListItem["documentType"] {
  const normalized = documentType?.toLowerCase() ?? ""

  if (normalized.includes("settlement")) {
    return "settlement"
  }

  if (
    normalized.includes("resolution") ||
    normalized.includes("meeting") ||
    normalized.includes("notice")
  ) {
    return "resolution"
  }

  return "monthly_charge"
}

function normalizeDocumentTypeLabel(kind: DocumentListItem["documentType"]) {
  switch (kind) {
    case "resolution":
      return "Resolution"
    case "settlement":
      return "Settlement"
    default:
      return "Monthly charge"
  }
}

function mapDocumentStatus(
  status: DocumentsCatalogData["documents"][number]["status"]
): DocumentListItem["status"] {
  if (status === "failed" || status === "needs_review" || status === "ok") {
    return status
  }

  return "pending"
}

function mapOptionalSourceDocument(
  document:
    | OpenAnomaliesData["anomalies"][number]["subjectDocument"]
    | null
    | undefined
) {
  if (!document) {
    return null
  }

  return mapSourceDocument(document)
}

function mapSourceDocument(
  document:
    | DashboardMonthBreakdownData["supportingDocuments"][number]
    | YearlyReconciliationData["lines"][number]["scheduleDocuments"][number]
    | NonNullable<OpenAnomaliesData["anomalies"][number]["subjectDocument"]>
): SourceDocument {
  return {
    documentDate: document.documentDate ?? null,
    documentType: normalizeDocumentKind(document.documentType),
    hash: document.hash,
    title: document.title,
  }
}

function mapPeriod(
  period:
    | DashboardMonthBreakdownData["selectedMonth"]
    | DashboardMonthBreakdownData["months"][number]["period"]
    | YearlyReconciliationData["selectedYear"]
    | DocumentsCatalogData["documents"][number]["period"]
    | null
    | undefined
): Period | null {
  if (!period) {
    return null
  }

  const value = period.value ?? period.label

  if (!value) {
    return null
  }

  return {
    endDate: period.endDate ?? undefined,
    kind: period.kind === "quarter" ? "custom" : period.kind,
    label: period.label ?? value,
    startDate: period.startDate ?? undefined,
    value,
  }
}

function pickLatestGeneratedAt(values: Array<string | null | undefined>) {
  let latestValue: string | null = null
  let latestStamp = Number.NEGATIVE_INFINITY

  for (const value of values) {
    if (!value) {
      continue
    }

    const stamp = Date.parse(value)

    if (!Number.isFinite(stamp)) {
      continue
    }

    if (stamp > latestStamp) {
      latestStamp = stamp
      latestValue = value
    }
  }

  return latestValue
}

function formatHistoryMonthLabel(label: string) {
  return label.slice(0, 3)
}
