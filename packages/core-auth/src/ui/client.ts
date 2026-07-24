"use client";

import { createBrowserSupabaseClient } from "@brightweblabs/infra/client";
import { normalizeGlobalRole, resolvePostLoginPath } from "../shared";
import {
  parseInvitationAcceptResponse,
  parseInvitationDetailsResponse,
  parseInvitationRegisterResponse,
} from "./response-parsers";
import type { AuthUiClient } from "./types";

export function createAuthUiClient(options: {
  invitationBasePath?: string;
  fetcher?: typeof fetch;
  createClient?: typeof createBrowserSupabaseClient;
} = {}): AuthUiClient {
  const fetcher = options.fetcher ?? fetch;
  const invitationBasePath = (options.invitationBasePath ?? "/api/invitations").replace(/\/$/, "");
  const supabase = options.createClient ?? createBrowserSupabaseClient;

  return {
    async getSession() {
      const { data, error } = await supabase().auth.getSession();
      if (error) throw error;
      return { user: data.session?.user ? { id: data.session.user.id, email: data.session.user.email ?? null } : null };
    },
    async signOutLocal() {
      const { error } = await supabase().auth.signOut({ scope: "local" });
      if (error) throw error;
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
      const { data, error: sessionError } = await supabase().auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) throw new Error("missing-session");
      const { error } = await supabase().auth.updateUser({ password });
      if (error) throw error;
    },
    async getInvitation(invitationId, kind) {
      return parseInvitationDetailsResponse(
        await fetcher(`${invitationBasePath}/${encodeURIComponent(invitationId)}?kind=${kind}`),
        kind,
      );
    },
    async registerInvite(input) {
      return parseInvitationRegisterResponse(await fetcher(`${invitationBasePath}/${encodeURIComponent(input.invitationId)}/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }));
    },
    async getPostLoginAccess() {
      const client = supabase();
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) throw sessionError;
      const user = sessionData.session?.user;
      if (!user) {
        return {
          user: null,
          profileId: null,
          role: null,
          isAdmin: false,
          isStaff: false,
        };
      }
      const [{ data: roleRaw, error: roleError }, { data: profile, error: profileError }] = await Promise.all([
        client.rpc("current_global_role"),
        client.from("profiles").select("id").eq("user_id", user.id).maybeSingle<{ id: string }>(),
      ]);
      if (roleError) throw roleError;
      if (profileError) throw profileError;
      const role = normalizeGlobalRole(typeof roleRaw === "string" ? roleRaw : null);
      return {
        user: { id: user.id, email: user.email ?? null },
        profileId: profile?.id ?? null,
        role,
        isAdmin: role === "admin",
        isStaff: resolvePostLoginPath(role) === "/dashboard",
      };
    },
    async acceptInvite({ invitationId }) {
      await parseInvitationAcceptResponse(
        await fetcher(`${invitationBasePath}/${encodeURIComponent(invitationId)}/accept`, { method: "POST" }),
      );
    },
  };
}
