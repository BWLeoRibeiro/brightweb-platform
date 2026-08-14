import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClientOrganizationMembership,
  ClientProjectContact,
  ClientProjectDetail,
  ClientProjectDocument,
  ClientProjectListItem,
  ClientProjectMeta,
  ClientProjectOrganization,
  CreateProjectWithAccessInput,
  CreateProjectWithAccessResult,
  ProjectClientAccessConfiguration,
  ProjectClientAccessEligibleClient,
  ProjectClientAccessOrganization,
  ProjectSetupOptions,
  ProjectSetupStaffOption,
  UpdateProjectClientAccessInput,
} from "./client-contracts";
import type { MilestoneStatus, ProjectClientAccessMode, ProjectLinkKind, ProjectStatus } from "./contracts";

type DbError = { message: string } | null;
type DbRecord = Record<string, unknown>;

function throwIfError(error: DbError) {
  if (error) throw new Error(error.message);
}

function record(value: unknown): DbRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as DbRecord
    : null;
}

function records(value: unknown): DbRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = record(item);
    return parsed ? [parsed] : [];
  });
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function profileLabel(profile: DbRecord) {
  const name = [profile.first_name, profile.last_name]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .trim();
  return name || nullableString(profile.label) || nullableString(profile.email) || "Utilizador";
}

function normalizeClientContact(value: unknown): ClientProjectContact | null {
  const item = record(value);
  if (!item) return null;
  const profileId = nullableString(item.profile_id ?? item.id);
  if (!profileId) return null;
  return {
    profileId,
    label: nullableString(item.label ?? item.name) ?? profileLabel(item),
    email: nullableString(item.email),
  };
}

function normalizeOrganizations(value: unknown): ClientProjectOrganization[] {
  return records(value).flatMap((item) => {
    const id = nullableString(item.organization_id ?? item.id);
    if (!id) return [];
    return [{ id, name: nullableString(item.organization_name ?? item.name) ?? "Organização" }];
  });
}

function normalizeClientProject(row: DbRecord): ClientProjectListItem | null {
  const id = nullableString(row.project_id ?? row.id);
  if (!id) return null;
  const progress = typeof row.progress_percent === "number" && Number.isFinite(row.progress_percent)
    ? Math.max(0, Math.min(100, Math.round(row.progress_percent)))
    : null;
  return {
    id,
    name: nullableString(row.name) ?? "Projeto",
    reference: nullableString(row.reference),
    status: String(row.status) as ProjectStatus,
    organizations: normalizeOrganizations(row.organizations),
    startDate: nullableString(row.start_date),
    targetDate: nullableString(row.target_date),
    completedAt: nullableString(row.completed_at),
    archivedAt: nullableString(row.archived_at),
    clientSummary: nullableString(row.client_summary),
    clientScope: nullableString(row.client_scope),
    clientContact: normalizeClientContact(row.client_contact),
    metaPreview: normalizeMetas(row.meta_preview),
    progress: { percent: progress },
  };
}

function normalizeMetas(value: unknown): ClientProjectMeta[] {
  return records(value).flatMap((item) => {
    const id = nullableString(item.id);
    if (!id) return [];
    return [{
      id,
      title: nullableString(item.title) ?? "Meta",
      status: String(item.status) as MilestoneStatus,
      targetDate: nullableString(item.target_date),
      completedAt: nullableString(item.completed_at),
      position: typeof item.position === "number" ? item.position : 0,
    }];
  });
}

function normalizeDocuments(value: unknown): ClientProjectDocument[] {
  return records(value).flatMap((item) => {
    const id = nullableString(item.id);
    if (!id) return [];
    return [{
      id,
      label: nullableString(item.label) ?? "Documento",
      url: nullableString(item.url) ?? "",
      kind: String(item.kind) as ProjectLinkKind,
      createdAt: nullableString(item.created_at) ?? "",
    }];
  });
}

function firstRpcRecord(value: unknown): DbRecord | null {
  if (Array.isArray(value)) return record(value[0]);
  return record(value);
}

/** Uses the authenticated client-safe RPC; never assembles client data with service-role reads. */
export async function listClientProjects(supabase: SupabaseClient): Promise<ClientProjectListItem[]> {
  const { data, error } = await supabase.rpc("list_current_client_projects");
  throwIfError(error);
  return records(data).flatMap((row) => {
    const project = normalizeClientProject(row);
    return project ? [project] : [];
  });
}

/** Returns only the authenticated client's own organization memberships. */
export async function listClientOrganizations(
  supabase: SupabaseClient,
): Promise<ClientOrganizationMembership[]> {
  const { data, error } = await supabase.rpc("list_current_client_organizations");
  throwIfError(error);
  return records(data).flatMap((row) => {
    const id = nullableString(row.organization_id);
    const name = nullableString(row.organization_name);
    const role = row.membership_role;
    if (!id || !name || (role !== "admin" && role !== "member")) return [];
    return [{ id, name, role }];
  });
}

/** Missing and unauthorized projects are intentionally indistinguishable. */
export async function getClientProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ClientProjectDetail | null> {
  const { data, error } = await supabase.rpc("get_current_client_project", {
    target_project_id: projectId,
  });
  throwIfError(error);
  const row = firstRpcRecord(data);
  if (!row) return null;
  const project = normalizeClientProject(row);
  if (!project) return null;
  return {
    ...project,
    metas: normalizeMetas(row.metas),
    documents: normalizeDocuments(row.documents),
  };
}

function normalizeEligibleClients(value: unknown): ProjectClientAccessEligibleClient[] {
  return records(value).flatMap((item) => {
    const profileId = nullableString(item.profile_id ?? item.profileId);
    if (!profileId) return [];
    return [{
      profileId,
      label: nullableString(item.label) ?? profileLabel(item),
      email: nullableString(item.email),
    }];
  });
}

function normalizeAccessOrganization(value: unknown, selected = true): ProjectClientAccessOrganization | null {
  const item = record(value);
  if (!item) return null;
  const organizationId = nullableString(item.organization_id ?? item.organizationId ?? item.id);
  if (!organizationId) return null;
  const selectedProfileIds = Array.isArray(item.selected_profile_ids ?? item.selectedProfileIds)
    ? ((item.selected_profile_ids ?? item.selectedProfileIds) as unknown[]).flatMap((profileId) =>
      typeof profileId === "string" && profileId.length > 0 ? [profileId] : []
    )
    : [];
  return {
    organizationId,
    organizationName: nullableString(item.organization_name ?? item.organizationName ?? item.name) ?? "Organização",
    isPrimary: item.is_primary === true || item.isPrimary === true,
    selectedForClientAccess: typeof item.selected_for_client_access === "boolean"
      ? item.selected_for_client_access
      : typeof item.selectedForClientAccess === "boolean"
        ? item.selectedForClientAccess
        : typeof item.selected === "boolean" ? item.selected : selected,
    eligibleClients: normalizeEligibleClients(item.eligible_clients ?? item.eligibleClients),
    selectedProfileIds,
  };
}

function normalizeAccessConfiguration(value: unknown): ProjectClientAccessConfiguration {
  const item = record(value) ?? {};
  return {
    mode: String(item.mode ?? "hidden") as ProjectClientAccessMode,
    organizations: records(item.organizations).flatMap((organization) => {
      const parsed = normalizeAccessOrganization(organization);
      return parsed ? [parsed] : [];
    }),
    clientSummary: nullableString(item.client_summary ?? item.clientSummary),
    clientScope: nullableString(item.client_scope ?? item.clientScope),
    clientContactProfileId: nullableString(item.client_contact_profile_id ?? item.clientContactProfileId),
    updatedAt: nullableString(item.updated_at ?? item.updatedAt),
  };
}

export async function getProjectClientAccess(
  supabase: SupabaseClient,
  projectId: string,
): Promise<ProjectClientAccessConfiguration> {
  const { data, error } = await supabase.rpc("get_project_access_configuration", {
    target_project_id: projectId,
  });
  throwIfError(error);
  return normalizeAccessConfiguration(data);
}

export async function updateProjectClientAccess(
  supabase: SupabaseClient,
  projectId: string,
  input: UpdateProjectClientAccessInput,
): Promise<ProjectClientAccessConfiguration> {
  const needsExistingClientFields = input.clientSummary === undefined
    || input.clientScope === undefined
    || input.clientContactProfileId === undefined;
  const existing = needsExistingClientFields
    ? await getProjectClientAccess(supabase, projectId)
    : null;
  const selectedOrganizations = input.organizations;
  const organizationIds = Array.from(new Set(selectedOrganizations.map((organization) => organization.organizationId)));
  const profileGrants = selectedOrganizations.flatMap((organization) =>
    organization.selectedProfileIds.map((profileId) => ({
      organization_id: organization.organizationId,
      profile_id: profileId,
    }))
  );
  const { error } = await supabase.rpc("set_project_client_configuration", {
    target_project_id: projectId,
    target_configuration: {
      mode: input.mode,
      organization_ids: organizationIds,
      profile_grants: profileGrants,
      client_summary: input.clientSummary !== undefined ? input.clientSummary : existing?.clientSummary ?? null,
      client_scope: input.clientScope !== undefined ? input.clientScope : existing?.clientScope ?? null,
      client_contact_profile_id: input.clientContactProfileId !== undefined
        ? input.clientContactProfileId
        : existing?.clientContactProfileId ?? null,
    },
  });
  throwIfError(error);
  return getProjectClientAccess(supabase, projectId);
}

export async function updateProjectOrganizations(
  supabase: SupabaseClient,
  projectId: string,
  organizationIds: string[],
): Promise<ProjectClientAccessConfiguration> {
  const { error } = await supabase.rpc("set_project_organizations", {
    target_project_id: projectId,
    target_organization_ids: Array.from(new Set(organizationIds)),
  });
  throwIfError(error);
  return getProjectClientAccess(supabase, projectId);
}

export async function createProjectWithAccess(
  supabase: SupabaseClient,
  input: CreateProjectWithAccessInput,
): Promise<CreateProjectWithAccessResult> {
  const organizationIds = Array.from(new Set([
    input.project.organizationId,
    ...input.participatingOrganizationIds,
  ]));
  const profileGrants = input.clientAccess.organizations.flatMap((organization) =>
    organization.selectedProfileIds.map((profileId) => ({
      organization_id: organization.organizationId,
      profile_id: profileId,
    }))
  );
  const { data, error } = await supabase.rpc("create_project_with_client_access", {
    p_request_id: input.idempotencyKey,
    p_project: {
      name: input.project.name.trim(),
      code: input.project.code?.trim() || null,
      status: input.project.status ?? "planned",
      primary_organization_id: input.project.organizationId,
      start_date: input.project.startDate ?? null,
      target_date: input.project.targetDate ?? null,
      cancellation_reason: input.project.cancellationReason?.trim() || null,
      summary: input.project.summary?.trim() || null,
      client_summary: input.project.clientSummary?.trim() || null,
      client_scope: input.project.clientScope?.trim() || null,
      client_contact_profile_id: input.project.clientContactProfileId ?? null,
    },
    p_organization_ids: organizationIds,
    p_members: input.members.map((member) => ({ profile_id: member.profileId, role: member.role })),
    p_client_access: {
      mode: input.clientAccess.mode,
      organization_ids: input.clientAccess.organizations.map((organization) => organization.organizationId),
      profile_grants: profileGrants,
    },
  });
  throwIfError(error);
  const result = firstRpcRecord(data);
  const projectId = nullableString(result?.project_id);
  if (!projectId) throw new Error("Não foi possível criar o projeto.");
  return { projectId, created: result?.created === true };
}

export async function listProjectSetupOptions(
  supabase: SupabaseClient,
  currentProfileId: string,
  organizationIds: string[],
): Promise<ProjectSetupOptions> {
  const uniqueOrganizationIds = Array.from(new Set(organizationIds));
  const [organizationResult, roleResult, membershipResult] = await Promise.all([
    uniqueOrganizationIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("organizations").select("id, name").in("id", uniqueOrganizationIds).order("name"),
    supabase.from("user_role_assignments").select("profile_id, role_code").in("role_code", ["staff", "admin", "client"]),
    uniqueOrganizationIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : supabase.from("organization_members").select("organization_id, profile_id").in("organization_id", uniqueOrganizationIds),
  ]);
  throwIfError(organizationResult.error);
  throwIfError(roleResult.error);
  throwIfError(membershipResult.error);

  const internalRoles = new Map<string, "staff" | "admin">();
  const clientProfileIds = new Set<string>();
  for (const item of roleResult.data ?? []) {
    if (typeof item.profile_id !== "string") continue;
    if (item.role_code === "client") {
      clientProfileIds.add(item.profile_id);
      continue;
    }
    if (item.role_code === "admin" || (item.role_code === "staff" && !internalRoles.has(item.profile_id))) {
      internalRoles.set(item.profile_id, item.role_code);
    }
  }
  const membershipProfileIds = (membershipResult.data ?? []).flatMap((item) =>
    typeof item.profile_id === "string" ? [item.profile_id] : []
  );
  const profileIds = Array.from(new Set([...internalRoles.keys(), ...membershipProfileIds]));
  const profileResult = profileIds.length === 0
    ? { data: [], error: null }
    : await supabase.from("profiles").select("id, first_name, last_name, email").in("id", profileIds);
  throwIfError(profileResult.error);
  const profiles = new Map((profileResult.data ?? []).map((profile) => [profile.id, profile as DbRecord]));

  const staff: ProjectSetupStaffOption[] = Array.from(internalRoles.entries()).flatMap(([profileId, globalRole]) => {
    const profile = profiles.get(profileId);
    if (!profile) return [];
    return [{
      profileId,
      label: profileLabel(profile),
      email: nullableString(profile.email),
      globalRole,
      isCurrentUser: profileId === currentProfileId,
    }];
  }).sort((a, b) => a.label.localeCompare(b.label, "pt-PT"));

  const membersByOrganization = new Map<string, ProjectClientAccessEligibleClient[]>();
  for (const membership of membershipResult.data ?? []) {
    if (typeof membership.organization_id !== "string" || typeof membership.profile_id !== "string") continue;
    if (internalRoles.has(membership.profile_id) || !clientProfileIds.has(membership.profile_id)) continue;
    const profile = profiles.get(membership.profile_id);
    if (!profile) continue;
    const current = membersByOrganization.get(membership.organization_id) ?? [];
    current.push({
      profileId: membership.profile_id,
      label: profileLabel(profile),
      email: nullableString(profile.email),
    });
    membersByOrganization.set(membership.organization_id, current);
  }

  return {
    staff,
    organizations: (organizationResult.data ?? []).flatMap((organization) => {
      const parsed = normalizeAccessOrganization({
        organization_id: organization.id,
        organization_name: organization.name,
        selected_for_client_access: false,
        eligible_clients: (membersByOrganization.get(organization.id) ?? [])
          .toSorted((a, b) => a.label.localeCompare(b.label, "pt-PT")),
        selected_profile_ids: [],
      });
      return parsed ? [parsed] : [];
    }),
  };
}
