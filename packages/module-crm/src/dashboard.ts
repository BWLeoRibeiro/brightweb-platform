import type {
  DashboardCrmData,
  DashboardCrmRecentChange,
  DashboardCrmRecentContact,
} from "@brightweblabs/app-shell";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCrmContactStatusStats,
  listCrmContacts,
  listCrmStatusTimeline,
  type CrmContact,
  type CrmContactStatusStats,
  type CrmStatusLog,
} from "./data";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const RECENT_CONTACT_LIMIT = 12;
const RECENT_CHANGE_LIMIT = 12;

type CountQueryResult = {
  count: number | null;
  error: { message: string } | null;
};

export type CrmDashboardSnapshot = {
  generatedAt: string;
  stats: CrmContactStatusStats;
  contacts: CrmContact[];
  recentChanges: CrmStatusLog[];
  newLast7Days: number;
  newLast30Days: number;
  newLastYear: number;
  unassignedContacts: number;
};

async function resolveCount(query: PromiseLike<CountQueryResult>) {
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function contactName(contact: Pick<CrmContact, "first_name" | "last_name" | "email">) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim()
    || contact.email
    || "Contacto";
}

function toRecentContact(contact: CrmContact): DashboardCrmRecentContact {
  return {
    id: contact.id,
    name: contactName(contact),
    company: contact.organizations?.name ?? null,
    status: contact.status,
    lastChangedAt: contact.updated_at,
  };
}

function toRecentChange(change: CrmStatusLog): DashboardCrmRecentChange {
  return {
    id: change.id,
    contactId: change.contact_id,
    contactLabel: change.contact_label,
    previousStatus: change.previous_status,
    newStatus: change.new_status,
    changedAt: change.changed_at,
  };
}

export function buildCrmDashboardOverviewData(snapshot: CrmDashboardSnapshot): DashboardCrmData {
  return {
    generatedAt: snapshot.generatedAt,
    kpis: {
      crmTotalContacts: snapshot.stats.total,
      crmNewLast7Days: snapshot.newLast7Days,
      crmNewLast30Days: snapshot.newLast30Days,
      crmNewLastYear: snapshot.newLastYear,
      crmUnassignedContacts: snapshot.unassignedContacts,
    },
    crm: {
      statusBreakdown: {
        lead: snapshot.stats.byStatus.lead ?? 0,
        qualified: snapshot.stats.byStatus.qualified ?? 0,
        proposal: snapshot.stats.byStatus.proposal ?? 0,
        won: snapshot.stats.byStatus.won ?? 0,
        lost: snapshot.stats.byStatus.lost ?? 0,
      },
      recentChanges: snapshot.recentChanges.map(toRecentChange),
      recentContacts: snapshot.contacts.map(toRecentContact),
    },
  };
}

export async function getCrmDashboardOverviewData(
  supabase: SupabaseClient,
  now = new Date(),
): Promise<DashboardCrmData> {
  const since = (days: number) => new Date(now.getTime() - days * DAY_IN_MS).toISOString();

  const [stats, contacts, recentChanges, newLast7Days, newLast30Days, newLastYear, unassignedContacts] =
    await Promise.all([
      getCrmContactStatusStats(supabase),
      listCrmContacts(supabase, { page: 1, pageSize: RECENT_CONTACT_LIMIT, sort: "date_desc" }),
      listCrmStatusTimeline(supabase, { since: since(365), limit: RECENT_CHANGE_LIMIT }),
      resolveCount(
        supabase
          .from("crm_contacts")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since(7)),
      ),
      resolveCount(
        supabase
          .from("crm_contacts")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since(30)),
      ),
      resolveCount(
        supabase
          .from("crm_contacts")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since(365)),
      ),
      resolveCount(
        supabase
          .from("crm_contacts")
          .select("id", { count: "exact", head: true })
          .is("owner_id", null),
      ),
    ]);

  return buildCrmDashboardOverviewData({
    generatedAt: now.toISOString(),
    stats,
    contacts: contacts.items,
    recentChanges,
    newLast7Days,
    newLast30Days,
    newLastYear,
    unassignedContacts,
  });
}
