import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@brightweblabs/infra/server";
import { ptCrmActivityDictionary } from "./activity-messages";
import { CRM_CONTACT_STATUSES, type CrmContact } from "./data";

export type CrmContactStatus = (typeof CRM_CONTACT_STATUSES)[number];

export type CreateCrmContactInput = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: CrmContactStatus;
  source?: string | null;
  organizationId?: string | null;
  ownerId?: string | null;
};

export type UpdateCrmContactInput = {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  organizationId?: string | null;
  ownerId?: string | null;
};

export type CrmWriteOptions = {
  actorProfileId?: string | null;
};

const CRM_CONTACT_SELECT =
  "id, first_name, last_name, email, phone, status, source, owner_id, organization_id, created_at, updated_at, organizations(name)";
const CRM_CONTACT_STATUS_SET = new Set<string>(CRM_CONTACT_STATUSES);

function normalizeOptionalString(value: string | null | undefined): string | null {
  return typeof value === "string" ? value.trim() || null : null;
}

function normalizeEmail(value: string | null | undefined): string | null {
  return normalizeOptionalString(value)?.toLowerCase() ?? null;
}

function normalizePhone(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;
  const digits = normalized.replace(/\D/g, "");
  if (/^\+\d{1,3}$/.test(normalized) && digits.length <= 3) return null;
  return normalized;
}

function assertContactId(contactId: string): string {
  const normalized = contactId.trim();
  if (!normalized) throw new Error("Contact ID is required.");
  return normalized;
}

function assertContactStatus(status: string): asserts status is CrmContactStatus {
  if (!CRM_CONTACT_STATUS_SET.has(status)) {
    throw new Error(`Invalid CRM status. Expected one of: ${CRM_CONTACT_STATUSES.join(", ")}.`);
  }
}

function assertValidEmail(email: string | null) {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new Error("Invalid email address.");
  }
}

function assertValidPhone(phone: string | null) {
  if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) {
    throw new Error("Invalid phone number. Include the country calling code.");
  }
}

function contactName(contact: Pick<CrmContact, "first_name" | "last_name" | "email">): string | null {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() || contact.email || null;
}

function crmWriteError(error: { code?: string; message: string }): Error {
  if (error.code === "23505" || /crm_contacts_email_unique|duplicate key.*email/i.test(error.message)) {
    return new Error("A CRM contact with this email already exists.");
  }
  return new Error(error.message);
}

async function logCrmActivity(input: {
  actorProfileId?: string | null;
  entityId: string;
  eventType: string;
  summary: string;
  payload: Record<string, unknown>;
}) {
  const serviceClient = createServiceRoleClient();
  if (!serviceClient) return;

  const { error } = await serviceClient.rpc("log_app_activity_event", {
    p_domain: "crm",
    p_event_type: input.eventType,
    p_entity_table: "crm_contacts",
    p_entity_id: input.entityId,
    p_summary: input.summary,
    p_payload: input.payload,
    p_actor_profile_id: input.actorProfileId ?? null,
  });

  if (error) {
    console.error("Error logging CRM activity event:", error);
  }
}

async function getCrmContactById(supabase: SupabaseClient, contactId: string): Promise<CrmContact> {
  const { data, error } = await supabase
    .from("crm_contacts")
    .select(CRM_CONTACT_SELECT)
    .eq("id", contactId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("CRM contact not found.");
  return data as unknown as CrmContact;
}

export async function createCrmContact(
  supabase: SupabaseClient,
  input: CreateCrmContactInput,
  options: CrmWriteOptions = {},
): Promise<CrmContact> {
  const firstName = normalizeOptionalString(input.firstName);
  const lastName = normalizeOptionalString(input.lastName);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const status = input.status ?? "lead";

  if (!firstName && !lastName && !email) {
    throw new Error("A first name, last name, or email is required.");
  }
  assertValidEmail(email);
  assertValidPhone(phone);
  assertContactStatus(status);

  const { data, error } = await supabase
    .from("crm_contacts")
    .insert({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      status,
      source: normalizeOptionalString(input.source) ?? "manual",
      organization_id: normalizeOptionalString(input.organizationId),
      owner_id: normalizeOptionalString(input.ownerId),
    })
    .select(CRM_CONTACT_SELECT)
    .single();

  if (error) throw crmWriteError(error);
  if (!data) throw new Error("CRM contact could not be created.");
  const contact = data as unknown as CrmContact;

  await logCrmActivity({
    actorProfileId: options.actorProfileId,
    entityId: contact.id,
    eventType: "crm_contact_created",
    summary: ptCrmActivityDictionary.summaries?.contactCreated ?? "crm_contact_created",
    payload: {
      contact_id: contact.id,
      contact_name: contactName(contact),
      organization_id: contact.organization_id,
      owner_id: contact.owner_id,
      status: contact.status,
    },
  });

  return contact;
}

export async function updateCrmContact(
  supabase: SupabaseClient,
  contactId: string,
  patch: UpdateCrmContactInput,
  options: CrmWriteOptions = {},
): Promise<CrmContact> {
  const id = assertContactId(contactId);
  const payload: Record<string, string | null> = {};

  if (Object.hasOwn(patch, "firstName")) payload.first_name = normalizeOptionalString(patch.firstName);
  if (Object.hasOwn(patch, "lastName")) payload.last_name = normalizeOptionalString(patch.lastName);
  if (Object.hasOwn(patch, "email")) {
    const email = normalizeEmail(patch.email);
    assertValidEmail(email);
    payload.email = email;
  }
  if (Object.hasOwn(patch, "phone")) {
    const phone = normalizePhone(patch.phone);
    assertValidPhone(phone);
    payload.phone = phone;
  }
  if (Object.hasOwn(patch, "source")) payload.source = normalizeOptionalString(patch.source);
  if (Object.hasOwn(patch, "organizationId")) payload.organization_id = normalizeOptionalString(patch.organizationId);
  if (Object.hasOwn(patch, "ownerId")) payload.owner_id = normalizeOptionalString(patch.ownerId);

  if (Object.keys(payload).length === 0) {
    throw new Error("At least one CRM contact field must be provided.");
  }

  const { data, error } = await supabase
    .from("crm_contacts")
    .update(payload)
    .eq("id", id)
    .select(CRM_CONTACT_SELECT)
    .single();

  if (error) throw crmWriteError(error);
  if (!data) throw new Error("CRM contact not found.");
  const contact = data as unknown as CrmContact;

  await logCrmActivity({
    actorProfileId: options.actorProfileId,
    entityId: contact.id,
    eventType: "crm_contact_updated",
    summary: ptCrmActivityDictionary.summaries?.contactUpdated ?? "crm_contact_updated",
    payload: {
      contact_id: contact.id,
      contact_name: contactName(contact),
      organization_id: contact.organization_id,
      owner_id: contact.owner_id,
      status: contact.status,
      fields: Object.keys(payload),
    },
  });

  return contact;
}

export async function setCrmContactStatus(
  supabase: SupabaseClient,
  contactId: string,
  status: CrmContactStatus,
  reason?: string | null,
  options: CrmWriteOptions = {},
): Promise<CrmContact> {
  const id = assertContactId(contactId);
  assertContactStatus(status);
  const normalizedReason = normalizeOptionalString(reason);
  const previous = await getCrmContactById(supabase, id);

  const { error } = await supabase.rpc("set_crm_status", {
    p_contact_id: id,
    p_new_status: status,
    p_reason: normalizedReason,
  });
  if (error) throw new Error(error.message);

  const contact = previous.status === status ? previous : await getCrmContactById(supabase, id);
  if (previous.status !== status) {
    await logCrmActivity({
      actorProfileId: options.actorProfileId,
      entityId: id,
      eventType: "crm_contact_status_changed",
      summary: ptCrmActivityDictionary.summaries?.contactStatusChanged ?? "crm_contact_status_changed",
      payload: {
        contact_id: id,
        contact_name: contactName(previous),
        reason: normalizedReason,
        changes: { status: { from: previous.status, to: status } },
      },
    });
  }

  return contact;
}

export async function bulkSetCrmContactStatus(
  supabase: SupabaseClient,
  contactIds: string[],
  status: CrmContactStatus,
  reason?: string | null,
  options: CrmWriteOptions = {},
): Promise<CrmContact[]> {
  const ids = Array.from(new Set(contactIds.map((id) => id.trim()).filter(Boolean)));
  if (ids.length === 0) throw new Error("At least one contact ID is required.");
  assertContactStatus(status);

  return Promise.all(ids.map((id) => setCrmContactStatus(supabase, id, status, reason, options)));
}

export async function deleteCrmContact(
  supabase: SupabaseClient,
  contactId: string,
  options: CrmWriteOptions = {},
): Promise<{ deletedId: string }> {
  const id = assertContactId(contactId);
  const contact = await getCrmContactById(supabase, id);
  const { error } = await supabase.from("crm_contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);

  await logCrmActivity({
    actorProfileId: options.actorProfileId,
    entityId: id,
    eventType: "crm_contact_deleted",
    summary: ptCrmActivityDictionary.summaries?.contactDeleted ?? "crm_contact_deleted",
    payload: {
      contact_ids: [id],
      contact_name: contactName(contact),
      contact_count: 1,
    },
  });

  return { deletedId: id };
}
