import { createBrowserClient } from "@supabase/ssr";
import { resolveSupabasePublicEnv } from "./supabase-env";

export const createClient = () => {
  const { supabaseUrl, supabasePublishableKey } = resolveSupabasePublicEnv();
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
};

export const createBrowserSupabaseClient = createClient;
