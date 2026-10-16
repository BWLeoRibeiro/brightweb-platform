import type { SocialMediaPlan } from "./types";
import { safeSocialMediaHref } from "./model";

type Check = (value: unknown, path: string) => void;
function invalid(path: string, expectation: string): never {
  throw new Error(`Invalid social media plan at ${path}: ${expectation}.`);
}
const text: Check = (value, path) => { if (typeof value !== "string") invalid(path, "expected text"); };
const boolean: Check = (value, path) => { if (typeof value !== "boolean") invalid(path, "expected a boolean"); };
const optional = (check: Check): Check => (value, path) => { if (value !== undefined) check(value, path); };
const array = (check: Check): Check => (value, path) => {
  if (!Array.isArray(value)) invalid(path, "expected an array");
  value.forEach((item, index) => check(item, `${path}[${index}]`));
};
const object = (fields: Record<string, Check>): Check => (value, path) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(path, "expected an object");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some(key => !Object.hasOwn(fields, key))) invalid(path, "unexpected field");
  for (const [key, check] of Object.entries(fields)) check(record[key], `${path}.${key}`);
};
const textFields = (...keys: string[]) => Object.fromEntries(keys.map(key => [key, text]));
const copy = array(object({ text, emphasis: optional(boolean) }));
const heading = textFields("eyebrow", "title");
const date: Check = (value, path) => {
  text(value, path);
  const input = value as string;
  const parsed = new Date(`${input}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input) invalid(path, "expected a real date in YYYY-MM-DD format");
};
const href: Check = (value, path) => {
  text(value, path);
  if (!safeSocialMediaHref(value as string)) invalid(path, "expected an HTTP or HTTPS URL");
};
const dictionary = (check: Check, keyCheck?: Check): Check => (value, path) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(path, "expected an object");
  for (const [key, item] of Object.entries(value)) {
    keyCheck?.(key, `${path} key`);
    check(item, `${path} value`);
  }
};
const choice = (...options: string[]): Check => (value, path) => {
  if (typeof value !== "string" || !options.includes(value)) invalid(path, "unsupported option");
};
const schema = object({
  title: text, period: text,
  sections: array(object({ id: text, title: text })),
  types: dictionary(object({ label: text, medium: choice("social", "website"), tone: optional(choice("primary", "success", "warning", "info", "special")) })), holidays: optional(dictionary(text, date)),
  events: array(object({
    ...textFields("id", "type", "title", "channels", "format", "summary", "interaction", "cta", "baseText", "service", "editorialNote"), date,
    references: array((value, path) => {
      if (!Array.isArray(value) || value.length !== 2) invalid(path, "expected a label and URL pair");
      text(value[0], `${path}[0]`); href(value[1], `${path}[1]`);
    }),
  })),
  positioning: optional(object({
    eyebrow: optional(text), headline: text, statement: text,
    principles: array(object(textFields("title", "description"))),
    rhythm: optional(array(object({ ...textFields("label", "description"), icon: optional(text) }))),
  })),
  editorial: optional(object({
    ...heading, titleAccent: optional(text), introduction: text,
    sequence: optional(object({
      ...heading, introduction: text,
      steps: array(object(textFields("label", "title", "description"))),
      definition: optional(object({ title: text, description: text, points: array(copy) })),
    })),
    distribution: optional(object({
      ...heading, introduction: copy,
      channels: array(object({ ...textFields("priority", "name", "description"), icon: optional(text), points: array(text) })),
    })),
    production: optional(object({
      ...heading, formats: array(object({ label: text, title: text, description: copy })),
      example: optional(object({ title: text, description: copy })),
    })),
  })),
  campaigns: optional(object({
    ...heading, introduction: text,
    launch: optional(object(textFields("date", "title", "description"))),
    items: array(object({ period: text, title: text, description: copy, points: array(text) })),
  })),
  measurement: optional(object({
    ...textFields("period", "title", "introduction", "routine"),
    deliverables: array(object(textFields("value", "label", "description"))),
    baseline: optional(object({ ...textFields("value", "label", "date", "description"), ariaLabel: optional(text) })),
    signalsIntroduction: optional(text),
    signals: array(object({ ...textFields("title", "question", "interpretation"), indicators: array(text), icon: optional(text) })),
    decisions: array(object({ ...textFields("when", "title", "description"), outcome: optional(text) })),
    references: optional(object({
      title: text, description: optional(text), note: optional(text),
      columns: object(textFields("name", "value", "interpretation", "source")),
      rows: array(object({ ...textFields("name", "value", "interpretation"), context: optional(text), source: object({ label: text, href }) })),
    })),
  })),
});

/** Validate website-owned JSON before it reaches the shared viewer. Errors omit content values. */
export function parseSocialMediaPlan(value: unknown): SocialMediaPlan {
  schema(value, "plan");
  const plan = value as SocialMediaPlan;
  const sections = new Set<string>();
  const contentKeys = { plano: "editorial", campanhas: "campaigns", metricas: "measurement" } as const;
  for (const section of plan.sections) {
    if (sections.has(section.id)) invalid("plan.sections", "duplicate section ID");
    if (section.id !== "calendario" && section.id !== "decisao" && !Object.hasOwn(contentKeys, section.id)) invalid("plan.sections", "unsupported section ID");
    sections.add(section.id);
  }
  if (!sections.has("calendario")) invalid("plan.sections", "calendar section is required");
  for (const [id, key] of Object.entries(contentKeys)) {
    if (sections.has(id) !== (plan[key as keyof typeof plan] !== undefined)) invalid(`plan.${key}`, "section and content must be provided together");
  }
  if (sections.has("decisao") && !plan.positioning) invalid("plan.positioning", "positioning section requires content");
  if (plan.positioning && !sections.has("decisao") && !plan.editorial) invalid("plan.positioning", "positioning requires an editorial or positioning section");
  if (Object.hasOwn(plan.types, "all")) invalid("plan.types", "all is reserved for the filter");
  const ids = new Set<string>();
  for (const event of plan.events) {
    if (!event.id.trim() || ids.has(event.id)) invalid("plan.events", "publication IDs must be nonempty and unique");
    ids.add(event.id);
    if (!Object.hasOwn(plan.types, event.type)) invalid("plan.events", "publication type is not configured");
  }
  return plan;
}
