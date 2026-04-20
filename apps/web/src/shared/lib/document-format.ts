export type DocumentStatusTone = "danger" | "neutral" | "success" | "warning";

export function formatDocumentStatus(status: string) {
  switch (status) {
    case "failed":
      return "Failed";
    case "needs_review":
      return "Needs review";
    case "ok":
      return "OK";
    default:
      return status
        .split("_")
        .filter(Boolean)
        .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
        .join(" ");
  }
}

export function getDocumentStatusTone(status: string): DocumentStatusTone {
  switch (status) {
    case "failed":
      return "danger";
    case "needs_review":
      return "warning";
    case "ok":
      return "success";
    default:
      return "neutral";
  }
}

export function formatDocumentDate(
  value: string | null | undefined,
  fallback = "n/a",
) {
  if (!value) {
    return fallback;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

export function formatDocumentDateTime(
  value: string | null | undefined,
  fallback = "n/a",
) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatDocumentConfidence(confidence: number) {
  return `${Math.round(confidence * 100)}%`;
}

export function formatDocumentHash(
  hash: string,
  leading = 8,
  trailing = 4,
) {
  if (hash.length <= leading + trailing + 3) {
    return hash;
  }

  return `${hash.slice(0, leading)}...${hash.slice(-trailing)}`;
}

export function getDocumentPeriodLabel(
  period: { label: string } | null | undefined,
  fallback = "No normalized period",
) {
  return period?.label ?? fallback;
}
