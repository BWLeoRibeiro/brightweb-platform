import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;

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

export const createClient = () => createBrowserClient(supabaseUrl, supabasePublishableKey);

export const createBrowserSupabaseClient = createClient;
