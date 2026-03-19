type SupabasePublicEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getRequiredEnv(canonicalName: string, fallbackNames: string[] = []): string | null {
  const canonicalValue = readEnv(canonicalName);
  if (canonicalValue) {
    return canonicalValue;
  }

  for (const fallbackName of fallbackNames) {
    const fallbackValue = readEnv(fallbackName);
    if (fallbackValue) {
      return fallbackValue;
    }
  }

  return null;
}

export function resolveSupabaseUrl(): string | null {
  return getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function resolveSupabasePublicEnv(): SupabasePublicEnv {
  const supabaseUrl = resolveSupabaseUrl();
  const supabasePublishableKey = getRequiredEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY",
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
  );

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Variáveis de ambiente do Supabase em falta.");
  }

  if (supabasePublishableKey.startsWith("sb_secret_") || supabasePublishableKey.includes("service_role")) {
    throw new Error(
      "Chave Supabase inválida: está a usar uma chave secreta em NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY. " +
        "Use a chave publishable/pública do painel do Supabase. " +
        "A chave publishable deve começar por 'sb_publishable_' (não a chave secreta).",
    );
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
  };
}

export function resolveSupabaseServiceRoleKey(): string | null {
  const serviceRoleKey = getRequiredEnv("SUPABASE_SECRET_DEFAULT_KEY", ["SUPABASE_SERVICE_ROLE_KEY"]);

  if (!serviceRoleKey) {
    return null;
  }

  if (!serviceRoleKey.startsWith("sb_secret_")) {
    throw new Error(
      "Chave Supabase inválida: SUPABASE_SECRET_DEFAULT_KEY deve usar a chave secreta do Supabase. " +
        "A chave secreta deve começar por 'sb_secret_'.",
    );
  }

  return serviceRoleKey;
}
