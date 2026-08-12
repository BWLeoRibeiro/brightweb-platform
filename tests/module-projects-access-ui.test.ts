import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { hasSelectedClientOrganizationWithoutAudience } from "../packages/module-projects/src/client-access-validation.ts";
import {
  ProjectClientAccessEditor,
  getClientAccessDraftError,
  type ClientAccessDraft,
} from "../packages/module-projects/src/ui/project-client-access-editor.tsx";
import { matchesClientProjectGroup } from "../packages/module-projects/src/ui/client/projects-list-client.tsx";
import { resolveClientMetaPreview } from "../packages/module-projects/src/ui/client/shared.ts";

const uiRoot = join(process.cwd(), "packages/module-projects/src/ui");
const source = (file: string) => readFileSync(join(uiRoot, file), "utf8");

test("project creation is one four-step local-state wizard with one aggregate submit", () => {
  const wizard = source("create-project-sheet.tsx");
  const copy = source("project-access-dictionary.ts");

  for (const label of ["Projeto e organizações", "Equipa interna", "Acesso de clientes", "Rever e criar"]) {
    assert.match(copy, new RegExp(label));
  }
  assert.match(wizard, /projectAccessDictionary\.wizard\.steps/);
  assert.equal((wizard.match(/client\.requestRaw\("\/api\/projects"/g) ?? []).length, 1);
  assert.match(wizard, /idempotencyKey:/);
  assert.match(wizard, /project:\s*\{/);
  assert.match(wizard, /participatingOrganizationIds,/);
  assert.match(wizard, /members: Object\.entries\(members\)/);
  assert.match(wizard, /clientAccess: clientAccessDraftToPayload\(clientAccess\)/);
  assert.doesNotMatch(wizard, /window\.prompt|useProjectSetupState|createProject\(client/);
});

test("client access editor keeps external grants separate and supports all three audience modes", () => {
  const editor = source("project-client-access-editor.tsx");
  const copy = source("project-access-dictionary.ts");

  assert.match(copy, /Privado à equipa/);
  assert.match(copy, /Todos os clientes das organizações selecionadas/);
  assert.match(copy, /Apenas clientes selecionados/);
  assert.match(copy, /Dar acesso a um cliente não o adiciona à equipa/);
  assert.match(editor, /projectAccessDictionary\.editor/);
  assert.match(editor, /organizations\.filter\(\(organization\) => organization\.selected\)/);
  assert.match(editor, /eligibleClients/);
});

test("internal detail presents distinct organizations, team and client access surfaces", () => {
  const detail = source("project-detail-page.tsx");
  const teamEditor = source("project-members-edit-sheet.tsx");
  const copy = source("project-access-dictionary.ts");

  assert.match(copy, /Pessoas e acesso/);
  assert.match(detail, /projectAccessDictionary\.detail\.peopleAndAccess/);
  assert.match(detail, /ProjectDetailOrganizationsCard/);
  assert.match(detail, /ProjectDetailTeamCard/);
  assert.match(detail, /ProjectClientAccessCard/);
  assert.doesNotMatch(teamEditor, /org_admin|org_member|clientes entram como observadores|Client role is fixed/);
});

test("client detail renders only explicit client-facing project fields", () => {
  const detail = source("client/project-detail-client.tsx");

  assert.match(detail, /project\.clientSummary/);
  assert.match(detail, /project\.clientScope/);
  assert.match(detail, /project\.clientContact/);
  assert.doesNotMatch(detail, /clientNextSteps|Próximos passos/);
  assert.doesNotMatch(detail, /project\.summary/);
});

test("selected-client access requires an audience in every selected organization", () => {
  const draft: ClientAccessDraft = {
    mode: "selected_clients",
    organizations: [
      {
        organizationId: "org-1",
        organizationName: "Alpha",
        selected: true,
        eligibleClients: [{ profileId: "client-1", label: "Ana", email: null }],
        selectedProfileIds: ["client-1"],
      },
      {
        organizationId: "org-2",
        organizationName: "Beta",
        selected: true,
        eligibleClients: [{ profileId: "client-2", label: "Bruno", email: null }],
        selectedProfileIds: [],
      },
    ],
  };

  assert.equal(hasSelectedClientOrganizationWithoutAudience(draft.mode, draft.organizations), true);
  assert.match(getClientAccessDraftError(draft) ?? "", /cada organização/);
  const html = renderToStaticMarkup(createElement(ProjectClientAccessEditor, { value: draft, onChange() {} }));
  assert.match(html, /Seleciona pelo menos um cliente de Beta/);
});

test("creation keeps staff ownership and responsible contact selection coherent with the internal team", () => {
  const wizard = source("create-project-sheet.tsx");
  const copy = source("project-access-dictionary.ts");

  assert.match(wizard, /creator\?\.globalRole === "staff"/);
  assert.match(wizard, /ownerLockedToCreator && profileId === currentActor\?\.profileId/);
  assert.match(wizard, /ownerLockedToCreator && \(profileId === currentActor\?\.profileId \|\| role === "owner"\)/);
  assert.match(copy, /Como membro de staff, permaneces responsável/);
  assert.match(wizard, /\.filter\(\(person\) => Boolean\(members\[person\.profileId\]\)\)/);
  assert.match(wizard, /clientContactProfileId === profileId\) setClientContactProfileId\(""\)/);
});

test("creation review names the exact external audience and new controls expose accessible state", () => {
  const wizard = source("create-project-sheet.tsx");
  const list = source("client/projects-list-client.tsx");
  const detail = source("client/project-detail-client.tsx");

  assert.match(wizard, /selectedAccessOrganizations\.map\(\(organization\) => organization\.organizationName\)\.join/);
  assert.match(wizard, /selectedClientNames\.join/);
  assert.match(wizard, /htmlFor="project-client-summary"/);
  assert.match(wizard, /aria-label=\{projectAccessDictionary\.wizard\.roleFor\(person\.label\)\}/);
  assert.match(list, /aria-pressed=\{group === item\.value\}/);
  assert.match(list, /setReloadKey\(\(current\) => current \+ 1\)/);
  assert.match(detail, /setReloadKey\(\(current\) => current \+ 1\)/);
  assert.match(detail, /response\.status === 404 \|\| response\.status === 403/);
});

test("participating organizations remain editable by project managers through the protected route", () => {
  const card = source("project-detail-organizations-card.tsx");
  const detail = source("project-detail-page.tsx");

  assert.match(detail, /ProjectDetailOrganizationsCard canManage=\{projectRole === "admin" \|\| projectRole === "owner"\}/);
  assert.match(card, /client\.listOrganizations/);
  assert.match(card, /`\/api\/projects\/\$\{project\.id\}\/organizations`/);
  assert.match(card, /method: "PATCH"/);
  assert.match(card, /disabled=\{primary \|\| isSaving\}/);
  assert.match(card, /organizationEditor\.revokeConfirm/);
  assert.match(card, /loadState === "error"/);
});

test("client publication permissions are separate from ordinary contribution", () => {
  const server = readFileSync(join(process.cwd(), "packages/module-projects/src/server.ts"), "utf8");
  const detail = source("project-detail-page.tsx");
  const milestoneCreate = source("project-detail-create-sheets/project-milestone-create-sheet.tsx");
  const links = source("project-links-card.tsx");

  assert.match(server, /canManageClientContent: canManageProject/);
  assert.match(detail, /canManageClientContent=\{access\.canManageClientContent\}/);
  assert.match(milestoneCreate, /canManageClientContent \? <label/);
  assert.match(links, /link\.visibility !== "client" \|\| canManageClientContent/);
  assert.match(links, /disabled=\{linkMode === "view" \|\| !canManageClientContent\}/);
});

test("archived client projects are retained only in the all-projects filter", () => {
  const archived = { status: "active" as const, archivedAt: "2026-08-11T10:00:00Z" };
  const active = { status: "active" as const, archivedAt: null };
  const completed = { status: "completed" as const, archivedAt: null };

  assert.equal(matchesClientProjectGroup(archived, "ongoing"), false);
  assert.equal(matchesClientProjectGroup(archived, "completed"), false);
  assert.equal(matchesClientProjectGroup(archived, "all"), true);
  assert.equal(matchesClientProjectGroup(active, "ongoing"), true);
  assert.equal(matchesClientProjectGroup(completed, "completed"), true);
});

test("client meta previews prefer up to three current metas, then one pending meta", () => {
  const meta = (id: string, status: "pending" | "in_progress" | "achieved" | "delayed", position: number) => ({
    id,
    title: id,
    status,
    targetDate: null,
    completedAt: null,
    position,
  });
  const current = resolveClientMetaPreview([
    meta("pending", "pending", 0),
    meta("one", "in_progress", 1),
    meta("two", "delayed", 2),
    meta("three", "in_progress", 3),
    meta("four", "in_progress", 4),
  ]);
  assert.equal(current?.label, "Metas em curso");
  assert.deepEqual(current?.metas.map(({ id }) => id), ["one", "two", "three"]);

  const pending = resolveClientMetaPreview([meta("done", "achieved", 0), meta("next", "pending", 1)]);
  assert.equal(pending?.label, "Próxima meta");
  assert.deepEqual(pending?.metas.map(({ id }) => id), ["next"]);
});

test("client portal adapts its hierarchy to organization and project counts", () => {
  const portal = source("client/client-portal-home.tsx");
  const accountRoute = source("client/account-routes.tsx");
  const listCard = source("client/project-list-card.tsx");
  const list = source("client/projects-list-client.tsx");
  const shared = source("client/shared.ts");

  assert.match(portal, /organizations\.length === 1/);
  assert.match(portal, /visibleProjects\.filter\(isOngoingProject\)/);
  assert.match(portal, /!project\.archivedAt/);
  assert.match(portal, /ongoingProjects\.length === 1 \? clientProjectsDictionary\.portal\.activeProject/);
  assert.match(portal, /headingLevel="h3"/);
  assert.doesNotMatch(portal, /function ProjectOverview/);
  assert.doesNotMatch(portal, /project=\{featured\}|featuredProject\?\.id/);
  assert.match(portal, /ongoingProjects\.slice\(0, 4\)/);
  assert.match(portal, /organizations\.length > 1/);
  assert.match(portal, /setSelectedOrganizationId/);
  assert.match(portal, /h-20 w-full/);
  assert.match(portal, /lg:w-80/);
  assert.match(portal, /min-w-0 w-full lg:w-80/);
  assert.match(portal, /group min-w-0 transition-/);
  assert.match(portal, /w-\[var\(--radix-dropdown-menu-trigger-width\)\]/);
  assert.match(portal, /focus-visible:border-\[color:var\(--accent\)\]/);
  assert.match(portal, /showOrganizations=\{!singleOrganization && !focusedOrganization\}/);
  assert.match(portal, /yourOrganization/);
  assert.match(portal, /buildUpcomingBriefing\(ongoingProjects\)/);
  assert.match(portal, /findNearestDelivery\(ongoingProjects\)/);
  assert.match(portal, /clientProjectsDictionary\.portal\.upNext/);
  assert.match(portal, /brand-panel relative overflow-hidden/);
  assert.match(portal, /project-hero-surface-raised/);
  assert.match(portal, /InitialsAvatar label=\{selected\.name\} tone="inverse"/);
  assert.match(portal, /lg:grid-cols-\[minmax\(0,1fr\)_18rem\]/);
  assert.match(portal, /ongoingProjects\.length > 1 \? "md:grid-cols-2"/);
  assert.match(portal, /AccountAndSecurityFooter/);
  assert.match(portal, /href="\/account\/perfil"/);
  assert.match(shared, /meta\.status === "in_progress" \|\| meta\.status === "delayed"/);
  assert.match(shared, /ordered\.find\(\(meta\) => meta\.status === "pending"\)/);
  assert.match(listCard, /showOrganizations = true/);
  assert.match(listCard, /resolveClientMetaPreview\(project\.metaPreview\)/);
  assert.match(listCard, /metaPreview\.metas\.map/);
  assert.doesNotMatch(portal, /ongoingProjectDetails/);
  assert.match(list, /projects\.length === 0/);
  assert.match(list, /projects\.length === 1/);
  assert.match(list, /projects\.length >= 6/);
  assert.match(list, /groupCounts\[item\.value\]/);
  assert.match(accountRoute, /role === "staff" \|\| role === "admin"/);
  assert.match(accountRoute, /<ClientPortalHome firstName=/);
  assert.match(accountRoute, /loadClientPortalData/);
  assert.match(accountRoute, /initialData=\{initialData\}/);
  assert.match(accountRoute, /showWorkAccess=\{false\}/);
});

test("client account navigation separates the portal from editable profile settings", () => {
  const clientFrame = readFileSync(join(process.cwd(), "packages/app-shell/src/components/client-portal-frame.tsx"), "utf8");
  const accountMenu = readFileSync(join(process.cwd(), "packages/app-shell/src/components/account-menu.tsx"), "utf8");
  const previewProfile = readFileSync(join(process.cwd(), "apps/platform-preview/app/(shell)/account/perfil/page.tsx"), "utf8");
  const templateProfile = readFileSync(join(process.cwd(), "packages/create-bw-app/template/modules/projects/app/(shell)/account/perfil/page.tsx"), "utf8");
  const accountRoute = source("client/account-routes.tsx");

  assert.match(clientFrame, /href="\/account\/perfil"/);
  assert.match(accountMenu, /Perfil e segurança/);
  assert.match(accountMenu, /O meu espaço/);
  assert.match(accountMenu, /InitialsAvatar/);
  assert.match(accountMenu, /tone=\{avatarTone\}/);
  assert.doesNotMatch(accountMenu, /function avatarRoleClass/);
  assert.match(previewProfile, /ClientProfilePage/);
  assert.match(templateProfile, /ClientProfilePage/);
  assert.match(accountRoute, /ClientOrganizationMemberships/);
  assert.match(accountRoute, /listClientOrganizations/);
  assert.match(accountRoute, /organization\.role === "admin"/);
  assert.match(accountRoute, /supplementaryContent=/);
  assert.doesNotMatch(accountRoute, /<Link/);
});

test("client loading states mirror the home, list and detail page geometries", () => {
  const loading = source("client/projects-loading.tsx");
  const accountRoute = source("client/account-routes.tsx");
  const listPage = source("client/projects-list-page.tsx");
  const detailPage = source("client/project-detail-page.tsx");
  assert.match(loading, /ClientPortalHomeLoading/);
  assert.match(loading, /SkeletonCard className="h-72 shadow-none" lines=\{4\}/);
  assert.match(loading, /lg:grid-cols-\[minmax\(0,1fr\)_18rem\]/);
  assert.match(loading, /ClientProjectsListLoading/);
  assert.match(loading, /md:grid-cols-2/);
  assert.match(loading, /ClientProjectDetailLoading/);
  assert.match(loading, /max-w-\[52rem\]/);
  assert.match(accountRoute, /loadClientPortalData/);
  assert.match(listPage, /initialProjects=\{initialProjects\}/);
  assert.match(detailPage, /initialProject=\{initialProject\}/);
});

test("client shell and internal route guards keep clients out of the staff portal", () => {
  const clientFrame = readFileSync(join(process.cwd(), "packages/app-shell/src/components/client-portal-frame.tsx"), "utf8");
  const previewRoot = readFileSync(join(process.cwd(), "apps/platform-preview/app/page.tsx"), "utf8");
  const previewShell = readFileSync(join(process.cwd(), "apps/platform-preview/app/(shell)/shell-layout-client.tsx"), "utf8");
  const dashboard = readFileSync(join(process.cwd(), "apps/platform-preview/app/(shell)/dashboard/page.tsx"), "utf8");
  const crm = readFileSync(join(process.cwd(), "packages/module-crm/src/registration.ts"), "utf8");

  assert.match(clientFrame, /O meu espaço/);
  assert.match(clientFrame, /Os meus projetos/);
  assert.doesNotMatch(clientFrame, /CRM|Marketing|Dashboard/);
  assert.match(previewRoot, /requireServerPageRoleAccess\(\["admin", "staff"\]\)/);
  assert.match(previewShell, /if \(!viewer\.isStaff && !viewer\.isAdmin\)/);
  assert.match(previewShell, /<ClientPortalFrame/);
  assert.match(dashboard, /requireServerPageRoleAccess\(\["admin", "staff"\]\)/);
  assert.equal((crm.match(/visibility: "staff"/g) ?? []).length, 3);
});
