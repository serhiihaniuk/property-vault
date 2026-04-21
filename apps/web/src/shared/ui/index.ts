/**
 * Shared UI barrel.
 *
 * Re-exports the design-system primitives so widgets and views can import
 * from a single entry point and stay aligned with the redesign tokens.
 */

export {
  AppShell,
  AppShellActions,
  AppShellBrand,
  AppShellHeader,
  AppShellMain,
} from "@/src/shared/ui/app-shell"
export {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from "@/src/shared/ui/alert"
export { Badge, badgeVariants } from "@/src/shared/ui/badge"
export { Button, buttonVariants } from "@/src/shared/ui/button"
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/shared/ui/card"
export {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  TableCaption,
  TableFooter,
} from "@/src/shared/ui/data-table"
export {
  DeltaValue,
  deltaVariants,
  type DeltaIntent,
} from "@/src/shared/ui/delta"
export { Input } from "@/src/shared/ui/input"
export {
  KeyValueGrid,
  KeyValueRow,
  kvGridVariants,
} from "@/src/shared/ui/key-value"
export { Label } from "@/src/shared/ui/label"
export {
  MetricLabel,
  MetricSub,
  MetricValue,
  Money,
  metricValueVariants,
} from "@/src/shared/ui/metric"
export {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderHeading,
  PageHeaderTitle,
} from "@/src/shared/ui/page-header"
export {
  DocumentChip,
  HashChip,
  ProvenanceBlock,
  ProvenanceHeader,
  ProvenanceItem,
} from "@/src/shared/ui/provenance"
export { Select } from "@/src/shared/ui/select"
export { Separator } from "@/src/shared/ui/separator"
export { Skeleton } from "@/src/shared/ui/skeleton"
export { Sparkline } from "@/src/shared/ui/sparkline"
export {
  EmptyState,
  ErrorState,
  LoadingInline,
  LoadingState,
} from "@/src/shared/ui/state-message"
export { StateSurface } from "@/src/shared/ui/state-surface"
export { StatusBadge, type StatusKind } from "@/src/shared/ui/status-badge"
export {
  DenseCard,
  Surface,
  SurfaceActions,
  SurfaceBody,
  SurfaceDescription,
  SurfaceDivider,
  SurfaceFooter,
  SurfaceHeader,
  SurfaceHeading,
  SurfaceTitle,
  surfaceVariants,
} from "@/src/shared/ui/surface"
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/shared/ui/table"
export { ThemeProvider } from "@/src/shared/ui/theme-provider"
