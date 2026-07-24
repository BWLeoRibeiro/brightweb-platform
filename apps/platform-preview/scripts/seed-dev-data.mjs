import { createClient } from "@supabase/supabase-js";

const DEFAULT_EMAIL = "dev@brightweblabs.test";
const DEFAULT_PASSWORD = "BrightWebDev!36";

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
// with bad_jwt/ES256). supabase-js sends the key as both apikey AND bearer, so we
// call the admin endpoints directly with the apikey header only. PostgREST/DB
// calls keep using supabase-js, which works with the secret key.
async function authAdmin(path, { method = "GET", body } = {}) {
  const base = requiredEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  const secret = requiredEnv("SUPABASE_SECRET_DEFAULT_KEY");
  // Some GoTrue replicas intermittently reject the new-format secret key with a
  // spurious bad_jwt/ES256 error (~20%). PostgREST and the login path are stable;
  // this only hits auth-admin ops, so retry transient bad_jwt failures.
  let lastError;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const response = await fetch(`${base}/auth/v1${path}`, {
      method,
      headers: { apikey: secret, "Content-Type": "application/json" },
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

  let user = await findUserByEmail(email);
  if (user) {
    user = await authAdmin(`/admin/users/${user.id}`, {
      method: "PUT",
      body: {
        password,
        email_confirm: true,
        user_metadata: { first_name: "Dev", last_name: "Admin" },
      },
    });
  } else {
    user = await authAdmin("/admin/users", {
      method: "POST",
      body: {
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: "Dev", last_name: "Admin" },
      },
    });
  }

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
    supabase.from("organizations").upsert(ORGANIZATIONS, { onConflict: "id" }),
    "Could not upsert seed organizations",
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
