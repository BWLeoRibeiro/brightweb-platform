import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Variáveis de ambiente do Supabase em falta.");
}

if (supabaseAnonKey.startsWith("sb_secret_") || supabaseAnonKey.includes("service_role")) {
  throw new Error(
    "Chave Supabase inválida: está a usar uma chave service role (secreta) em NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Use a chave anon/pública do painel do Supabase (Settings > API > anon public key). " +
      "A chave anon deve começar por 'eyJ' (é um token JWT).",
  );
}

export const createClient = () => createBrowserClient(supabaseUrl, supabaseAnonKey);

export const createBrowserSupabaseClient = createClient;
