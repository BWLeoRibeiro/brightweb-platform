import type {
  MilestoneStatus,
  ProjectClientAccessMode,
  ProjectLinkKind,
  ProjectMemberRole,
  ProjectStatus,
} from "./contracts";

export type ClientProjectOrganization = {
  id: string;
  name: string;
};

export type ClientOrganizationMembership = {
  id: string;
  name: string;
  role: "admin" | "member";
};

export type ClientProjectContact = {
  profileId: string;
  label: string;
  email: string | null;
};

export type ClientProjectMeta = {
  id: string;
  title: string;
  status: MilestoneStatus;
  targetDate: string | null;
  completedAt: string | null;
  position: number;
};

export type ClientProjectDocument = {
  id: string;
  label: string;
  url: string;
  kind: ProjectLinkKind;
  createdAt: string;
};

export type ClientProjectProgress = {
  percent: number | null;
};

/** A deliberately narrow projection of fields explicitly maintained for clients. */
export type ClientProjectListItem = {
  id: string;
  name: string;
  reference: string | null;
  status: ProjectStatus;
  organizations: ClientProjectOrganization[];
  startDate: string | null;
  targetDate: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  clientSummary: string | null;
  clientScope: string | null;
  clientContact: ClientProjectContact | null;
  /** Bounded client-visible current/upcoming metas for list and home cards. */
  metaPreview: ClientProjectMeta[];
  progress: ClientProjectProgress;
};

export type ClientProjectDetail = ClientProjectListItem & {
  metas: ClientProjectMeta[];
  documents: ClientProjectDocument[];
};

export type ClientProjectsResult = {
  items: ClientProjectListItem[];
  organizations: ClientOrganizationMembership[];
  featuredProject: ClientProjectDetail | null;
};

export type ProjectClientAccessEligibleClient = {
  profileId: string;
  label: string;
  email: string | null;
};

export type ProjectClientAccessOrganization = {
  organizationId: string;
  organizationName: string;
  isPrimary: boolean;
  selectedForClientAccess: boolean;
  eligibleClients: ProjectClientAccessEligibleClient[];
  selectedProfileIds: string[];
};

export type ProjectClientAccessConfiguration = {
  mode: ProjectClientAccessMode;
  organizations: ProjectClientAccessOrganization[];
  clientSummary: string | null;
  clientScope: string | null;
  clientContactProfileId: string | null;
  updatedAt: string | null;
};

export type UpdateProjectClientAccessInput = {
  mode: ProjectClientAccessMode;
  organizations: Array<{
    organizationId: string;
    selectedProfileIds: string[];
  }>;
  clientSummary?: string | null;
  clientScope?: string | null;
  clientContactProfileId?: string | null;
};

export type ProjectSetupStaffOption = {
  profileId: string;
  label: string;
  email: string | null;
  globalRole: "staff" | "admin";
  isCurrentUser: boolean;
};

export type ProjectSetupOptions = {
  staff: ProjectSetupStaffOption[];
  organizations: ProjectClientAccessOrganization[];
};

export type CreateProjectWithAccessInput = {
  idempotencyKey: string;
  project: {
    organizationId: string;
    name: string;
    code?: string | null;
    status?: ProjectStatus;
    startDate?: string | null;
    targetDate?: string | null;
    cancellationReason?: string | null;
    summary?: string | null;
    clientSummary?: string | null;
    clientScope?: string | null;
    clientContactProfileId?: string | null;
  };
  participatingOrganizationIds: string[];
  members: Array<{ profileId: string; role: ProjectMemberRole }>;
  clientAccess: UpdateProjectClientAccessInput;
};

export type CreateProjectWithAccessResult = {
  projectId: string;
  created: boolean;
};
