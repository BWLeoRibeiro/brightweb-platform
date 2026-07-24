"use client";

import { AuthUiProvider, createAuthUiClient } from "@brightweblabs/core-auth/ui";
import { starterBrandConfig } from "../../config/brand";

const authClient = createAuthUiClient();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <AuthUiProvider
      client={authClient}
      signupMode="invite-only"
      layoutVariant="split"
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
