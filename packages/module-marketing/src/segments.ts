type QueryClient = {
  from: (table: string) => any;
};

/**
 * Saved audience rules are ANDed across fields. `topicIds` uses ANY semantics:
 * a contact matches when subscribed to at least one selected topic.
 */
export type MarketingSegmentRule = {
  topicIds?: string[];
  preferredLanguage?: string;
  createdAfter?: string;
  createdBefore?: string;
  engagedWithinDays?: number;
  engagementType?: "opened" | "clicked";
  excludeSuppressed?: boolean;
};

export type MarketingSegment = {
  id: string;
  name: string;
  description: string | null;
  rule: MarketingSegmentRule;
  createdByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MarketingSegmentListParams = { page?: number; pageSize?: number; search?: string };
export type MarketingSegmentListResult = {
  items: MarketingSegment[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type SegmentContact = {
  id: string;
  email: string;
  name: string;
};

export type CreateSegmentInput = {
  name: string;
  description?: string | null;
  rule?: MarketingSegmentRule;
  createdByProfileId?: string | null;
};

export type UpdateSegmentInput = Partial<
  Omit<CreateSegmentInput, "createdByProfileId">
>;

type SegmentRow = {
  id: string;
  name: string;
  description: string | null;
  rule_json: MarketingSegmentRule | null;
  created_by_profile_id: string | null;
  created_at: string;
  updated_at: string;
};

type ContactRow = {
  id: string;
  email: string | null;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  created_at: string;
};

const SEGMENT_COLUMNS =
  "id,name,description,rule_json,created_by_profile_id,created_at,updated_at";
const CONTACT_COLUMNS =
  "id,email,first_name,last_name,created_at";
const DEFAULT_RESOLVE_LIMIT = 1_000;
const QUERY_PAGE_SIZE = 1_000;

function db(supabase: unknown) {
  return supabase as QueryClient;
}

function throwIfError(error: { message?: string } | null | undefined) {
  if (error) throw new Error(error.message || "Marketing segment request failed.");
}

async function collectPages<T>(createQuery: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += QUERY_PAGE_SIZE) {
    const result = await createQuery().range(start, start + QUERY_PAGE_SIZE - 1);
    throwIfError(result.error);
    const page = (result.data ?? []) as T[];
    rows.push(...page);
    if (page.length < QUERY_PAGE_SIZE) return rows;
  }
}

function fromRow(row: SegmentRow): MarketingSegment {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    rule: row.rule_json ?? {},
    createdByProfileId: row.created_by_profile_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeLimit(limit?: number) {
  if (limit == null) return DEFAULT_RESOLVE_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Segment limit must be a positive integer.");
  }
  return limit;
}

function validateRule(rule: MarketingSegmentRule) {
  if (
    rule.engagedWithinDays !== undefined
    && (
      !Number.isInteger(rule.engagedWithinDays)
      || rule.engagedWithinDays < 1
      || rule.engagedWithinDays > 3650
    )
  ) {
    throw new Error("Segment engagement window must be between 1 and 3650 days.");
  }
  for (const value of [rule.createdAfter, rule.createdBefore]) {
    if (value !== undefined && !Number.isFinite(new Date(value).getTime())) {
      throw new Error("Segment contact date must be valid.");
    }
  }
  if (
    rule.createdAfter
    && rule.createdBefore
    && new Date(rule.createdAfter) > new Date(rule.createdBefore)
  ) {
    throw new Error("Segment created-after date must precede created-before date.");
  }
  if (
    rule.engagementType !== undefined
    && rule.engagementType !== "opened"
    && rule.engagementType !== "clicked"
  ) {
    throw new Error("Segment engagement type must be opened or clicked.");
  }
}

function payloadFromInput(input: CreateSegmentInput | UpdateSegmentInput) {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.description !== undefined) {
    payload.description = input.description?.trim() || null;
  }
  if (input.rule !== undefined) {
    validateRule(input.rule);
    payload.rule_json = input.rule;
  }
  if ("createdByProfileId" in input && input.createdByProfileId !== undefined) {
    payload.created_by_profile_id = input.createdByProfileId;
  }
  return payload;
}

function contactName(contact: ContactRow) {
  if (contact.name?.trim()) return contact.name.trim();
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
}

export async function listSegments(supabase: unknown): Promise<MarketingSegment[]> {
  const { data, error } = await db(supabase)
    .from("marketing_segments")
    .select(SEGMENT_COLUMNS)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return ((data ?? []) as SegmentRow[]).map(fromRow);
}

export async function querySegments(
  supabase: unknown,
  params: MarketingSegmentListParams = {},
): Promise<MarketingSegmentListResult> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)));
  const from = (page - 1) * pageSize;
  let query = db(supabase)
    .from("marketing_segments")
    .select(SEGMENT_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  const search = params.search?.trim().toLowerCase().replace(/[%_,()\"]/g, "");
  if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  const { data, error, count } = await query;
  throwIfError(error);
  const total = count ?? 0;
  return {
    items: ((data ?? []) as SegmentRow[]).map(fromRow),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getSegment(
  supabase: unknown,
  id: string,
): Promise<MarketingSegment | null> {
  const { data, error } = await db(supabase)
    .from("marketing_segments")
    .select(SEGMENT_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return data ? fromRow(data as SegmentRow) : null;
}

export async function createSegment(
  supabase: unknown,
  input: CreateSegmentInput,
): Promise<MarketingSegment> {
  if (!input.name?.trim()) throw new Error("Segment name is required.");
  const { data, error } = await db(supabase)
    .from("marketing_segments")
    .insert(payloadFromInput({ ...input, rule: input.rule ?? {} }))
    .select(SEGMENT_COLUMNS)
    .single();
  throwIfError(error);
  return fromRow(data as SegmentRow);
}

export async function updateSegment(
  supabase: unknown,
  id: string,
  input: UpdateSegmentInput,
): Promise<MarketingSegment> {
  if (input.name !== undefined && !input.name.trim()) {
    throw new Error("Segment name is required.");
  }
  const { data, error } = await db(supabase)
    .from("marketing_segments")
    .update(payloadFromInput(input))
    .eq("id", id)
    .select(SEGMENT_COLUMNS)
    .single();
  throwIfError(error);
  if (!data) throw new Error("Segment not found.");
  return fromRow(data as SegmentRow);
}

export async function deleteSegment(supabase: unknown, id: string): Promise<void> {
  const { error } = await db(supabase)
    .from("marketing_segments")
    .delete()
    .eq("id", id);
  throwIfError(error);
}

async function ruleFromInput(
  supabase: unknown,
  ruleOrSegmentId: MarketingSegmentRule | string,
) {
  if (typeof ruleOrSegmentId !== "string") return ruleOrSegmentId;
  const segment = await getSegment(supabase, ruleOrSegmentId);
  if (!segment) throw new Error("Segment not found.");
  return segment.rule;
}

async function matchingTopicContactIds(
  supabase: unknown,
  topicIds: string[],
) {
  if (topicIds.length === 0) return null;
  const data = await collectPages<{ contact_id: string }>(() => db(supabase)
    .from("marketing_subscriptions")
    .select("contact_id")
    .eq("status", "subscribed")
    .in("topic_id", topicIds)
    .order("contact_id", { ascending: true }));
  return new Set(
    data.map((row) => row.contact_id),
  );
}

async function engagedContactIds(
  supabase: unknown,
  days?: number,
  type?: "opened" | "clicked",
) {
  if (days === undefined) return null;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const data = await collectPages<{ contact_id: string }>(() => {
    let query = db(supabase)
      .from("marketing_message_events")
      .select("contact_id")
      .gte("occurred_at", since)
      .not("contact_id", "is", null)
      .order("contact_id", { ascending: true });
    if (type) query = query.eq("event_type", type);
    return query;
  });
  return new Set(
    data.map((row) => row.contact_id),
  );
}

async function preferredLanguageContactIds(
  supabase: unknown,
  preferredLanguage?: string,
) {
  if (!preferredLanguage) return null;
  const data = await collectPages<{ contact_id: string }>(() => db(supabase)
    .from("marketing_contact_settings")
    .select("contact_id")
    .eq("preferred_language", preferredLanguage)
    .order("contact_id", { ascending: true }));
  return new Set(
    data.map((row) => row.contact_id),
  );
}

async function suppressedEmails(supabase: unknown, exclude: boolean) {
  if (!exclude) return null;
  const data = await collectPages<{ email: string }>(() => db(supabase)
    .from("marketing_suppressions")
    .select("email")
    .order("email", { ascending: true }));
  return new Set(
    data.map((row) =>
      row.email.trim().toLowerCase()
    ),
  );
}

export async function resolveSegmentContacts(
  supabase: unknown,
  ruleOrSegmentId: MarketingSegmentRule | string,
  options: { limit?: number; all?: boolean } = {},
): Promise<SegmentContact[]> {
  const rule = await ruleFromInput(supabase, ruleOrSegmentId);
  validateRule(rule);
  const limit = options.all ? Number.POSITIVE_INFINITY : normalizeLimit(options.limit);

  const contactQuery = () => {
    let query = db(supabase)
      .from("crm_contacts")
      .select(CONTACT_COLUMNS)
      .not("email", "is", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true });
    if (rule.createdAfter) query = query.gte("created_at", rule.createdAfter);
    if (rule.createdBefore) query = query.lte("created_at", rule.createdBefore);
    return query;
  };

  const [
    contacts,
    topicContactIds,
    engagementContactIds,
    languageContactIds,
    suppressed,
  ] = await Promise.all([
    collectPages<ContactRow>(contactQuery),
    matchingTopicContactIds(supabase, rule.topicIds ?? []),
    engagedContactIds(
      supabase,
      rule.engagedWithinDays,
      rule.engagementType,
    ),
    preferredLanguageContactIds(supabase, rule.preferredLanguage),
    suppressedEmails(supabase, rule.excludeSuppressed !== false),
  ]);

  const matches: SegmentContact[] = [];
  for (const contact of contacts) {
    const email = contact.email?.trim().toLowerCase();
    if (!email) continue;
    if (topicContactIds && !topicContactIds.has(contact.id)) continue;
    if (engagementContactIds && !engagementContactIds.has(contact.id)) continue;
    if (languageContactIds && !languageContactIds.has(contact.id)) continue;
    if (suppressed?.has(email)) continue;
    matches.push({ id: contact.id, email, name: contactName(contact) });
    if (matches.length >= limit) break;
  }
  return matches;
}

export async function previewSegment(
  supabase: unknown,
  rule: MarketingSegmentRule,
  options: { limit: number },
): Promise<{ count: number; sample: SegmentContact[] }> {
  const sampleLimit = normalizeLimit(options.limit);
  const matches = await resolveSegmentContacts(supabase, rule, {
    all: true,
  });
  return { count: matches.length, sample: matches.slice(0, sampleLimit) };
}
