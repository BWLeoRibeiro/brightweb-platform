import type { ReactNode } from "react";

import type {
  CrmContact,
  CrmContactStatusStats,
  CrmContactsListParams,
  CrmContactsListResult,
  CrmOwnerOption,
  CrmReportData,
  CrmStatusLog,
} from "../data";
import type { CrmContactStatus, CreateCrmContactInput, UpdateCrmContactInput } from "../server";
import type { CrmActivityDictionary } from "../activity-messages";

export type CrmStageConfig = {
  value: CrmContactStatus;
  label: string;
  token: `--${string}`;
};

export type CrmTableColumnKey = "name" | "organization" | "owner" | "status" | "updated";

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

export type CrmOrganization = {
  id: string;
  name: string | null;
  industry?: string | null;
  company_size?: string | null;
  budget_range?: string | null;
  website_url?: string | null;
  address?: string | null;
  taxIdentifierValue?: string | null;
  primary_contact_id?: string | null;
  created_at?: string;
};

/** @deprecated Use CrmOrganization. */
export type CrmOrganizationOption = CrmOrganization;

export type CrmOrganizationFieldConfig = {
  showIndustry?: boolean;
  showCompanySize?: boolean;
  showBudgetRange?: boolean;
  showWebsite?: boolean;
  showAddress?: boolean;
  showTaxIdentifier?: boolean;
  taxIdentifierLabel?: string;
};

export type CrmUiDictionary = {
  locale: string;
  dashboard: {
    title: string;
    subtitle: string;
    addContact: string;
    loadError: string;
    reportEyebrow: string;
    reportTitle: string;
    reportDescription: string;
    openReport: string;
    reportAriaLabel: string;
    qualifiedSingular: string;
    qualifiedPlural: string;
    wonSingular: string;
    wonPlural: string;
    inLast30Days: string;
    last7Days: string;
    last30Days: string;
    last12Months: string;
    marketing: string;
  };
  stats: {
    title: string;
    subtitle: string;
    total: string;
    loading: string;
  };
  table: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    allSegments: string;
    organizeBy: string;
    sortNewest: string;
    sortName: string;
    sortCompany: string;
    selectAll: string;
    selectAllShort: string;
    selectContact: (name: string) => string;
    selectShort: string;
    selectedCount: (count: number) => string;
    changeStatus: string;
    deleteSelected: string;
    emptyTitle: string;
    emptyLoading: string;
    emptyHint: string;
    emptyLoadingHint: string;
    noContact: string;
    pageSummary: (total: number) => string;
    pageLabel: (page: number, totalPages: number) => string;
    previousPage: string;
    nextPage: string;
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
    delete: string;
    timeline: string;
    viewEyebrow: string;
    editEyebrow: string;
    createEyebrow: string;
    createDescription: string;
    createdOn: (date: string) => string;
    noName: string;
    information: string;
    pipeline: string;
    edit: string;
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
    lossTitle: string;
    lossDescription: string;
    lossReasonHint: string;
    cancel: string;
    confirm: string;
    saving: string;
  };
  deleteDialog: {
    singleTitle: string;
    bulkTitle: string;
    singleDescription: string;
    bulkDescription: (count: number) => string;
    cancel: string;
    confirm: string;
    deleting: string;
  };
  timeline: {
    title: string;
    subtitle: string;
    expand: string;
    searchPlaceholder: string;
    emptyTitle: string;
    emptyHint: string;
    noResultsTitle: string;
    noResultsHint: string;
    systemActor: string;
    reasonLabel: string;
  };
  organizations: {
    title: string;
    subtitle: string;
    expand: string;
    searchPlaceholder: string;
    emptyTitle: string;
    emptyHint: string;
    contactCount: (count: number) => string;
    industry: string;
    companySize: string;
    budgetRange: string;
    website: string;
    address: string;
    taxIdentifier: string;
    unavailable: string;
    newTitle: string;
    viewEyebrow: string;
    editEyebrow: string;
    createEyebrow: string;
    createDescription: string;
    fallbackDescription: string;
    identity: string;
    profile: string;
    name: string;
    namePlaceholder: string;
    selectIndustry: string;
    websitePlaceholder: string;
    taxIdentifierLong: string;
    taxIdentifierPlaceholder: string;
    addressPlaceholder: string;
    edit: string;
    save: string;
    saving: string;
    cancel: string;
  };
  toolbar: {
    filters: string;
    clear: string;
    status: string;
    organize: string;
    apply: string;
    create: string;
    newContact: string;
    newOrganization: string;
  };
  report: {
    loading: string;
    loadError: string;
    eyebrow: string;
    titlePrefix: string;
    titleAccent: string;
    qualified: string;
    won: string;
    lost: string;
    updated: string;
    back: string;
    totalContacts: string;
    portfolio: string;
    qualification: string;
    baseShare: string;
    winRate: string;
    closedShare: string;
    statusTitle: string;
    statusSubtitle: string;
    closeTitle: string;
    closeSubtitle: string;
    wonContacts: string;
    lostContacts: string;
    closedDeals: string;
    sourceTitle: string;
    sourceSubtitle: string;
    ownerTitle: string;
    ownerSubtitle: string;
    organizationTitle: string;
    organizationSubtitle: string;
    totalOrganizations: string;
    withContacts: string;
    coverage: string;
    withoutContacts: (count: number) => string;
    coverageHint: string;
    topOrganizations: string;
    topOrganizationsSubtitle: string;
    noContacts: string;
    noSources: string;
    noOwners: string;
    noOrganizations: string;
    noIndustry: string;
    noWebsite: string;
  };
  stages: Record<CrmContactStatus, string>;
  activity: CrmActivityDictionary;
};

export type CrmDashboardData = {
  contacts: CrmContactsListResult;
  stats: CrmContactStatusStats;
  owners: CrmOwnerOption[];
  organizations: CrmOrganization[];
  timeline?: CrmStatusLog[];
};

export type CrmUiClient = {
  listContacts: (params?: CrmContactsListParams) => Promise<CrmContactsListResult>;
  getStats: () => Promise<CrmContactStatusStats>;
  listOwners: () => Promise<CrmOwnerOption[]>;
  listOrganizations: () => Promise<CrmOrganization[]>;
  listTimeline: (contactId?: string) => Promise<CrmStatusLog[]>;
  getReport: () => Promise<CrmReportData>;
  createContact: (input: CrmContactFormInput) => Promise<CrmContact>;
  updateContact: (contactId: string, input: CrmContactFormInput) => Promise<CrmContact>;
  setStatus: (contactIds: string[], status: CrmContactStatus, reason?: string | null) => Promise<void>;
  deleteContacts: (contactIds: string[]) => Promise<void>;
};

export type CrmDashboardSlots = {
  aboveStats?: ReactNode;
  besideStats?: ReactNode;
  aboveTable?: ReactNode;
  sidebarTop?: ReactNode;
  sidebarBottom?: ReactNode;
  reportBanner?: ReactNode;
  rowActions?: (contact: CrmContact) => ReactNode;
};

export type CrmReportSlots = {
  afterHero?: ReactNode;
  beforeDistributions?: ReactNode;
  afterDistributions?: ReactNode;
};

export type CrmNavigationConfig = {
  reportHref?: string;
  marketingHref?: string;
};
