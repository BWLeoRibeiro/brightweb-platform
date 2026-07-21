import type { ReactNode } from "react";

import type {
  CrmContact,
  CrmContactStatusStats,
  CrmContactsListParams,
  CrmContactsListResult,
  CrmOwnerOption,
  CrmStatusLog,
} from "../data";
import type { CrmContactStatus, CreateCrmContactInput, UpdateCrmContactInput } from "../server";
import type { CrmActivityDictionary } from "../activity-messages";

export type CrmStageConfig = {
  value: CrmContactStatus;
  label: string;
  token: `--${string}`;
};

export type CrmTableColumnKey = "name" | "email" | "organization" | "owner" | "status" | "updated";

export type CrmTableColumnRenderContext = {
  owner?: CrmOwnerOption;
  stage?: CrmStageConfig;
  dictionary: CrmUiDictionary;
};

export type CrmTableColumnConfig = {
  key: CrmTableColumnKey;
  label?: string;
  hidden?: boolean;
  render?: (contact: CrmContact, context: CrmTableColumnRenderContext) => ReactNode;
};

export type CrmContactFormInput = CreateCrmContactInput & UpdateCrmContactInput & {
  status: CrmContactStatus;
};

export type CrmUiDictionary = {
  locale: string;
  dashboard: {
    title: string;
    subtitle: string;
    addContact: string;
    loadError: string;
  };
  stats: {
    title: string;
    total: string;
    loading: string;
  };
  table: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    selectAll: string;
    selectContact: (name: string) => string;
    selectedCount: (count: number) => string;
    changeStatus: string;
    emptyTitle: string;
    emptyHint: string;
    noContact: string;
    pageSummary: (total: number) => string;
    pageLabel: (page: number, totalPages: number) => string;
    previousPage: string;
    nextPage: string;
    sortBy: (label: string) => string;
    unavailable: string;
    columns: Record<CrmTableColumnKey, string>;
  };
  contactDialog: {
    createTitle: string;
    editTitle: string;
    description: string;
    cancel: string;
    create: string;
    save: string;
    saving: string;
    fields: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      organization: string;
      owner: string;
      status: string;
      source: string;
    };
    placeholders: {
      firstName: string;
      lastName: string;
      email: string;
      source: string;
      organization: string;
      owner: string;
    };
  };
  statusDialog: {
    singleTitle: string;
    bulkTitle: string;
    description: string;
    status: string;
    reason: string;
    reasonPlaceholder: string;
    lossReasonHint: string;
    cancel: string;
    confirm: string;
    saving: string;
  };
  timeline: {
    title: string;
    emptyTitle: string;
    emptyHint: string;
    systemActor: string;
    reasonLabel: string;
  };
  stages: Record<CrmContactStatus, string>;
  activity: CrmActivityDictionary;
};

export type CrmOrganizationOption = { id: string; name: string | null };

export type CrmDashboardData = {
  contacts: CrmContactsListResult;
  stats: CrmContactStatusStats;
  owners: CrmOwnerOption[];
  organizations: CrmOrganizationOption[];
};

export type CrmUiClient = {
  listContacts: (params?: CrmContactsListParams) => Promise<CrmContactsListResult>;
  getStats: () => Promise<CrmContactStatusStats>;
  listOwners: () => Promise<CrmOwnerOption[]>;
  listOrganizations: () => Promise<CrmOrganizationOption[]>;
  listTimeline: (contactId: string) => Promise<CrmStatusLog[]>;
  createContact: (input: CrmContactFormInput) => Promise<CrmContact>;
  updateContact: (contactId: string, input: CrmContactFormInput) => Promise<CrmContact>;
  setStatus: (contactIds: string[], status: CrmContactStatus, reason?: string | null) => Promise<void>;
};

export type CrmDashboardSlots = {
  aboveTable?: ReactNode;
  besideStats?: ReactNode;
  rowActions?: (contact: CrmContact) => ReactNode;
};
