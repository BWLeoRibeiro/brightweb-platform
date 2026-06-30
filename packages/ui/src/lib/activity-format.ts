/**
 * Framework-free formatting primitives shared by every activity / timeline
 * surface (notifications bell, project "recent activity" rail, CRM timeline).
 *
 * These are language-neutral: all human-readable strings (field labels, the
 * system fallback, boolean words, the date locale) are injected by the caller
 * so each app/module supplies its own dictionary. Imports nothing from React —
 * safe to use in server and client code alike.
 */

/** A rendered message is plain text + emphasised names ({ b }) + emphasised values ({ v }). */
export type MsgSeg = string | { b: string } | { v: string };

/** One field-level change, ready to render as "Label: from → to". */
export type ActivityChange = { key: string; label: string; from: string | null; to: string | null };

export type ActivityValueOptions = {
  /** Intl locale used to format ISO dates. Defaults to "en". */
  locale?: string;
  /** Label for a boolean `true` value. Defaults to "Yes". */
  trueLabel?: string;
  /** Label for a boolean `false` value. Defaults to "No". */
  falseLabel?: string;
};

export type ActivityChangesOptions = ActivityValueOptions & {
  /** Map of payload field name → human label. Unmapped fields fall back to the raw key. */
  fieldLabels?: Record<string, string>;
  /** Field names whose values are people — an empty one reads as the system, not a blank. */
  personFields?: Iterable<string>;
  /** Label used when a person field is explicitly empty. Defaults to "System". */
  systemLabel?: string;
};

function looksLikeId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value);
}

function isEmpty(value: unknown) {
  return value === null || value === undefined || value === "";
}

/** Render a stored change value into something readable, or null when it can't be shown plainly. */
export function formatActivityValue(value: unknown, options: ActivityValueOptions = {}): string | null {
  const { locale = "en", trueLabel = "Yes", falseLabel = "No" } = options;
  if (isEmpty(value)) return null;
  if (typeof value === "boolean") return value ? trueLabel : falseLabel;
  if (typeof value === "number") return String(value);
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  // Profile / entity references come through as raw UUIDs — not worth showing.
  if (looksLikeId(trimmed)) return null;

  // ISO date / datetime → short localised form.
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
    }
  }

  return trimmed.length > 32 ? `${trimmed.slice(0, 31)}…` : trimmed;
}

/** Pull the `payload.changes` map ({ field: { from, to } }) into a flat, display-ready list. */
export function toActivityChanges(
  payload: Record<string, unknown> | undefined,
  options: ActivityChangesOptions = {},
): ActivityChange[] {
  const { fieldLabels = {}, systemLabel = "System" } = options;
  const personFields = new Set(options.personFields ?? []);
  const changesRaw = payload?.changes;
  if (!changesRaw || typeof changesRaw !== "object" || Array.isArray(changesRaw)) return [];

  return Object.entries(changesRaw as Record<string, unknown>).flatMap(([field, raw]) => {
    if (!raw || typeof raw !== "object") return [];
    const { from, to } = raw as { from?: unknown; to?: unknown };
    const isPerson = personFields.has(field);
    // People always read as someone: an explicitly empty assignee/owner is the
    // system. An unresolved id (formats to null) is left blank rather than
    // wrongly attributed to the system.
    const resolve = (value: unknown) => {
      const formatted = formatActivityValue(value, options);
      if (formatted) return formatted;
      return isPerson && isEmpty(value) ? systemLabel : null;
    };
    return [{
      key: field,
      label: fieldLabels[field] ?? field,
      from: resolve(from),
      to: resolve(to),
    }];
  });
}
