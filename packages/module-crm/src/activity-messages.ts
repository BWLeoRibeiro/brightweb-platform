/**
 * CRM activity → written message. Each event reads as a sentence: actor first,
 * then verb, entity and the concrete change, e.g. "Leonel Ribeiro moveu o
 * contacto Ana Silva de Novo para Qualificado".
 *
 * Every human-readable string is supplied by a {@link CrmActivityDictionary} so
 * each app chooses its own language; `ptCrmActivityDictionary` ships as the
 * default. Pairs with `@brightweblabs/ui`'s `ActivityMessage` renderer.
 */

import type { MsgSeg } from "@brightweblabs/ui/activity-format";

export type CrmActivityMessageItem = {
  eventType: string;
  summary: string;
  payload?: Record<string, unknown>;
};

export type CrmActivityDictionary = {
  systemActor: string;
  systemActorSubject: string;
  connectors: { from: string; to: string };
  /** Fallback nouns when the subject name is unknown. */
  nouns: { contact: string; organization: string };
  /** Plural noun used in "{n} contactos" bulk messages. */
  contactsWord: string;
  verbs: {
    contactCreated: string;
    contactCreatedStatusPrefix: string;
    contactMoved: string;
    contactUpdated: string;
    contactsUpdated: string;
    contactDeleted: string;
    contactsDeleted: string;
    organizationCreated: string;
    organizationUpdated: string;
    organizationDeleted: string;
    organizationMemberUpdated: string;
    organizationMemberRemoved: string;
  };
  statusLabels: Record<string, string>;
  fieldLabels: Record<string, string>;
  summaries?: {
    loadFailed: string;
    contactCreated: string;
    contactUpdated: string;
    contactStatusChanged: string;
    contactDeleted: string;
  };
};

export const ptCrmActivityDictionary: CrmActivityDictionary = {
  systemActor: "Sistema",
  systemActorSubject: "O sistema",
  connectors: { from: " de ", to: " para " },
  nouns: { contact: "um contacto", organization: "uma organização" },
  contactsWord: "contactos",
  verbs: {
    contactCreated: " adicionou o contacto ",
    contactCreatedStatusPrefix: " como ",
    contactMoved: " moveu o contacto ",
    contactUpdated: " atualizou o contacto ",
    contactsUpdated: " atualizou ",
    contactDeleted: " eliminou o contacto ",
    contactsDeleted: " eliminou ",
    organizationCreated: " criou a organização ",
    organizationUpdated: " atualizou a organização ",
    organizationDeleted: " eliminou a organização ",
    organizationMemberUpdated: " atualizou a função de um membro na organização",
    organizationMemberRemoved: " removeu um membro da organização",
  },
  statusLabels: {
    lead: "Novo",
    qualified: "Qualificado",
    proposal: "Proposta",
    won: "Ganho",
    lost: "Perdido",
  },
  fieldLabels: {
    first_name: "Nome",
    last_name: "Apelido",
    email: "Email",
    phone: "Telefone",
    source: "Origem",
    organization_id: "Organização",
    owner_id: "Responsável",
    status: "Estado",
  },
  summaries: {
    loadFailed: "Não foi possível carregar dados CRM.",
    contactCreated: "Contacto CRM criado.",
    contactUpdated: "Contacto CRM atualizado.",
    contactStatusChanged: "Estado de contacto CRM alterado.",
    contactDeleted: "Contacto CRM eliminado.",
  },
};

function str(payload: Record<string, unknown> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function changeOf(payload: Record<string, unknown> | undefined, field: string): { from: string | null; to: string | null } | null {
  const changes = payload?.changes;
  if (!changes || typeof changes !== "object") return null;
  const entry = (changes as Record<string, unknown>)[field];
  if (!entry || typeof entry !== "object") return null;
  const { from, to } = entry as Record<string, unknown>;
  return {
    from: typeof from === "string" && from.trim() ? from.trim() : null,
    to: typeof to === "string" && to.trim() ? to.trim() : null,
  };
}

function actorSeg(actorName: string, dict: CrmActivityDictionary): MsgSeg {
  return { b: actorName === dict.systemActor ? dict.systemActorSubject : actorName };
}

function crmCount(payload: Record<string, unknown> | undefined): number {
  if (typeof payload?.contact_count === "number") return payload.contact_count;
  return Array.isArray(payload?.contact_ids) ? (payload?.contact_ids as unknown[]).length : 0;
}

export function composeCrmMessage(
  item: CrmActivityMessageItem,
  actorName: string,
  dict: CrmActivityDictionary = ptCrmActivityDictionary,
): MsgSeg[] {
  const p = item.payload;
  const c = dict.connectors;
  const v = dict.verbs;
  const actor = actorSeg(actorName, dict);
  const statusLabel = (value: string | null): string | null => (value ? dict.statusLabels[value] ?? value : null);
  const contact = str(p, "contact_name");
  const namedContact = (): MsgSeg[] => (contact ? [{ b: contact }] : [dict.nouns.contact]);
  const namedOrg = (): MsgSeg[] => {
    const name = str(p, "name");
    return name ? [{ b: name }] : [dict.nouns.organization];
  };

  switch (item.eventType) {
    case "crm_contact_created": {
      const status = statusLabel(str(p, "status"));
      const lead: MsgSeg[] = [actor, v.contactCreated, ...namedContact()];
      return status ? [...lead, v.contactCreatedStatusPrefix, { v: status }] : lead;
    }
    case "crm_contact_status_changed": {
      const change = changeOf(p, "status");
      const fromL = statusLabel(change?.from ?? null);
      const toL = statusLabel(change?.to ?? null);
      const lead: MsgSeg[] = [actor, v.contactMoved, ...namedContact()];
      if (fromL && toL) return [...lead, c.from, { v: fromL }, c.to, { v: toL }];
      if (toL) return [...lead, c.to, { v: toL }];
      return lead;
    }
    case "crm_contact_updated": {
      const labels = Array.isArray(p?.fields)
        ? (p?.fields as unknown[])
            .filter((field): field is string => typeof field === "string")
            .map((field) => (dict.fieldLabels[field] ?? field).toLowerCase())
        : [];
      const detail: MsgSeg[] = labels.length > 0 ? [" (", labels.join(", "), ")"] : [];
      return [actor, v.contactUpdated, ...namedContact(), ...detail];
    }
    case "crm_contacts_updated":
      return [actor, v.contactsUpdated, { b: `${crmCount(p)} ${dict.contactsWord}` }];
    case "crm_contact_deleted":
      return [actor, v.contactDeleted, ...namedContact()];
    case "crm_contacts_deleted":
      return [actor, v.contactsDeleted, { b: `${crmCount(p)} ${dict.contactsWord}` }];

    case "crm_organization_created":
      return [actor, v.organizationCreated, ...namedOrg()];
    case "crm_organization_updated":
      return [actor, v.organizationUpdated, ...namedOrg()];
    case "crm_organization_deleted":
      return [actor, v.organizationDeleted, ...namedOrg()];
    case "crm_organization_member_updated":
      return [actor, v.organizationMemberUpdated];
    case "crm_organization_member_removed":
      return [actor, v.organizationMemberRemoved];

    default:
      return [actor, ` ${item.summary}`];
  }
}
