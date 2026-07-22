import type { ListProjectsParams, ProjectDashboardData, ProjectListItem } from "@brightweblabs/module-projects";
import type { ListProjectsPayload, ProjectsUiClient } from "@brightweblabs/module-projects/ui";

const now = "2026-07-22T10:30:00.000Z";
export const projects: ProjectListItem[] = [
  { id: "aurora", organizationId: "org-atlas", organizationName: "Atlas Studio", organizationOwnerLabel: "Marta Costa", organizationOwnerEmail: "marta@atlas.example", organizationOwnerPhone: "+351912345670", name: "Portal Aurora", code: "AUR-26", status: "active", health: "on_track", ownerProfileId: "owner-leo", ownerLabel: "Leonel Ribeiro", ownerEmail: "leo@brightweb.example", ownerPhone: "+351912345671", activatedAt: "2026-06-01", targetDate: "2026-08-30", completedAt: null, cancellationReason: null, summary: "Nova experiência digital para consolidar conteúdos, serviços e pedidos da Atlas.", createdAt: "2026-05-20T09:00:00.000Z", updatedAt: now, taskStats: { total: 18, done: 11, overdue: 1, blocked: 0 }, milestoneStats: { total: 4, achieved: 2, delayed: 0 } },
  { id: "northstar", organizationId: "org-north", organizationName: "Northstar Foods", organizationOwnerLabel: "Inês Silva", organizationOwnerEmail: "ines@northstar.example", organizationOwnerPhone: null, name: "E-commerce B2B", code: "NST-14", status: "blocked", health: "at_risk", ownerProfileId: "owner-maya", ownerLabel: "Maya Costa", ownerEmail: "maya@brightweb.example", ownerPhone: null, activatedAt: "2026-05-12", targetDate: "2026-07-31", completedAt: null, cancellationReason: null, summary: "Catálogo e encomendas para parceiros profissionais.", createdAt: "2026-04-28T09:00:00.000Z", updatedAt: "2026-07-21T14:20:00.000Z", taskStats: { total: 24, done: 13, overdue: 3, blocked: 2 }, milestoneStats: { total: 5, achieved: 2, delayed: 1 } },
  { id: "fieldnotes", organizationId: "org-field", organizationName: "Field Notes", organizationOwnerLabel: "Tomás Reis", organizationOwnerEmail: "tomas@field.example", organizationOwnerPhone: null, name: "Identidade e website", code: "FLD-09", status: "planned", health: "on_track", ownerProfileId: "owner-leo", ownerLabel: "Leonel Ribeiro", ownerEmail: "leo@brightweb.example", ownerPhone: null, activatedAt: null, targetDate: "2026-10-15", completedAt: null, cancellationReason: null, summary: "Reposicionamento editorial e lançamento do novo website.", createdAt: "2026-07-10T09:00:00.000Z", updatedAt: "2026-07-20T10:00:00.000Z", taskStats: { total: 8, done: 1, overdue: 0, blocked: 0 }, milestoneStats: { total: 3, achieved: 0, delayed: 0 } },
];

export const dashboard: ProjectDashboardData = {
  project: projects[0],
  members: [
    { id: "member-leo", projectId: "aurora", profileId: "owner-leo", role: "owner", createdAt: now, label: "Leonel Ribeiro", email: "leo@brightweb.example", phone: "+351912345671" },
    { id: "member-ana", projectId: "aurora", profileId: "member-ana", role: "contributor", createdAt: now, label: "Ana Matos", email: "ana@brightweb.example", phone: null },
    { id: "member-marta", projectId: "aurora", profileId: "member-marta", role: "observer", createdAt: now, label: "Marta Costa", email: "marta@atlas.example", phone: "+351912345670" },
  ],
  milestones: [
    { id: "milestone-design", projectId: "aurora", title: "Design aprovado", status: "achieved", health: "on_track", targetDate: "2026-06-28", completedAt: "2026-06-26", position: 1, createdAt: now, updatedAt: now },
    { id: "milestone-build", projectId: "aurora", title: "Desenvolvimento", status: "in_progress", health: "on_track", targetDate: "2026-08-10", completedAt: null, position: 2, createdAt: now, updatedAt: now },
  ],
  tasks: [
    { id: "task-home", projectId: "aurora", milestoneId: "milestone-build", title: "Implementar homepage", description: "Traduzir o layout aprovado.", status: "in_progress", health: "on_track", priority: "high", assigneeProfileId: "member-ana", assigneeLabel: "Ana Matos", reporterProfileId: "owner-leo", reporterLabel: "Leonel Ribeiro", dueDate: "2026-07-28", position: 1, blockedReason: null, createdAt: now, updatedAt: now },
    { id: "task-content", projectId: "aurora", milestoneId: "milestone-build", title: "Migrar conteúdos", description: null, status: "todo", health: "at_risk", priority: "medium", assigneeProfileId: "member-marta", assigneeLabel: "Marta Costa", reporterProfileId: "owner-leo", reporterLabel: "Leonel Ribeiro", dueDate: "2026-08-02", position: 2, blockedReason: null, createdAt: now, updatedAt: now },
  ],
  links: [
    { id: "link-figma", projectId: "aurora", label: "Figma", url: "https://figma.com", visibility: "staff", kind: "other", createdAt: now, updatedAt: now },
    { id: "link-staging", projectId: "aurora", label: "Staging", url: "https://example.com", visibility: "client", kind: "other", createdAt: now, updatedAt: now },
  ],
  activity: [
    { id: "activity-1", createdAt: now, eventType: "project_updated", actorProfileId: "owner-leo", actorLabel: "Leonel Ribeiro", summary: "Projeto atualizado", payload: { changes: { summary: { from: null, to: "Nova experiência digital" } } } },
  ],
};

export function listProjects(params: ListProjectsParams = {}): ListProjectsPayload {
  const query = params.search?.toLowerCase();
  const items = projects.filter((project) => (!query || [project.name, project.organizationName, project.code].join(" ").toLowerCase().includes(query)) && (!params.status || project.status === params.status) && (!params.health || project.health === params.health));
  return { items, total: items.length, page: params.page ?? 1, pageSize: params.pageSize ?? 12, attentionSummary: { total: projects.length, overdue: projects.filter((item) => item.taskStats.overdue > 0).length, atRisk: projects.filter((item) => item.health === "at_risk").length } };
}

export const mockProjectsClient: ProjectsUiClient = {
  async requestRaw() { return new Response(JSON.stringify({ data: dashboard, items: [], members: [], organizations: [] }), { status: 200, headers: { "content-type": "application/json" } }); },
  async listProjects(params) { return listProjects(params); }, async getPortfolioStats() { return { total: 3, planned: 1, active: 1, atRisk: 1, overdue: 1 }; }, async getProjectDashboard() { return dashboard; }, async listProjectActivity() { return dashboard.activity; }, async listOrganizations() { return [{ id: "org-atlas", name: "Atlas Studio" }, { id: "org-north", name: "Northstar Foods" }]; }, async listAssignableProfiles() { return []; }, async createOrganization(input) { return { id: "org-preview", name: input.name }; }, async createProject(input) { return { id: "project-preview", name: input.name }; }, async updateProject() { return dashboard; }, async deleteProject() {}, async syncProjectMembers() { return dashboard; }, async createMilestone() { return dashboard; }, async updateMilestone() { return dashboard; }, async deleteMilestone() { return dashboard; }, async createTask() { return dashboard; }, async updateTask() { return dashboard; }, async deleteTask() { return dashboard; }, async createLink() { return dashboard; }, async updateLink() { return dashboard.links; }, async deleteLink() { return dashboard.links; },
};
