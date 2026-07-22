export function formatProjectDate(value: string | null, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatProjectShortDate(value: string | null, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatProjectDateTime(value: string | null, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatProjectMonthYear(value: string | null, fallback = "-") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-PT", {
    month: "long",
    year: "numeric",
  });
}

export function formatElapsedSince(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const diffMs = Date.now() - date.getTime();
  if (diffMs <= 0) return "0 min";

  const minutes = Math.floor(diffMs / (60 * 1000));
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (days > 0) return `${days} dia${days === 1 ? "" : "s"}`;
  if (hours > 0) return `${hours} h`;
  return `${minutes} min`;
}

export function truncateProjectSummary(summary: string | null, maxChars = 280) {
  if (!summary) return "Sem resumo definido.";
  if (summary.length <= maxChars) return summary;
  return `${summary.slice(0, maxChars).trimEnd()}…`;
}
