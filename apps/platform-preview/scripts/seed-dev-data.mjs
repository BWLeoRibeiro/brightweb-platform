import { createClient } from "@supabase/supabase-js";

const DEFAULT_EMAIL = "dev@brightweblabs.test";
const DEFAULT_PASSWORD = "BrightWebDev!36";
const CLIENT_EMAIL = "orgadmin@bright-harbor.test";
const CLIENT_PASSWORD = "BrightWebOrgAdmin!36";
const CLIENT_PROJECT_REQUEST_ID = "36000000-0000-4000-8000-000000000026";
const STAFF_PROJECT_REQUEST_ID = "36000000-0000-4000-8000-000000000037";
const STAFF_PASSWORD = "BrightWebStaff!36";
const STAFF_USERS = [
  { email: "staff.owner@brightweblabs.test", firstName: "Sara", lastName: "Owner" },
  { email: "staff.candidate@brightweblabs.test", firstName: "Tiago", lastName: "Candidate" },
];

const ORGANIZATIONS = [
  {
    id: "36000000-0000-4000-8000-000000000001",
    name: "Bright Harbor Studio",
    industry: "Design",
    company_size: "10-50",
    budget_range: "25.000 € - 50.000 €",
    website_url: "https://bright-harbor.example",
    address: "Lisboa",
    tax_identifier_value: "PT536000001",
    tax_identifier_kind: "vat",
    tax_identifier_country_code: "PT",
  },
  {
    id: "36000000-0000-4000-8000-000000000002",
    name: "Northwind Renewables",
    industry: "Energy",
    company_size: "50-100",
    budget_range: "50.000 € - 100.000 €",
    website_url: "https://northwind-renewables.example",
    address: "Porto",
    tax_identifier_value: "PT536000002",
    tax_identifier_kind: "vat",
    tax_identifier_country_code: "PT",
  },
  {
    id: "36000000-0000-4000-8000-000000000003",
    name: "Tagus Product Lab",
    industry: "Technology",
    company_size: "1-10",
    budget_range: "10.000 € - 25.000 €",
    website_url: "https://tagus-product.example",
    address: "Oeiras",
    tax_identifier_value: "PT536000003",
    tax_identifier_kind: "vat",
    tax_identifier_country_code: "PT",
  },
];

const CONTACTS = [
  {
    id: "36000000-0000-4000-9000-000000000001",
    organization_id: ORGANIZATIONS[0].id,
    first_name: "Inês",
    last_name: "Correia",
    email: "ines.correia@bright-harbor.example",
    phone: "+351910360001",
    status: "lead",
    source: "website",
  },
  {
    id: "36000000-0000-4000-9000-000000000002",
    organization_id: ORGANIZATIONS[1].id,
    first_name: "Tomás",
    last_name: "Mendes",
    email: "tomas.mendes@northwind-renewables.example",
    phone: "+351910360002",
    status: "qualified",
    source: "referral",
  },
  {
    id: "36000000-0000-4000-9000-000000000003",
    organization_id: ORGANIZATIONS[2].id,
    first_name: "Marta",
    last_name: "Baptista",
    email: "marta.baptista@tagus-product.example",
    phone: "+351910360003",
    status: "proposal",
    source: "event",
  },
  {
    id: "36000000-0000-4000-9000-000000000004",
    organization_id: ORGANIZATIONS[0].id,
    first_name: "Rui",
    last_name: "Almeida",
    email: "rui.almeida@bright-harbor.example",
    phone: "+351910360004",
    status: "won",
    source: "partner",
  },
  {
    id: "36000000-0000-4000-9000-000000000005",
    organization_id: ORGANIZATIONS[1].id,
    first_name: "Sofia",
    last_name: "Neves",
    email: "sofia.neves@northwind-renewables.example",
    phone: "+351910360005",
    status: "lost",
    source: "outbound",
  },
];

function readOption(name) {
  const inline = process.argv.find((argument) => argument.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function requireResult(promise, operation) {
  const result = await promise;
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}

async function requireCount(promise, operation) {
  const result = await promise;
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.count ?? 0;
}

// GoTrue auth-admin calls. New-format secret keys (sb_secret_*) are rejected by
// GoTrue when sent as `Authorization: Bearer` (it parses them as a JWT and fails
// with bad_jwt/ES256), while the local Supabase CLI still returns a service-role
// JWT that requires the bearer header. Support both key formats explicitly.
async function authAdmin(path, { method = "GET", body } = {}) {
  const base = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const secret = requiredEnv("SUPABASE_SECRET_DEFAULT_KEY");
  const headers = { apikey: secret, "Content-Type": "application/json" };
  if (secret.startsWith("eyJ")) headers.Authorization = `Bearer ${secret}`;
  // Some GoTrue replicas intermittently reject the new-format secret key with a
  // spurious bad_jwt/ES256 error (~20%). PostgREST and the login path are stable;
  // this only hits auth-admin ops, so retry transient bad_jwt failures.
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const response = await fetch(`${base}/auth/v1${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => ({}));
    if (response.ok) return json;
    const message = json.msg ?? json.error ?? JSON.stringify(json);
    lastError = new Error(`Auth admin ${method} ${path} failed (${response.status}): ${message}`);
    const transient = json.error_code === "bad_jwt" || /bad_jwt|unrecognized JWT/i.test(message);
    if (!transient) throw lastError;
    await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
  }
  throw lastError;
}

async function findUserByEmail(email) {
  const perPage = 1000;
  for (let page = 1; page <= 10; page += 1) {
    const data = await authAdmin(`/admin/users?page=${page}&per_page=${perPage}`);
    const users = data.users ?? [];
    const user = users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (user || users.length < perPage) return user ?? null;
  }
  throw new Error("Could not finish searching Auth users after 10 pages.");
}

async function upsertAuthUser(email, password, firstName, lastName) {
  const existing = await findUserByEmail(email);
  const body = {
    password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  };
  return existing
    ? authAdmin(`/admin/users/${existing.id}`, { method: "PUT", body })
    : authAdmin("/admin/users", { method: "POST", body: { ...body, email } });
}

async function main() {
  const email = (readOption("email") ?? process.env.SEED_USER_EMAIL ?? DEFAULT_EMAIL).trim().toLowerCase();
  const password = readOption("password") ?? process.env.SEED_USER_PASSWORD ?? DEFAULT_PASSWORD;
  if (!email || !email.includes("@")) throw new Error("Seed user email is invalid.");
  if (password.length < 8) throw new Error("Seed user password must contain at least 8 characters.");

  const supabase = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SECRET_DEFAULT_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async (...args) => {
          try {
            return await fetch(...args);
          } catch {
            throw new Error("Supabase network request failed.");
          }
        },
      },
    },
  );

  const user = await upsertAuthUser(email, password, "Dev", "Admin");

  const profile = await requireResult(
    supabase
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          email,
          first_name: "Dev",
          last_name: "Admin",
        },
        { onConflict: "user_id" },
      )
      .select("id")
      .single(),
    "Could not upsert seed profile",
  );

  await requireResult(
    supabase
      .from("roles")
      .upsert({ code: "admin", label: "Admin" }, { onConflict: "code" }),
    "Could not ensure admin role",
  );
  await requireResult(
    supabase
      .from("user_role_assignments")
      .upsert(
        {
          profile_id: profile.id,
          role_code: "admin",
          assigned_by_profile_id: profile.id,
          reason: "platform_preview_dev_seed",
        },
        { onConflict: "profile_id" },
      ),
    "Could not assign seed admin role",
  );

  await requireResult(
    supabase.from("roles").upsert({ code: "staff", label: "Staff" }, { onConflict: "code" }),
    "Could not ensure staff role",
  );
  const staffProfiles = [];
  for (const staff of STAFF_USERS) {
    const staffUser = await upsertAuthUser(
      staff.email,
      STAFF_PASSWORD,
      staff.firstName,
      staff.lastName,
    );
    const staffProfile = await requireResult(
      supabase
        .from("profiles")
        .upsert(
          {
            user_id: staffUser.id,
            email: staff.email,
            first_name: staff.firstName,
            last_name: staff.lastName,
          },
          { onConflict: "user_id" },
        )
        .select("id")
        .single(),
      `Could not upsert seed staff profile: ${staff.email}`,
    );
    await requireResult(
      supabase.from("user_role_assignments").upsert({
        profile_id: staffProfile.id,
        role_code: "staff",
        assigned_by_profile_id: profile.id,
        reason: "platform_preview_staff_seed",
      }, { onConflict: "profile_id" }),
      `Could not assign seed staff role: ${staff.email}`,
    );
    staffProfiles.push(staffProfile);
  }

  await requireResult(
    supabase.from("organizations").upsert(ORGANIZATIONS, { onConflict: "id" }),
    "Could not upsert seed organizations",
  );

  const clientUser = await upsertAuthUser(CLIENT_EMAIL, CLIENT_PASSWORD, "Olívia", "Martins");
  const clientProfile = await requireResult(
    supabase
      .from("profiles")
      .upsert({ user_id: clientUser.id, email: CLIENT_EMAIL, first_name: "Olívia", last_name: "Martins" }, { onConflict: "user_id" })
      .select("id")
      .single(),
    "Could not upsert seed client profile",
  );
  await requireResult(
    supabase.from("roles").upsert({ code: "client", label: "Client" }, { onConflict: "code" }),
    "Could not ensure client role",
  );
  await requireResult(
    supabase.from("user_role_assignments").upsert({
      profile_id: clientProfile.id,
      role_code: "client",
      assigned_by_profile_id: profile.id,
      reason: "platform_preview_client_seed",
    }, { onConflict: "profile_id" }),
    "Could not assign seed client role",
  );
  await requireResult(
    supabase.from("organization_members").upsert([
      { organization_id: ORGANIZATIONS[0].id, profile_id: clientProfile.id, role: "admin" },
      { organization_id: ORGANIZATIONS[1].id, profile_id: clientProfile.id, role: "member" },
      { organization_id: ORGANIZATIONS[2].id, profile_id: clientProfile.id, role: "member" },
    ], { onConflict: "organization_id,profile_id" }),
    "Could not assign seed client organizations",
  );
  await requireResult(
    supabase
      .from("crm_contacts")
      .upsert(
        CONTACTS.map((contact) => ({
          ...contact,
          owner_id: profile.id,
        })),
        { onConflict: "id" },
      ),
    "Could not upsert seed CRM contacts",
  );

  const statusLog = [
    {
      id: "36000000-0000-4000-a000-000000000001",
      contact_id: CONTACTS[1].id,
      previous_status: "lead",
      new_status: "qualified",
      reason: "Discovery call completed",
      changed_by_user_id: user.id,
      changed_at: "2026-07-20T10:00:00.000Z",
    },
    {
      id: "36000000-0000-4000-a000-000000000002",
      contact_id: CONTACTS[3].id,
      previous_status: "proposal",
      new_status: "won",
      reason: "Proposal accepted",
      changed_by_user_id: user.id,
      changed_at: "2026-07-21T14:30:00.000Z",
    },
  ];
  await requireResult(
    supabase.from("crm_status_log").upsert(statusLog, { onConflict: "id" }),
    "Could not upsert seed CRM status timeline",
  );

  const authenticatedAdmin = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
  );
  await requireResult(
    authenticatedAdmin.auth.signInWithPassword({ email, password }),
    "Could not authenticate seed admin",
  );
  const CLIENT_PROJECTS = [
    {
      requestId: CLIENT_PROJECT_REQUEST_ID,
      organizationId: ORGANIZATIONS[0].id,
      name: "Portal Aurora",
      code: "AUR-26",
      status: "active",
      start_date: "2026-07-01",
      target_date: "2026-10-30",
      client_summary: "Uma nova presença digital para apresentar a marca, os serviços e criar novas oportunidades.",
      client_scope: "Estratégia, direção visual, design e desenvolvimento do novo portal.",
      milestones: [
        { id: "36000000-0000-4000-b000-000000000001", title: "Direção visual aprovada", status: "in_progress", target_date: "2026-08-18", position: 1 },
      ],
    },
    {
      requestId: "36000000-0000-4000-8000-000000000027",
      organizationId: ORGANIZATIONS[1].id,
      name: "Plataforma Solar Norte",
      code: "NWR-11",
      status: "active",
      start_date: "2026-05-12",
      target_date: "2026-11-20",
      client_summary: "Plataforma de gestão e acompanhamento dos parques solares em operação.",
      client_scope: "Arquitetura, design da plataforma e desenvolvimento por fases.",
      milestones: [
        { id: "36000000-0000-4000-b000-000000000011", title: "Modelo de dados validado", status: "achieved", target_date: "2026-06-30", position: 1 },
        { id: "36000000-0000-4000-b000-000000000012", title: "Dashboard operacional", status: "in_progress", target_date: "2026-09-15", position: 2 },
      ],
    },
    {
      requestId: "36000000-0000-4000-8000-000000000028",
      organizationId: ORGANIZATIONS[1].id,
      name: "Relatório de Sustentabilidade",
      code: "NWR-14",
      status: "active",
      start_date: "2026-07-06",
      target_date: "2026-12-18",
      client_summary: "Micro-site anual com os resultados de sustentabilidade e impacto.",
      milestones: [
        { id: "36000000-0000-4000-b000-000000000013", title: "Estrutura de conteúdos", status: "pending", target_date: "2026-09-30", position: 1 },
      ],
    },
    {
      requestId: "36000000-0000-4000-8000-000000000029",
      organizationId: ORGANIZATIONS[1].id,
      name: "App de Monitorização",
      code: "NWR-08",
      status: "canceled",
      cancellation_reason: "Substituída pela plataforma web de monitorização.",
      start_date: "2026-02-02",
      target_date: "2026-06-30",
      client_summary: "Aplicação móvel de monitorização em tempo real, substituída pela plataforma web.",
      milestones: [],
    },
    {
      requestId: "36000000-0000-4000-8000-000000000030",
      organizationId: ORGANIZATIONS[1].id,
      name: "Website Corporativo",
      code: "NWR-05",
      status: "completed",
      start_date: "2025-11-03",
      target_date: "2026-03-31",
      client_summary: "Novo website corporativo com foco em recrutamento e comunicação institucional.",
      milestones: [
        { id: "36000000-0000-4000-b000-000000000014", title: "Lançamento público", status: "achieved", target_date: "2026-03-25", position: 1 },
      ],
    },
    {
      requestId: "36000000-0000-4000-8000-000000000031",
      organizationId: ORGANIZATIONS[2].id,
      name: "Portal do Produto",
      code: "TPL-01",
      status: "active",
      start_date: "2026-06-01",
      target_date: "2026-10-15",
      client_summary: "Portal público de apresentação do produto e captação de interessados.",
      milestones: [
        { id: "36000000-0000-4000-b000-000000000015", title: "Protótipo navegável", status: "achieved", target_date: "2026-07-15", position: 1 },
        { id: "36000000-0000-4000-b000-000000000016", title: "Conteúdos finais", status: "in_progress", target_date: "2026-09-01", position: 2 },
      ],
    },
    {
      requestId: "36000000-0000-4000-8000-000000000032",
      organizationId: ORGANIZATIONS[2].id,
      name: "Aplicação Móvel",
      code: "TPL-02",
      status: "active",
      start_date: "2026-06-15",
      target_date: "2026-12-10",
      client_summary: "Aplicação móvel complementar para clientes finais.",
      milestones: [],
    },
    {
      requestId: "36000000-0000-4000-8000-000000000033",
      organizationId: ORGANIZATIONS[2].id,
      name: "Design System",
      code: "TPL-03",
      status: "active",
      start_date: "2026-05-05",
      target_date: "2026-09-30",
      client_summary: "Sistema de design partilhado entre o portal e a aplicação.",
      milestones: [
        { id: "36000000-0000-4000-b000-000000000017", title: "Fundações e tokens", status: "achieved", target_date: "2026-06-20", position: 1 },
        { id: "36000000-0000-4000-b000-000000000018", title: "Componentes core", status: "delayed", target_date: "2026-08-05", position: 2 },
      ],
    },
    {
      requestId: "36000000-0000-4000-8000-000000000034",
      organizationId: ORGANIZATIONS[2].id,
      name: "Automação de Marketing",
      code: "TPL-04",
      status: "active",
      start_date: "2026-07-20",
      target_date: "2027-01-15",
      client_summary: "Fluxos de email e nutrição de leads integrados com o CRM.",
      milestones: [],
    },
    {
      requestId: "36000000-0000-4000-8000-000000000035",
      organizationId: ORGANIZATIONS[2].id,
      name: "Integração CRM",
      code: "TPL-05",
      status: "active",
      start_date: "2026-08-03",
      target_date: "2026-11-28",
      client_summary: "Integração do portal com o CRM para sincronizar contactos e pedidos.",
      milestones: [
        { id: "36000000-0000-4000-b000-000000000019", title: "Mapeamento de campos", status: "in_progress", target_date: "2026-09-10", position: 1 },
      ],
    },
    {
      requestId: "36000000-0000-4000-8000-000000000036",
      organizationId: ORGANIZATIONS[2].id,
      name: "Lançamento Atlas",
      code: "TPL-06",
      status: "active",
      start_date: "2026-07-01",
      target_date: "2026-10-30",
      client_summary: "Preparação e lançamento de uma nova experiência digital, da descoberta à entrada em produção.",
      client_scope: "Estratégia, design, desenvolvimento, validação e acompanhamento do lançamento.",
      milestones: [
        { id: "36000000-0000-4000-b000-000000000020", title: "Descoberta técnica", status: "achieved", target_date: "2026-07-10", position: 1 },
        { id: "36000000-0000-4000-b000-000000000021", title: "Arquitetura aprovada", status: "achieved", target_date: "2026-07-21", position: 2 },
        { id: "36000000-0000-4000-b000-000000000022", title: "Direção visual", status: "achieved", target_date: "2026-08-07", position: 3 },
        { id: "36000000-0000-4000-b000-000000000023", title: "Protótipo navegável", status: "achieved", target_date: "2026-09-01", position: 4 },
        { id: "36000000-0000-4000-b000-000000000024", title: "Conteúdos validados", status: "achieved", target_date: "2026-09-01", position: 5 },
        { id: "36000000-0000-4000-b000-000000000025", title: "Desenvolvimento principal", status: "in_progress", target_date: "2026-09-18", position: 6 },
        { id: "36000000-0000-4000-b000-000000000026", title: "Testes de integração", status: "pending", target_date: "2026-09-25", position: 7 },
        { id: "36000000-0000-4000-b000-000000000027", title: "Revisão com a equipa", status: "pending", target_date: "2026-10-02", position: 8 },
        { id: "36000000-0000-4000-b000-000000000028", title: "Preparação de produção", status: "pending", target_date: "2026-10-02", position: 9 },
        { id: "36000000-0000-4000-b000-000000000029", title: "Entrada em produção", status: "pending", target_date: "2026-10-16", position: 10 },
      ],
      materials: [
        { id: "36000000-0000-4000-c000-000000000001", label: "Brief e objetivos do projeto", url: "https://example.com/lancamento-atlas/brief", kind: "doc", created_at: "2026-07-02T09:00:00.000Z" },
        { id: "36000000-0000-4000-c000-000000000002", label: "Planeamento de conteúdos", url: "https://example.com/lancamento-atlas/conteudos", kind: "sheet", created_at: "2026-07-18T10:30:00.000Z" },
        { id: "36000000-0000-4000-c000-000000000003", label: "Pasta partilhada do projeto", url: "https://example.com/lancamento-atlas/ficheiros", kind: "drive", created_at: "2026-08-04T14:00:00.000Z" },
        { id: "36000000-0000-4000-c000-000000000004", label: "Protótipo navegável — versão para validação", url: "https://example.com/lancamento-atlas/prototipo", kind: "other", created_at: "2026-08-12T15:45:00.000Z" },
        { id: "36000000-0000-4000-c000-000000000005", label: "Relatório de testes de usabilidade", url: "https://example.com/lancamento-atlas/testes", kind: "doc", created_at: "2026-08-13T11:15:00.000Z" },
      ],
    },
    {
      requestId: STAFF_PROJECT_REQUEST_ID,
      organizationId: ORGANIZATIONS[0].id,
      name: "Equipa interna — cenário de teste",
      code: "TEAM-QA",
      status: "active",
      start_date: "2026-08-14",
      target_date: "2026-09-30",
      client_summary: "Projeto local para validar a gestão da equipa interna.",
      milestones: [],
    },
  ];

  for (const seedProject of CLIENT_PROJECTS) {
    const projectOwnerProfileId = seedProject.requestId === STAFF_PROJECT_REQUEST_ID
      ? staffProfiles[0].id
      : profile.id;
    const creation = await requireResult(
      authenticatedAdmin.rpc("create_project_with_client_access", {
        p_request_id: seedProject.requestId,
        p_project: {
          primary_organization_id: seedProject.organizationId,
          name: seedProject.name,
          code: seedProject.code,
          status: seedProject.status,
          start_date: seedProject.start_date,
          target_date: seedProject.target_date,
          client_summary: seedProject.client_summary,
          ...(seedProject.client_scope ? { client_scope: seedProject.client_scope } : {}),
          ...(seedProject.cancellation_reason ? { cancellation_reason: seedProject.cancellation_reason } : {}),
          client_contact_profile_id: projectOwnerProfileId,
        },
        p_organization_ids: [seedProject.organizationId],
        p_members: [{ profile_id: projectOwnerProfileId, role: "owner" }],
        p_client_access: { mode: "all_org_clients", organization_ids: [seedProject.organizationId], profile_grants: [] },
      }),
      `Could not create seed client project: ${seedProject.name}`,
    );
    const seedProjectId = creation?.[0]?.project_id;
    if (!seedProjectId) throw new Error(`Seed client project did not return an id: ${seedProject.name}`);
    if (seedProject.milestones.length > 0) {
      await requireResult(
        authenticatedAdmin.from("project_milestones").upsert(
          seedProject.milestones.map((milestone) => ({
            ...milestone,
            project_id: seedProjectId,
            visibility: "client",
          })),
          { onConflict: "id" },
        ),
        `Could not upsert seed client milestones: ${seedProject.name}`,
      );
    }
    if (seedProject.materials?.length > 0) {
      await requireResult(
        authenticatedAdmin.from("project_links").upsert(
          seedProject.materials.map((material) => ({
            ...material,
            project_id: seedProjectId,
            visibility: "client",
          })),
          { onConflict: "id" },
        ),
        `Could not upsert seed client materials: ${seedProject.name}`,
      );
    }
  }

  const [profiles, assignments, organizations, contacts, timeline] = await Promise.all([
    requireCount(
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      "Could not count seed profiles",
    ),
    requireCount(
      supabase.from("user_role_assignments").select("id", { count: "exact", head: true }).eq("profile_id", profile.id),
      "Could not count seed role assignments",
    ),
    requireCount(
      supabase.from("organizations").select("id", { count: "exact", head: true }).in("id", ORGANIZATIONS.map(({ id }) => id)),
      "Could not count seed organizations",
    ),
    requireCount(
      supabase.from("crm_contacts").select("id", { count: "exact", head: true }).in("id", CONTACTS.map(({ id }) => id)),
      "Could not count seed CRM contacts",
    ),
    requireCount(
      supabase.from("crm_status_log").select("id", { count: "exact", head: true }).in("id", statusLog.map(({ id }) => id)),
      "Could not count seed CRM timeline rows",
    ),
  ]);

  console.log("Development seed complete.");
  console.log(`User: ${email}`);
  console.log(`Staff owner: ${STAFF_USERS[0].email}`);
  console.log(`Staff candidate: ${STAFF_USERS[1].email}`);
  console.log(`Client: ${CLIENT_EMAIL}`);
  console.log(`Profiles: ${profiles}`);
  console.log(`Role assignments: ${assignments}`);
  console.log(`Organizations: ${organizations}`);
  console.log(`CRM contacts: ${contacts}`);
  console.log(`CRM timeline rows: ${timeline}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
