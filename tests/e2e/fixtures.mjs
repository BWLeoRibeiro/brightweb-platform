// Canned Supabase REST fixtures for the generated-app runtime smoke test.
//
// Tables and row shapes mirror what the generated platform app actually queries:
// - packages/core-auth/src/server.ts        (profiles, rpc current_global_role)
// - packages/module-projects/src/data.ts    (projects, project_tasks, project_milestones, organizations)
// - packages/module-projects/src/dashboard.ts
// - packages/module-crm/src/data.ts         (crm_contacts, crm_status_log, organizations, profiles,
//                                            user_role_assignments)
// Embedded-resource aliases (organizations, owner, primary_contact, projects, profile)
// are stored directly on the rows: the stub returns whole rows regardless of the
// requested `select`, and PostgREST clients ignore extra keys.

export const USER_ID = "11111111-1111-4111-8111-111111111111";
export const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
export const SECOND_PROFILE_ID = "22222222-2222-4222-8222-222222222223";
export const ORG_ID = "33333333-3333-4333-8333-333333333333";
export const USER_EMAIL = "smoke@example.com";
export const USER_PASSWORD = "Smoke-Test-1234";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const now = Date.now();
const iso = (daysFromNow) => new Date(now + daysFromNow * DAY_IN_MS).toISOString();
const dateOnly = (daysFromNow) => iso(daysFromNow).slice(0, 10);

const profileRow = {
  id: PROFILE_ID,
  user_id: USER_ID,
  first_name: "Ana",
  last_name: "Silva",
  email: USER_EMAIL,
  phone: "+351910000000",
  created_at: iso(-400),
  updated_at: iso(-1),
};

const profileEmbed = {
  id: PROFILE_ID,
  first_name: "Ana",
  last_name: "Silva",
  email: USER_EMAIL,
  phone: "+351910000000",
  created_at: profileRow.created_at,
  updated_at: profileRow.updated_at,
};

const secondProfileRow = {
  id: SECOND_PROFILE_ID,
  user_id: "11111111-1111-4111-8111-111111111112",
  first_name: "Rui",
  last_name: "Teste",
  email: "rui@example.com",
  phone: null,
  created_at: iso(-100),
  updated_at: iso(-2),
};

const secondProfileEmbed = {
  id: SECOND_PROFILE_ID,
  first_name: "Rui",
  last_name: "Teste",
  email: "rui@example.com",
  created_at: secondProfileRow.created_at,
  updated_at: secondProfileRow.updated_at,
};

const organizationRow = {
  id: ORG_ID,
  name: "Acme Consultoria",
  industry: "consulting",
  company_size: "11-50",
  website_url: "https://acme.example.com",
  created_at: iso(-300),
  updated_at: iso(-2),
  primary_contact_id: PROFILE_ID,
  primary_contact: profileEmbed,
};

const organizationEmbed = { name: organizationRow.name, primary_contact: profileEmbed };

function projectRow(id, overrides) {
  return {
    id,
    organization_id: ORG_ID,
    name: "Projeto",
    code: null,
    status: "active",
    health: "on_track",
    owner_profile_id: PROFILE_ID,
    activated_at: iso(-60),
    target_date: dateOnly(30),
    completed_at: null,
    cancellation_reason: null,
    summary: "Projeto de teste do smoke runtime.",
    created_at: iso(-90),
    updated_at: iso(-1),
    organizations: organizationEmbed,
    owner: profileEmbed,
    ...overrides,
  };
}

const PROJECT_OVERDUE_ID = "44444444-4444-4444-8444-444444444401";
const PROJECT_ACTIVE_ID = "44444444-4444-4444-8444-444444444402";
const PROJECT_PLANNED_ID = "44444444-4444-4444-8444-444444444403";

const projects = [
  projectRow(PROJECT_OVERDUE_ID, {
    name: "Website Redesign",
    code: "ACM-01",
    target_date: dateOnly(-10),
  }),
  projectRow(PROJECT_ACTIVE_ID, {
    name: "Migração CRM",
    code: "ACM-02",
    owner_profile_id: null,
    owner: null,
  }),
  projectRow(PROJECT_PLANNED_ID, {
    name: "Portal Interno",
    code: "ACM-03",
    status: "planned",
    activated_at: null,
  }),
];

function taskRow(id, overrides) {
  return {
    id,
    project_id: PROJECT_OVERDUE_ID,
    milestone_id: null,
    title: "Tarefa",
    description: null,
    status: "todo",
    priority: "medium",
    assignee_profile_id: PROFILE_ID,
    reporter_profile_id: PROFILE_ID,
    due_date: dateOnly(3),
    blocked_reason: null,
    position: 1,
    created_at: iso(-30),
    updated_at: iso(-1),
    projects: { name: "Website Redesign", code: "ACM-01" },
    ...overrides,
  };
}

const projectTasks = [
  taskRow("55555555-5555-4555-8555-555555555501", {
    title: "Rever wireframes",
    due_date: dateOnly(-2),
  }),
  taskRow("55555555-5555-4555-8555-555555555502", {
    title: "Implementar homepage",
    status: "in_progress",
    priority: "high",
    due_date: dateOnly(4),
  }),
  taskRow("55555555-5555-4555-8555-555555555503", {
    title: "Configurar dominio",
    status: "blocked",
    priority: "urgent",
    blocked_reason: "A aguardar acesso DNS.",
    due_date: dateOnly(1),
  }),
  taskRow("55555555-5555-4555-8555-555555555504", {
    title: "Exportar contactos",
    project_id: PROJECT_ACTIVE_ID,
    status: "done",
    due_date: dateOnly(-5),
    projects: { name: "Migração CRM", code: "ACM-02" },
  }),
];

const projectTaskStats = [
  { project_id: PROJECT_OVERDUE_ID, total: 3, done: 0, overdue: 1, blocked: 1 },
  { project_id: PROJECT_ACTIVE_ID, total: 1, done: 1, overdue: 0, blocked: 0 },
  { project_id: PROJECT_PLANNED_ID, total: 0, done: 0, overdue: 0, blocked: 0 },
];

const projectMilestones = [
  {
    id: "66666666-6666-4666-8666-666666666601",
    project_id: PROJECT_OVERDUE_ID,
    title: "Lançamento beta",
    status: "pending",
    target_date: dateOnly(14),
    completed_at: null,
    position: 1,
    created_at: iso(-30),
    updated_at: iso(-1),
  },
  {
    id: "66666666-6666-4666-8666-666666666602",
    project_id: PROJECT_ACTIVE_ID,
    title: "Dados migrados",
    status: "achieved",
    target_date: dateOnly(-7),
    completed_at: iso(-7),
    position: 1,
    created_at: iso(-60),
    updated_at: iso(-7),
  },
];

function contactRow(id, overrides) {
  return {
    id,
    first_name: "Contacto",
    last_name: null,
    email: null,
    phone: null,
    status: "lead",
    source: "manual",
    owner_id: PROFILE_ID,
    organization_id: ORG_ID,
    created_at: iso(-20),
    updated_at: iso(-1),
    organizations: { name: organizationRow.name },
    ...overrides,
  };
}

const crmContacts = [
  contactRow("77777777-7777-4777-8777-777777777701", {
    first_name: "Bruno",
    last_name: "Costa",
    email: "bruno@example.com",
    status: "lead",
    created_at: iso(-2),
  }),
  contactRow("77777777-7777-4777-8777-777777777702", {
    first_name: "Carla",
    last_name: "Marques",
    email: "carla@example.com",
    status: "lead",
    owner_id: null,
    organization_id: null,
    organizations: null,
    created_at: iso(-4),
  }),
  contactRow("77777777-7777-4777-8777-777777777703", {
    first_name: "Diogo",
    last_name: "Pereira",
    email: "diogo@example.com",
    status: "qualified",
    created_at: iso(-15),
  }),
  contactRow("77777777-7777-4777-8777-777777777704", {
    first_name: "Eva",
    last_name: "Rocha",
    email: "eva@example.com",
    status: "proposal",
    created_at: iso(-40),
  }),
  contactRow("77777777-7777-4777-8777-777777777705", {
    first_name: "Filipe",
    last_name: "Gomes",
    email: "filipe@example.com",
    status: "won",
    created_at: iso(-120),
  }),
];

const crmStatusLog = [
  {
    id: "88888888-8888-4888-8888-888888888801",
    contact_id: "77777777-7777-4777-8777-777777777703",
    previous_status: "lead",
    new_status: "qualified",
    reason: null,
    changed_at: iso(-3),
    changed_by_user_id: USER_ID,
  },
  {
    id: "88888888-8888-4888-8888-888888888802",
    contact_id: "77777777-7777-4777-8777-777777777705",
    previous_status: "proposal",
    new_status: "won",
    reason: "Contrato assinado.",
    changed_at: iso(-10),
    changed_by_user_id: USER_ID,
  },
];

const userRoleAssignments = [
  {
    profile_id: PROFILE_ID,
    role_code: "admin",
    assigned_at: iso(-200),
    profile: profileEmbed,
  },
  {
    profile_id: SECOND_PROFILE_ID,
    role_code: "client",
    assigned_at: iso(-90),
    profile: secondProfileEmbed,
  },
];

const marketingTopicId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const marketingCampaignId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";

const marketingTopics = [{
  id: marketingTopicId,
  slug: "novidades",
  label: "Novidades",
  description: "Atualizações do produto.",
  is_active: true,
  position: 1,
  created_at: iso(-60),
  updated_at: iso(-1),
}];

const marketingCampaigns = [{
  id: marketingCampaignId,
  name: "Boletim de julho",
  subject: "Novidades BrightWeb",
  preheader: null,
  from_name: "Smoke",
  from_email: "news@example.com",
  topic_id: marketingTopicId,
  segment_id: null,
  body_html: "<p>Olá</p>",
  body_text: "Olá",
  body_json: null,
  status: "draft",
  scheduled_at: null,
  sent_at: null,
  batch_size: 100,
  rate_per_minute: null,
  total_recipients: 0,
  sent_count: 0,
  failed_count: 0,
  created_by_profile_id: PROFILE_ID,
  created_at: iso(-5),
  updated_at: iso(-1),
}];

export const tables = {
  profiles: [profileRow, secondProfileRow],
  organizations: [organizationRow],
  projects,
  project_tasks: projectTasks,
  project_task_stats: projectTaskStats,
  project_milestones: projectMilestones,
  project_members: [],
  organization_members: [],
  crm_contacts: crmContacts,
  crm_status_log: crmStatusLog,
  user_role_assignments: userRoleAssignments,
  admin_user_invitations: [],
  marketing_topics: marketingTopics,
  marketing_campaigns: marketingCampaigns,
  marketing_segments: [],
  marketing_campaign_recipients: [],
  marketing_subscriptions: [],
  marketing_suppressions: [],
  marketing_contact_settings: [],
  marketing_message_events: [],
  marketing_workflows: [],
  marketing_workflow_nodes: [],
  marketing_workflow_runs: [],
  marketing_worker_cursors: [],
};

export const rpcResults = {
  current_global_role: "admin",
};

export const CRM_TOTAL_CONTACTS = crmContacts.length;
