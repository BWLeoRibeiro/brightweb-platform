"use client";

import { useState } from "react";
import { createAuthEmailTemplates } from "@brightweblabs/core-auth/email";
import { Button } from "@brightweblabs/ui/button";
import { buildInvitationEmail, type TransactionalEmail } from "@brightweblabs/ui/email/invitation";
import { invitationEmailPreviewBrand as brand } from "./brand";

type PreviewStatus = "active" | "available" | "recommended";
type PreviewItem = TransactionalEmail & {
  id: string;
  label: string;
  description: string;
  provider: string;
  status: PreviewStatus;
  subject: string;
};

const authTemplates = createAuthEmailTemplates(brand);

function withPreviewValues(email: TransactionalEmail): TransactionalEmail {
  const values: Record<string, string> = {
    "{{ .ConfirmationURL }}": "https://portal.begreen.com.pt/auth/confirmacao-exemplo",
    "{{ .Email }}": "ana@exemplo.pt",
    "{{ .NewEmail }}": "ana.novo@exemplo.pt",
    "{{ .OldEmail }}": "ana.antigo@exemplo.pt",
    "{{ .Phone }}": "+351 912 345 678",
    "{{ .Token }}": "482 917",
  };
  return Object.entries(values).reduce((current, [placeholder, value]) => ({
    html: current.html.replaceAll(placeholder, value),
    text: current.text.replaceAll(placeholder, value),
  }), email);
}

const previews: PreviewItem[] = [
  {
    id: "portal-invite",
    label: "Convite para o portal",
    description: "Novo administrador ou colaborador",
    provider: "BW Platform",
    status: "active",
    subject: "BeGreen Consulting: convite para aceder ao portal",
    ...buildInvitationEmail({
      ...brand,
      logoAlt: brand.brandName,
      preheader: "Foi convidado para colaborar no Portal BeGreen Consulting.",
      eyebrow: "Convite para o portal",
      title: "O seu acesso começa aqui",
      introduction: "Foi convidado para colaborar no Portal BeGreen Consulting. Confirme o convite para criar a sua conta e entrar no portal.",
      details: [
        { label: "Perfil atribuído", value: "Colaborador" },
        { label: "Acesso", value: "Portal completo" },
      ],
      actionLabel: "Aceitar convite",
      actionUrl: "https://portal.begreen.com.pt/admin-invite/exemplo",
      expiresLabel: "24 de agosto de 2026",
      recipientEmail: "ana@exemplo.pt",
    }),
  },
  {
    id: "organization-invite",
    label: "Convite para organização",
    description: "Novo membro ou administrador",
    provider: "BW Platform",
    status: "active",
    subject: "BeGreen Consulting: convite para Begreen Consulting, Lda",
    ...buildInvitationEmail({
      ...brand,
      logoAlt: brand.brandName,
      preheader: "Foi convidado para colaborar com a organização Begreen Consulting, Lda.",
      eyebrow: "Convite para uma organização",
      title: "Há uma equipa à sua espera",
      introduction: "Aceite o convite para colaborar com Begreen Consulting, Lda através do Portal BeGreen Consulting.",
      details: [
        { label: "Organização", value: "Begreen Consulting, Lda" },
        { label: "Nível de acesso", value: "Membro" },
      ],
      actionLabel: "Aceitar convite",
      actionUrl: "https://portal.begreen.com.pt/invite/exemplo",
      expiresLabel: "24 de agosto de 2026",
      recipientEmail: "joao@exemplo.pt",
    }),
  },
  {
    id: "password-recovery",
    label: "Redefinir palavra-passe",
    description: "Pedido em Esqueci-me da palavra-passe",
    provider: "Supabase Auth",
    status: "active",
    ...authTemplates.recovery,
    ...withPreviewValues(authTemplates.recovery),
  },
  {
    id: "password-changed",
    label: "Palavra-passe alterada",
    description: "Confirmação de segurança após alteração",
    provider: "Supabase Auth",
    status: "recommended",
    ...authTemplates.passwordChanged,
    ...withPreviewValues(authTemplates.passwordChanged),
  },
  {
    id: "magic-link",
    label: "Ligação de acesso",
    description: "Início de sessão sem palavra-passe",
    provider: "Supabase Auth",
    status: "available",
    ...authTemplates.magicLink,
    ...withPreviewValues(authTemplates.magicLink),
  },
  {
    id: "email-confirmation",
    label: "Confirmar email",
    description: "Confirmação após registo público",
    provider: "Supabase Auth",
    status: "available",
    ...authTemplates.confirmation,
    ...withPreviewValues(authTemplates.confirmation),
  },
  {
    id: "email-change",
    label: "Confirmar novo email",
    description: "Alteração do endereço da conta",
    provider: "Supabase Auth",
    status: "available",
    ...authTemplates.emailChange,
    ...withPreviewValues(authTemplates.emailChange),
  },
  {
    id: "reauthentication",
    label: "Código de verificação",
    description: "Operação sensível ou reautenticação",
    provider: "Supabase Auth",
    status: "available",
    ...authTemplates.reauthentication,
    ...withPreviewValues(authTemplates.reauthentication),
  },
  {
    id: "email-changed",
    label: "Email alterado",
    description: "Aviso após alteração do endereço",
    provider: "Supabase Auth",
    status: "recommended",
    ...authTemplates.emailChanged,
    ...withPreviewValues(authTemplates.emailChanged),
  },
  {
    id: "phone-changed",
    label: "Telefone alterado",
    description: "Aviso após alteração do número",
    provider: "Supabase Auth",
    status: "available",
    ...authTemplates.phoneChanged,
    ...withPreviewValues(authTemplates.phoneChanged),
  },
  {
    id: "mfa-enrolled",
    label: "Segurança MFA adicionada",
    description: "Novo método de verificação",
    provider: "Supabase Auth",
    status: "recommended",
    ...authTemplates.mfaFactorEnrolled,
    ...withPreviewValues(authTemplates.mfaFactorEnrolled),
  },
  {
    id: "mfa-unenrolled",
    label: "Segurança MFA removida",
    description: "Método de verificação removido",
    provider: "Supabase Auth",
    status: "recommended",
    ...authTemplates.mfaFactorUnenrolled,
    ...withPreviewValues(authTemplates.mfaFactorUnenrolled),
  },
  {
    id: "identity-linked",
    label: "Identidade associada",
    description: "Novo fornecedor de início de sessão",
    provider: "Supabase Auth",
    status: "available",
    ...authTemplates.identityLinked,
    ...withPreviewValues(authTemplates.identityLinked),
  },
  {
    id: "identity-unlinked",
    label: "Identidade removida",
    description: "Fornecedor de início de sessão removido",
    provider: "Supabase Auth",
    status: "available",
    ...authTemplates.identityUnlinked,
    ...withPreviewValues(authTemplates.identityUnlinked),
  },
];

const statusLabels: Record<PreviewStatus, string> = {
  active: "Em uso",
  available: "Disponível",
  recommended: "Recomendado",
};

export function InvitationEmailPreview() {
  const [selectedId, setSelectedId] = useState(previews[0].id);
  const [mobile, setMobile] = useState(false);
  const selected = previews.find((item) => item.id === selectedId) ?? previews[0];

  return (
    <main className="min-h-screen bg-[color:var(--background)] px-4 py-8 text-[color:var(--foreground)] sm:px-8">
      <div className="mx-auto max-w-[1240px]">
        <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-meta font-semibold text-[color:var(--muted-foreground)]">Sistema transacional · {previews.length} modelos</p>
            <h1 className="text-display">Emails do portal</h1>
            <p className="mt-2 max-w-[42rem] text-body text-[color:var(--muted-foreground)]">Convites, recuperação de conta e todas as possibilidades suportadas pela autenticação.</p>
          </div>
          <Button type="button" variant="outline" onClick={() => setMobile((value) => !value)}>{mobile ? "Ver desktop" : "Ver mobile"}</Button>
        </header>

        <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <nav aria-label="Modelos de email" className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-2 shadow-sm">
            {previews.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                aria-current={item.id === selected.id ? "page" : undefined}
                className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition-colors last:mb-0 motion-reduce:transition-none ${item.id === selected.id ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]" : "hover:bg-[color:var(--muted)]"}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-body font-semibold">{item.label}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-micro font-semibold ${item.id === selected.id ? "bg-white/15 text-current" : item.status === "active" ? "bg-primary/10 text-primary" : "bg-[color:var(--muted)] text-[color:var(--muted-foreground)]"}`}>{statusLabels[item.status]}</span>
                </span>
                <span className={`mt-1 block text-meta ${item.id === selected.id ? "text-current opacity-75" : "text-[color:var(--muted-foreground)]"}`}>{item.description}</span>
              </button>
            ))}
          </nav>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
            <div className="border-b border-[color:var(--border)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-meta"><span className="font-semibold">Assunto:</span> {selected.subject}</p>
                <span className="text-meta text-[color:var(--muted-foreground)]">{selected.provider} · {mobile ? "390 px" : "Email completo"}</span>
              </div>
            </div>
            <div className="flex justify-center bg-[color:var(--muted)] p-0 sm:p-6">
              <iframe
                key={`${selected.id}-${mobile}`}
                title={`Pré-visualização: ${selected.label}`}
                srcDoc={selected.html}
                className="min-h-[850px] border-0 bg-white transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: mobile ? 390 : "100%", maxWidth: 760 }}
              />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
