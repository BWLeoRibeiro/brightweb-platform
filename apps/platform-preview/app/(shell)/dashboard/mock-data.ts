import type { DashboardCrmData, DashboardDataClient, DashboardInitialData, DashboardProjectsData, DashboardTasksData } from "@brightweblabs/app-shell";
import { projects as previewProjects } from "../projects/mock-data";

const generatedAt = "2026-07-22T10:30:00.000Z";

export const dashboardProjects: DashboardProjectsData = {
  generatedAt,
  kpis: {
    projectsActive: 2,
    projectsAtRisk: 1,
    projectsOverdue: 1,
    projectsDueNext7Days: 1,
    projectsWithoutOwner: 0,
    projectBlockedTasks: 2,
  },
  projects: {
    overdue: previewProjects.map(({ id, organizationName, name, code, status, health, ownerLabel, targetDate, taskStats }) => ({
      id, organizationName, name, code, status, health, ownerLabel, targetDate,
      taskStats: { total: taskStats.total, done: taskStats.done, overdue: taskStats.overdue, blocked: taskStats.blocked },
    })),
  },
};

export const dashboardCrm: DashboardCrmData = {
  generatedAt,
  kpis: {
    crmTotalContacts: 48,
    crmNewLast7Days: 6,
    crmNewLast30Days: 17,
    crmNewLastYear: 48,
    crmUnassignedContacts: 3,
  },
  crm: {
    statusBreakdown: { lead: 16, qualified: 12, proposal: 8, won: 9, lost: 3 },
    recentChanges: [
      { id: "change-ada", contactId: "contact-ada", contactLabel: "Ada Lovelace", previousStatus: "lead", newStatus: "qualified", changedAt: "2026-07-22T08:30:00.000Z" },
    ],
    recentContacts: [
      { id: "contact-ada", name: "Ada Lovelace", company: "Analytical Engines", status: "qualified", lastChangedAt: "2026-07-22T08:30:00.000Z" },
      { id: "contact-grace", name: "Grace Hopper", company: "Compiler Works", status: "proposal", lastChangedAt: "2026-07-21T11:45:00.000Z" },
      { id: "contact-katherine", name: "Katherine Johnson", company: "Orbital Research", status: "lead", lastChangedAt: "2026-07-20T16:20:00.000Z" },
      { id: "contact-margaret", name: "Margaret Hamilton", company: "Lunar Systems", status: "won", lastChangedAt: "2026-07-19T13:10:00.000Z" },
    ],
  },
};

export const dashboardTasks: DashboardTasksData = {
  generatedAt,
  kpis: { total: 5, dueThisWeek: 2, overdue: 1, blocked: 1 },
  tasks: [
    { id: "task-approval", projectId: "aurora", projectName: "Portal Aurora", projectCode: "AUR-26", title: "Validar integração editorial", status: "blocked", priority: "urgent", dueDate: "2026-07-18", blockedReason: "Credenciais externas em falta.", milestoneId: "milestone-build", updatedAt: generatedAt },
    { id: "task-checkout", projectId: "northstar", projectName: "E-commerce B2B", projectCode: "NST-14", title: "Fechar regras do checkout empresarial", status: "in_progress", priority: "high", dueDate: "2026-07-24", blockedReason: null, milestoneId: null, updatedAt: generatedAt },
    { id: "task-home", projectId: "aurora", projectName: "Portal Aurora", projectCode: "AUR-26", title: "Implementar homepage", status: "in_progress", priority: "high", dueDate: "2026-07-28", blockedReason: null, milestoneId: "milestone-build", updatedAt: generatedAt },
    { id: "task-content", projectId: "aurora", projectName: "Portal Aurora", projectCode: "AUR-26", title: "Migrar conteúdos", status: "todo", priority: "medium", dueDate: "2026-08-02", blockedReason: null, milestoneId: "milestone-build", updatedAt: generatedAt },
    { id: "task-research", projectId: "fieldnotes", projectName: "Identidade e website", projectCode: "FLD-09", title: "Consolidar referências editoriais", status: "todo", priority: "low", dueDate: null, blockedReason: null, milestoneId: null, updatedAt: generatedAt },
  ],
};

export const dashboardInitialData: DashboardInitialData = { projects: dashboardProjects, crm: dashboardCrm, tasks: dashboardTasks };

export const dashboardDataClient: DashboardDataClient = {
  async getOverview() { return { data: { projects: dashboardProjects, crm: dashboardCrm } }; },
  async getProjects() { return { data: dashboardProjects }; },
  async getCrm() { return { data: dashboardCrm }; },
  async getTasks() { return { data: dashboardTasks }; },
};
