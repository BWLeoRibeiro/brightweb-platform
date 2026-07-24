"use client";

import { createBrowserSupabaseClient } from "@brightweblabs/infra/client";
import { normalizeGlobalRole, resolvePostLoginPath } from "../shared";
import type { AuthInvitation, AuthUiClient } from "./types";

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(payload?.error ?? response.statusText);
  return payload as T;
}

export function createAuthUiClient(options: {
  invitationBasePath?: string;
  fetcher?: typeof fetch;
} = {}): AuthUiClient {
  const fetcher = options.fetcher ?? fetch;
  const invitationBasePath = (options.invitationBasePath ?? "/api/invitations").replace(/\/$/, "");
  const supabase = () => createBrowserSupabaseClient();

  return {
    async getSession() {
      const { data } = await supabase().auth.getSession();
      return { user: data.session?.user ? { id: data.session.user.id, email: data.session.user.email ?? null } : null };
    },
    async signOutLocal() {
      await supabase().auth.signOut({ scope: "local" });
    },
    async signInWithPassword(input) {
      const { error } = await supabase().auth.signInWithPassword(input);
      if (error) throw error;
    },
    async sendMagicLink({ email, redirectTo }) {
      const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
    },
    async resendConfirmation({ email, redirectTo }) {
      const { error } = await supabase().auth.resend({ type: "signup", email, options: { emailRedirectTo: redirectTo } });
      if (error) throw error;
    },
    async requestReset({ email, redirectTo }) {
      const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
    },
    async exchangeRecoveryCode(code) {
      const { error } = await supabase().auth.exchangeCodeForSession(code);
      if (error) throw error;
    },
    async resetPassword(password) {
      const { data } = await supabase().auth.getSession();
      if (!data.session) throw new Error("missing-session");
      const { error } = await supabase().auth.updateUser({ password });
      if (error) throw error;
    },
    async getInvitation(invitationId, kind) {
      return readJson<AuthInvitation | null>(await fetcher(`${invitationBasePath}/${encodeURIComponent(invitationId)}?kind=${kind}`));
    },
    async registerInvite(input) {
      const payload = await readJson<{ data: { email: string } }>(await fetcher(`${invitationBasePath}/${encodeURIComponent(input.invitationId)}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }));
      return payload.data;
    },
    async getPostLoginAccess() {
      const client = supabase();
      const [{ data: sessionData }, { data: roleRaw }] = await Promise.all([
        client.auth.getSession(),
        client.rpc("current_global_role"),
      ]);
      const user = sessionData.session?.user;
      const role = normalizeGlobalRole(typeof roleRaw === "string" ? roleRaw : null);
      let profileId: string | null = null;
      if (user) {
        const { data } = await client.from("profiles").select("id").eq("user_id", user.id).maybeSingle<{ id: string }>();
        profileId = data?.id ?? null;
      }
      return {
        user: user ? { id: user.id, email: user.email ?? null } : null,
        profileId,
        role,
        isAdmin: role === "admin",
        isStaff: resolvePostLoginPath(role) === "/dashboard",
      };
    },
    async acceptInvite({ invitationId }) {
      await readJson(await fetcher(`${invitationBasePath}/${encodeURIComponent(invitationId)}/accept`, { method: "POST" }));
    },
  };
}
