"use client";

import { AuthUiProvider, type AuthInvitation, type AuthUiClient } from "@brightweblabs/core-auth/ui";
import { starterBrandConfig } from "../../config/brand";

const wait = (duration: number) => new Promise((resolve) => window.setTimeout(resolve, duration));

const mockAuthClient: AuthUiClient = {
  async getSession() {
    return { user: null };
  },
  async signOutLocal() {},
  async signInWithPassword() {
    await wait(350);
  },
  async sendMagicLink() {
    await wait(350);
  },
  async resendConfirmation() {
    await wait(250);
  },
  async requestReset() {
    await wait(350);
  },
  async exchangeRecoveryCode() {
    await wait(180);
  },
  async resetPassword() {
    await wait(350);
  },
  async getInvitation(invitationId, kind) {
    await wait(220);
    return {
      id: invitationId,
      email: kind === "admin" ? "admin@exemplo.pt" : "maria@exemplo.pt",
      status: "pending",
      expiresAt: "2099-12-31T23:59:59.000Z",
      kind,
      organizationName: "Atelier Horizonte",
      role: kind === "admin" ? "admin" : "member",
    } satisfies AuthInvitation;
  },
  async registerInvite(input) {
    await wait(420);
    return { email: input.kind === "admin" ? "admin@exemplo.pt" : "maria@exemplo.pt" };
  },
  async getPostLoginAccess() {
    await wait(650);
    return {
      user: { id: "preview-user", email: "preview@exemplo.pt" },
      profileId: "preview-profile",
      role: "admin",
      isAdmin: true,
      isStaff: true,
    };
  },
  async acceptInvite() {
    await wait(120);
  },
};

export function AuthPreviewProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthUiProvider
      client={mockAuthClient}
      signupMode="invite-only"
      brand={{
        companyName: starterBrandConfig.companyName,
        helpHref: "mailto:support@example.com",
        splitHeadline: "Operações claras. Decisões com contexto.",
        splitDescription: "Um espaço reservado para equipas e clientes acompanharem projetos, relações e trabalho em curso.",
        logo: <img src="/brand/logo-dark.svg" alt={starterBrandConfig.companyName} width={176} height={44} />,
      }}
    >
      {children}
    </AuthUiProvider>
  );
}
