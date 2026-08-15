import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migrationName = "20260810120000_project_client_access.sql";
const canonicalPath = join(
  process.cwd(),
  "supabase/modules/projects/migrations",
  migrationName,
);
const templatePath = join(
  process.cwd(),
  "packages/create-bw-app/template/supabase/modules/projects/migrations",
  migrationName,
);
const expandMigrationName = "20260811120000_project_client_access_expand.sql";
const memberSyncMigrationName = "20260811120500_project_member_sync_hardening.sql";
const enforcementMigrationName = "20260811121000_project_client_access_enforcement.sql";
const clientOrganizationsMigrationName = "20260811121500_project_client_organization_memberships.sql";
const metaPreviewMigrationName = "20260811121700_project_client_meta_preview.sql";
const identityCleanupMigrationName = "20260811122000_project_client_access_identity_cleanup.sql";
const nextStepsCleanupMigrationName = "20260811122500_remove_project_client_next_steps.sql";
const memberRolesMigrationName = "20260815120000_project_client_access_member_roles.sql";
const projectPermissionsMigrationName = "20260815133000_project_admin_creation_and_task_permissions.sql";

function readMigrationPair(name: string) {
  const canonical = readFileSync(join(
    process.cwd(),
    "supabase/modules/projects/migrations",
    name,
  ), "utf8");
  const template = readFileSync(join(
    process.cwd(),
    "packages/create-bw-app/template/supabase/modules/projects/migrations",
    name,
  ), "utf8");
  return { canonical, template };
}

test("project client access migration stays aligned with the app template", () => {
  const canonical = readFileSync(canonicalPath, "utf8");
  const template = readFileSync(templatePath, "utf8");

  assert.equal(template, canonical);
});

test("project client access candidates expose their real organization role", () => {
  const { canonical, template } = readMigrationPair(memberRolesMigrationName);
  assert.equal(template, canonical);
  assert.match(canonical, /'organization_role', org_member\.role/);
  assert.match(canonical, /FROM public\.organization_members org_member/);
  assert.match(canonical, /REVOKE ALL ON FUNCTION public\.get_project_access_configuration\(uuid\)/);
  assert.match(canonical, /GRANT EXECUTE ON FUNCTION public\.get_project_access_configuration\(uuid\)[\s\S]*TO authenticated/);
});

test("project permissions keep creation administrative and task work project-scoped", () => {
  const { canonical, template } = readMigrationPair(projectPermissionsMigrationName);
  assert.equal(template, canonical);
  assert.match(canonical, /v_actor_role <> 'admin'/);
  assert.match(canonical, /A project can have at most one internal project manager/);
  assert.doesNotMatch(canonical, /Exactly one internal project owner is required/);
  assert.match(canonical, /Tasks can only be assigned to project managers or collaborators/);
  assert.match(canonical, /Reassign or unassign open tasks before removing/);
  assert.match(canonical, /Collaborators can only update the state of their assigned tasks/);
  assert.match(canonical, /CREATE POLICY "Administrators create projects"/);
  assert.match(canonical, /CREATE POLICY "Administrators delete projects"/);
  assert.match(canonical, /CREATE POLICY "Project team update permitted tasks"/);
});

test("project client access migration defaults to private and enforces explicit audiences", () => {
  const source = readFileSync(canonicalPath, "utf8");

  assert.match(source, /client_access_mode text NOT NULL DEFAULT 'hidden'/);
  assert.match(source, /'hidden', 'all_org_clients', 'selected_clients'/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS public\.project_client_organizations/);
  assert.match(source, /CREATE TABLE IF NOT EXISTS public\.project_client_profiles/);
  assert.match(source, /REFERENCES public\.organization_members\(organization_id, profile_id\)[\s\S]*ON DELETE CASCADE/);
  assert.match(source, /CREATE OR REPLACE FUNCTION public\.can_current_client_view_project/);
  assert.match(source, /CREATE OR REPLACE FUNCTION public\.set_project_client_access/);
  assert.match(
    source,
    /NEW\.status IN \('active', 'blocked', 'paused', 'completed'\)[\s\S]*NEW\.activated_at := now\(\)/,
  );
  assert.match(source, /project\.client_access_mode = 'all_org_clients'/);
  assert.match(source, /project\.client_access_mode = 'selected_clients'/);
});

test("project security migration keeps internal work staff-only", () => {
  const { canonical: source } = readMigrationPair(enforcementMigrationName);

  assert.match(source, /CREATE POLICY "Project staff view project tasks"[\s\S]*public\.is_staff\(\)/);
  assert.match(source, /CREATE POLICY "Project staff view project members"[\s\S]*public\.is_staff\(\)/);
  assert.match(source, /CREATE POLICY "Project staff view project status log"[\s\S]*public\.is_staff\(\)/);
  assert.match(source, /IF v_role <> 'staff' THEN[\s\S]*RETURN false/);
  assert.doesNotMatch(
    source.match(/CREATE OR REPLACE FUNCTION public\.sync_org_primary_contact_admin_membership\(\)[\s\S]*?\$\$;/)?.[0] ?? "",
    /project_members/,
  );
});

test("team synchronization is atomic, explicitly authorized, and blocks unsafe role downgrades", () => {
  const { canonical, template } = readMigrationPair(memberSyncMigrationName);
  assert.equal(template, canonical);
  assert.match(canonical, /CREATE OR REPLACE FUNCTION public\.sync_project_members_exact/);
  assert.match(canonical, /SECURITY DEFINER/);
  assert.match(canonical, /FOR UPDATE/);
  assert.match(canonical, /Only project owners or administrators can manage the internal project team/);
  assert.match(canonical, /Exactly one internal project owner is required/);
  assert.match(canonical, /Project members must be internal staff/);
  assert.match(canonical, /responsible client contact must remain in the internal project team/);
  assert.match(canonical, /CREATE TRIGGER trg_prevent_internal_project_role_downgrade/);
  assert.match(canonical, /Reassign or remove this profile from every project/);
  assert.doesNotMatch(
    canonical,
    /GRANT EXECUTE ON FUNCTION public\.sync_project_members_exact\(uuid, jsonb, uuid\)[\s\S]*TO authenticated, service_role/,
  );
});

test("client access management is limited to project owners and administrators", () => {
  const source = readFileSync(canonicalPath, "utf8");
  const organizationsPolicy = source.match(
    /CREATE POLICY "Staff manage project client organizations"[\s\S]*?WITH CHECK \([\s\S]*?\n  \);/,
  )?.[0] ?? "";
  const profilesPolicy = source.match(
    /CREATE POLICY "Staff manage project client profiles"[\s\S]*?WITH CHECK \([\s\S]*?\n  \);/,
  )?.[0] ?? "";
  const setter = source.match(
    /CREATE OR REPLACE FUNCTION public\.set_project_client_access\([\s\S]*?\n\$\$;/,
  )?.[0] ?? "";

  for (const policy of [organizationsPolicy, profilesPolicy]) {
    assert.match(policy, /public\.is_admin\(\)/);
    assert.match(policy, /public\.is_staff\(\)[\s\S]*public\.is_project_owner_member\(project_id\)/);
    assert.doesNotMatch(policy, /USING \(public\.is_staff\(\)\)/);
  }
  assert.match(setter, /public\.is_admin\(\)/);
  assert.match(
    setter,
    /public\.is_staff\(\)[\s\S]*public\.is_project_owner_member\(target_project_id\)/,
  );
  assert.match(setter, /USING ERRCODE = '42501'/);
  assert.doesNotMatch(
    source,
    /GRANT EXECUTE ON FUNCTION public\.set_project_client_access\(uuid, text, uuid\[\], jsonb\)[\s\S]*?TO authenticated, service_role/,
  );
});

test("participation and client-safe expansion stays aligned and fail-closed", () => {
  const { canonical, template } = readMigrationPair(expandMigrationName);
  assert.equal(template, canonical);
  assert.match(canonical, /ON CONFLICT ON CONSTRAINT project_organizations_pkey/);

  assert.match(canonical, /CREATE TABLE IF NOT EXISTS public\.project_organizations/);
  assert.match(canonical, /idx_project_organizations_one_primary/);
  const participantReadPolicy = canonical.match(
    /CREATE POLICY "Project staff view participating organizations"[\s\S]*?\n  \);/,
  )?.[0] ?? "";
  assert.match(participantReadPolicy, /public\.is_project_team_member\(project_id\)/);
  assert.match(participantReadPolicy, /public\.is_project_org_admin\(project_id\)/);
  assert.match(
    canonical,
    /project_client_organizations_participation_fkey[\s\S]*REFERENCES public\.project_organizations\(project_id, organization_id\)[\s\S]*ON DELETE CASCADE/,
  );
  assert.match(canonical, /ADD COLUMN IF NOT EXISTS client_summary text/);
  assert.match(canonical, /ADD COLUMN IF NOT EXISTS client_scope text/);
  assert.match(canonical, /ADD COLUMN IF NOT EXISTS client_contact_profile_id uuid/);
  assert.match(canonical, /ADD COLUMN IF NOT EXISTS client_next_steps text/);
  assert.match(canonical, /CREATE OR REPLACE FUNCTION public\.create_project_with_client_access/);
  assert.match(canonical, /pg_advisory_xact_lock/);
  assert.match(canonical, /v_code_base := left/);
  assert.match(canonical, /WHEN v_code_suffix = 1 THEN v_code_base/);
  assert.match(canonical, /ELSE format\('%s-%s', v_code_base, v_code_suffix\)/);
  assert.match(canonical, /'hidden'[\s\S]*PERFORM public\.set_project_client_access/);
  assert.match(canonical, /'updated_at', project\.updated_at/);
  assert.match(canonical, /CREATE OR REPLACE FUNCTION public\.get_project_client_access_summary/);
  const accessSummary = canonical.match(
    /CREATE OR REPLACE FUNCTION public\.get_project_client_access_summary[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";
  assert.match(accessSummary, /public\.is_project_team_member\(target_project_id\)/);
  assert.match(accessSummary, /public\.is_project_org_admin\(target_project_id\)/);
  assert.match(accessSummary, /'content_readiness'/);
  assert.doesNotMatch(accessSummary, /profile\.email|'profile_id'/);
  assert.match(canonical, /CREATE OR REPLACE FUNCTION public\.list_current_client_projects/);
  assert.match(canonical, /CREATE OR REPLACE FUNCTION public\.get_current_client_project/);
  assert.doesNotMatch(
    canonical.match(/CREATE OR REPLACE FUNCTION public\.list_current_client_projects\(\)[\s\S]*?\n\$\$;/)?.[0] ?? "",
    /project\.summary|project\.health|project_tasks|project_members|app_activity_events/,
  );
});

test("client-visible milestones replace the free-text next-steps field", () => {
  const { canonical, template } = readMigrationPair(nextStepsCleanupMigrationName);
  assert.equal(template, canonical);
  assert.match(canonical, /-- bw-migration-safety: destructive/);
  assert.match(canonical, /ALTER TABLE public\.projects DROP COLUMN client_next_steps/);
  assert.match(canonical, /milestone\.visibility = 'client'/);
  assert.match(canonical, /meta_preview jsonb/);
  assert.match(canonical, /milestone\.status IN \('in_progress', 'delayed'\)/);
  assert.match(canonical, /ORDER BY milestone\.position, milestone\.target_date, milestone\.id[\s\S]*LIMIT 3/);
  assert.match(canonical, /milestone\.status = 'pending'[\s\S]*LIMIT 1/);

  const setter = canonical.match(
    /CREATE OR REPLACE FUNCTION public\.set_project_client_configuration[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";
  const creator = canonical.match(
    /CREATE OR REPLACE FUNCTION public\.create_project_with_client_access[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";
  const list = canonical.match(
    /CREATE FUNCTION public\.list_current_client_projects\(\)[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";
  const detail = canonical.match(
    /CREATE FUNCTION public\.get_current_client_project[\s\S]*?\n\$\$;/,
  )?.[0] ?? "";
  for (const currentContract of [setter, creator, list, detail]) {
    assert.doesNotMatch(currentContract, /client_next_steps/);
  }
});

test("management functions validate participation, memberships, and authenticated ownership", () => {
  const { canonical } = readMigrationPair(expandMigrationName);
  const setter = canonical.match(
    /CREATE OR REPLACE FUNCTION public\.set_project_client_access\([\s\S]*?\n\$\$;/,
  )?.[0] ?? "";
  const creator = canonical.match(
    /CREATE OR REPLACE FUNCTION public\.create_project_with_client_access\([\s\S]*?\n\$\$;/,
  )?.[0] ?? "";

  assert.match(setter, /Every client organization must participate in the project/);
  assert.match(setter, /Every selected organization requires at least one selected client/);
  assert.match(setter, /profile\.user_id IS NOT NULL/);
  assert.match(setter, /project_client_access_changed/);
  assert.match(creator, /v_actor_role NOT IN \('staff', 'admin'\)/);
  assert.match(creator, /Staff creators must own the projects they create/);
  assert.match(creator, /Exactly one internal project owner is required/);
  assert.match(creator, /Each internal profile can appear only once in the project team/);
  assert.match(creator, /request_payload <> v_payload/);
  assert.doesNotMatch(
    canonical,
    /GRANT EXECUTE ON FUNCTION public\.create_project_with_client_access[\s\S]*?TO authenticated, service_role/,
  );
  assert.match(canonical, /SET client_access_mode = 'hidden'/);
  assert.match(canonical, /project\.client_access_mode = 'selected_clients'/);
  assert.match(canonical, /client contact must be an internal project team member/);
  assert.match(creator, /jsonb_to_recordset\(p_members\)/);
});

test("enforcement closes reads and publishing without destructive cleanup", () => {
  const { canonical, template } = readMigrationPair(enforcementMigrationName);
  const foundation = readFileSync(canonicalPath, "utf8");
  const { canonical: expansion } = readMigrationPair(expandMigrationName);
  assert.equal(template, canonical);

  assert.doesNotMatch(foundation + expansion, /DROP POLICY IF EXISTS "Project team view projects"/);
  assert.match(canonical, /DROP POLICY IF EXISTS "Project team view projects"/);
  assert.doesNotMatch(canonical, /DELETE FROM public\.project_members/);
  assert.doesNotMatch(canonical, /SET owner_profile_id = NULL/);
  assert.match(canonical, /CREATE OR REPLACE FUNCTION public\.enforce_project_client_content_manager/);
  assert.match(canonical, /CREATE OR REPLACE FUNCTION public\.enforce_client_visible_project_item_manager/);
  assert.match(canonical, /CREATE OR REPLACE FUNCTION public\.protect_project_identity_fields/);
  assert.match(canonical, /BEFORE UPDATE OF owner_profile_id, organization_id ON public\.projects/);
  assert.match(canonical, /Only project owners or administrators can change project ownership/);
  assert.match(canonical, /CREATE CONSTRAINT TRIGGER trg_validate_project_owner_from_project/);
  assert.match(canonical, /Project owner and owner membership must match exactly/);
  assert.match(canonical, /CREATE TRIGGER trg_clear_stale_project_client_profile_grants/);
  assert.match(canonical, /OLD\.role_code = 'client'[\s\S]*DELETE FROM public\.project_client_profiles/);
  assert.match(canonical, /visibility = 'client'[\s\S]*can_current_client_view_project\(project_id\)/);
  assert.doesNotMatch(
    canonical.match(/CREATE OR REPLACE FUNCTION public\.sync_org_primary_contact_admin_membership\(\)[\s\S]*?\n\$\$;/)?.[0] ?? "",
    /project_members/,
  );
});

test("identity cleanup is isolated in a later migration", () => {
  const { canonical, template } = readMigrationPair(identityCleanupMigrationName);
  assert.equal(template, canonical);
  assert.match(canonical, /^-- bw-migration-safety: destructive$/m);
  assert.match(canonical, /DELETE FROM public\.project_members[\s\S]*role_code IN \('staff', 'admin'\)/);
  assert.match(canonical, /DISABLE TRIGGER trg_protect_project_identity_fields[\s\S]*SET owner_profile_id = NULL[\s\S]*ENABLE TRIGGER trg_protect_project_identity_fields/);
  assert.match(canonical, /SET owner_profile_id = NULL/);
  assert.match(canonical, /CREATE OR REPLACE FUNCTION public\.enforce_internal_project_identity/);
  assert.match(canonical, /IF TG_TABLE_NAME = 'projects' THEN[\s\S]*v_profile_id := NEW\.owner_profile_id;[\s\S]*ELSE[\s\S]*v_profile_id := NEW\.profile_id;/);
  assert.match(canonical, /IF TG_TABLE_NAME = 'projects' THEN[\s\S]*v_project_id := COALESCE\(NEW\.id, OLD\.id\);[\s\S]*ELSE[\s\S]*v_project_id := COALESCE\(NEW\.project_id, OLD\.project_id\);/);
  assert.doesNotMatch(canonical, /v_profile_id := CASE/);
  assert.doesNotMatch(canonical, /v_project_id := CASE/);
  assert.match(canonical, /CREATE CONSTRAINT TRIGGER trg_validate_project_owner_from_project/);
  assert.match(canonical, /Project owner and owner membership must match exactly/);
  assert.match(canonical, /CREATE OR REPLACE FUNCTION public\.validate_project_primary_participation/);
  assert.match(canonical, /project primary organization must be its only primary participant/);
});

test("client organization membership projection is narrow and precedes destructive cleanup", () => {
  const { canonical, template } = readMigrationPair(clientOrganizationsMigrationName);
  assert.equal(template, canonical);
  assert.match(canonical, /CREATE OR REPLACE FUNCTION public\.list_current_client_organizations\(\)/);
  assert.match(canonical, /SECURITY DEFINER/);
  assert.match(canonical, /SET search_path = public/);
  assert.match(canonical, /public\.current_global_role\(\) = 'client'/);
  assert.match(canonical, /membership\.profile_id = public\.current_profile_id\(\)/);
  assert.match(canonical, /RETURNS TABLE \(\s*organization_id uuid,\s*organization_name text,\s*membership_role text\s*\)/);
  assert.doesNotMatch(canonical, /email|phone|primary_contact|project_|crm_/);
  assert.match(canonical, /REVOKE ALL ON FUNCTION public\.list_current_client_organizations\(\)[\s\S]*FROM PUBLIC, anon, service_role/);
  assert.match(canonical, /GRANT EXECUTE ON FUNCTION public\.list_current_client_organizations\(\)[\s\S]*TO authenticated/);
  assert.ok(clientOrganizationsMigrationName < identityCleanupMigrationName);
});

test("safe-boundary client RPCs add meta previews while retaining legacy output", () => {
  const { canonical, template } = readMigrationPair(metaPreviewMigrationName);
  assert.equal(template, canonical);
  assert.doesNotMatch(canonical, /bw-migration-safety: destructive/);
  assert.match(canonical, /client_next_steps text/);
  assert.match(canonical, /project\.client_next_steps/);
  assert.match(canonical, /meta_preview jsonb/);
  assert.match(canonical, /milestone\.visibility = 'client'/);
  assert.match(canonical, /milestone\.status IN \('in_progress', 'delayed'\)[\s\S]*LIMIT 3/);
  assert.match(canonical, /milestone\.status = 'pending'[\s\S]*LIMIT 1/);
  assert.ok(clientOrganizationsMigrationName < metaPreviewMigrationName);
  assert.ok(metaPreviewMigrationName < identityCleanupMigrationName);
});
