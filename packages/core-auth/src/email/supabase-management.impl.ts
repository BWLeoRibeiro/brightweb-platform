import type { AuthEmailTemplate, AuthEmailTemplateKind } from "./templates";

const MANAGEMENT_API_BASE_URL = "https://api.supabase.com/v1";

const TEMPLATE_FIELDS = {
  recovery: ["mailer_subjects_recovery", "mailer_templates_recovery_content"],
  magicLink: ["mailer_subjects_magic_link", "mailer_templates_magic_link_content"],
  confirmation: ["mailer_subjects_confirmation", "mailer_templates_confirmation_content"],
  emailChange: ["mailer_subjects_email_change", "mailer_templates_email_change_content"],
  reauthentication: ["mailer_subjects_reauthentication", "mailer_templates_reauthentication_content"],
  passwordChanged: [
    "mailer_subjects_password_changed_notification",
    "mailer_templates_password_changed_notification_content",
  ],
  emailChanged: [
    "mailer_subjects_email_changed_notification",
    "mailer_templates_email_changed_notification_content",
  ],
  phoneChanged: [
    "mailer_subjects_phone_changed_notification",
    "mailer_templates_phone_changed_notification_content",
  ],
  mfaFactorEnrolled: [
    "mailer_subjects_mfa_factor_enrolled_notification",
    "mailer_templates_mfa_factor_enrolled_notification_content",
  ],
  mfaFactorUnenrolled: [
    "mailer_subjects_mfa_factor_unenrolled_notification",
    "mailer_templates_mfa_factor_unenrolled_notification_content",
  ],
  identityLinked: [
    "mailer_subjects_identity_linked_notification",
    "mailer_templates_identity_linked_notification_content",
  ],
  identityUnlinked: [
    "mailer_subjects_identity_unlinked_notification",
    "mailer_templates_identity_unlinked_notification_content",
  ],
} as const satisfies Record<AuthEmailTemplateKind, readonly [string, string]>;

type TemplateFieldPair = (typeof TEMPLATE_FIELDS)[AuthEmailTemplateKind];
export type SupabaseAuthEmailTemplateField = TemplateFieldPair[number];
export type SupabaseAuthEmailTemplatePayload = Record<SupabaseAuthEmailTemplateField, string>;

export type SupabaseAuthEmailTemplateBackup = {
  capturedAt: string;
  projectRef: string;
  rollbackPayload: SupabaseAuthEmailTemplatePayload;
};

export type SupabaseAuthEmailTemplateMismatch = {
  field: SupabaseAuthEmailTemplateField;
  template: AuthEmailTemplateKind;
  value: "subject" | "html";
};

export type SupabaseAuthEmailTemplateSyncResult = {
  backup: SupabaseAuthEmailTemplateBackup;
  changed: boolean;
  mismatchesBefore: SupabaseAuthEmailTemplateMismatch[];
  mismatchesAfter: SupabaseAuthEmailTemplateMismatch[];
  nonTemplateSettingsUnchanged: boolean;
  unexpectedChangedFields: string[];
};

export type SyncSupabaseAuthEmailTemplatesOptions = {
  accessToken: string;
  projectRef: string;
  templates: Record<AuthEmailTemplateKind, AuthEmailTemplate>;
  onBackup: (backup: SupabaseAuthEmailTemplateBackup) => Promise<void> | void;
  fetcher?: typeof fetch;
};

type AuthConfig = Record<string, unknown>;

function assertServerRuntime() {
  if (typeof window !== "undefined") {
    throw new Error("Supabase Management API template synchronization must run on the server.");
  }
}

function assertCredentials(projectRef: string, accessToken: string) {
  if (!/^[a-z]{20}$/.test(projectRef)) {
    throw new Error("A valid 20-character Supabase project ref is required.");
  }
  if (!accessToken.trim()) {
    throw new Error("A Supabase Management API access token is required.");
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function isDerivedCustomizationField(field: string) {
  return field === "mailer_subjects_custom_contents" || field === "mailer_templates_custom_contents";
}

function pickUnmanagedConfig(config: AuthConfig): AuthConfig {
  const managedFields = new Set(Object.values(TEMPLATE_FIELDS).flat());
  return Object.fromEntries(
    Object.entries(config).filter(([field]) => !managedFields.has(field as SupabaseAuthEmailTemplateField)
      && !isDerivedCustomizationField(field)),
  );
}

function changedFields(before: AuthConfig, after: AuthConfig): string[] {
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...fields].filter((field) => stableJson(before[field]) !== stableJson(after[field])).sort();
}

function pickHostedPayload(config: AuthConfig): SupabaseAuthEmailTemplatePayload {
  const payload = {} as SupabaseAuthEmailTemplatePayload;
  for (const [subjectField, htmlField] of Object.values(TEMPLATE_FIELDS)) {
    const subject = config[subjectField];
    const html = config[htmlField];
    if (typeof subject !== "string" || typeof html !== "string") {
      throw new Error(`Supabase Auth config is missing ${subjectField} or ${htmlField}.`);
    }
    payload[subjectField] = subject;
    payload[htmlField] = html;
  }
  return payload;
}

async function readAuthConfig(
  url: string,
  accessToken: string,
  fetcher: typeof fetch,
): Promise<AuthConfig> {
  const response = await fetcher(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Supabase Management API auth config read failed with HTTP ${response.status}.`);
  }
  return await response.json() as AuthConfig;
}

export function createSupabaseAuthEmailTemplatePayload(
  templates: Record<AuthEmailTemplateKind, AuthEmailTemplate>,
): SupabaseAuthEmailTemplatePayload {
  const payload = {} as SupabaseAuthEmailTemplatePayload;
  for (const [template, [subjectField, htmlField]] of Object.entries(TEMPLATE_FIELDS) as Array<
    [AuthEmailTemplateKind, TemplateFieldPair]
  >) {
    payload[subjectField] = templates[template].subject;
    payload[htmlField] = templates[template].html;
  }
  return payload;
}

export function compareSupabaseAuthEmailTemplates(
  hosted: Record<string, unknown>,
  expected: SupabaseAuthEmailTemplatePayload,
): SupabaseAuthEmailTemplateMismatch[] {
  const mismatches: SupabaseAuthEmailTemplateMismatch[] = [];
  for (const [template, [subjectField, htmlField]] of Object.entries(TEMPLATE_FIELDS) as Array<
    [AuthEmailTemplateKind, TemplateFieldPair]
  >) {
    if (hosted[subjectField] !== expected[subjectField]) {
      mismatches.push({ field: subjectField, template, value: "subject" });
    }
    if (hosted[htmlField] !== expected[htmlField]) {
      mismatches.push({ field: htmlField, template, value: "html" });
    }
  }
  return mismatches;
}

export async function syncSupabaseAuthEmailTemplates(
  options: SyncSupabaseAuthEmailTemplatesOptions,
): Promise<SupabaseAuthEmailTemplateSyncResult> {
  assertServerRuntime();
  assertCredentials(options.projectRef, options.accessToken);

  const fetcher = options.fetcher ?? fetch;
  const authConfigUrl = `${MANAGEMENT_API_BASE_URL}/projects/${options.projectRef}/config/auth`;
  const expected = createSupabaseAuthEmailTemplatePayload(options.templates);
  const before = await readAuthConfig(authConfigUrl, options.accessToken, fetcher);
  const rollbackPayload = pickHostedPayload(before);
  const backup: SupabaseAuthEmailTemplateBackup = {
    capturedAt: new Date().toISOString(),
    projectRef: options.projectRef,
    rollbackPayload,
  };
  const mismatchesBefore = compareSupabaseAuthEmailTemplates(before, expected);

  await options.onBackup(backup);

  if (mismatchesBefore.length === 0) {
    return {
      backup,
      changed: false,
      mismatchesBefore,
      mismatchesAfter: [],
      nonTemplateSettingsUnchanged: true,
      unexpectedChangedFields: [],
    };
  }

  const patchResponse = await fetcher(authConfigUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(expected),
  });
  if (!patchResponse.ok) {
    throw new Error(`Supabase Management API auth template update failed with HTTP ${patchResponse.status}.`);
  }

  const after = await readAuthConfig(authConfigUrl, options.accessToken, fetcher);
  const mismatchesAfter = compareSupabaseAuthEmailTemplates(after, expected);
  const unexpectedChangedFields = changedFields(pickUnmanagedConfig(before), pickUnmanagedConfig(after));

  if (mismatchesAfter.length > 0) {
    throw new Error(`Supabase Auth template verification failed for ${mismatchesAfter.length} field(s).`);
  }
  if (unexpectedChangedFields.length > 0) {
    throw new Error(`Supabase Auth template update changed unmanaged field(s): ${unexpectedChangedFields.join(", ")}.`);
  }

  return {
    backup,
    changed: true,
    mismatchesBefore,
    mismatchesAfter,
    nonTemplateSettingsUnchanged: true,
    unexpectedChangedFields,
  };
}
