import {
  buildTransactionalEmail,
  type TransactionalEmail,
  type TransactionalEmailPalette,
} from "@brightweblabs/ui/email/invitation";

export type AuthEmailTemplateKind =
  | "recovery"
  | "magicLink"
  | "confirmation"
  | "emailChange"
  | "reauthentication"
  | "passwordChanged"
  | "emailChanged"
  | "phoneChanged"
  | "mfaFactorEnrolled"
  | "mfaFactorUnenrolled"
  | "identityLinked"
  | "identityUnlinked";

export type AuthEmailTemplate = TransactionalEmail & {
  subject: string;
};

export type AuthEmailBrand = {
  brandName: string;
  logoUrl?: string | null;
  portalUrl: string;
  palette?: Partial<TransactionalEmailPalette>;
};

export function createAuthEmailTemplates(brand: AuthEmailBrand): Record<AuthEmailTemplateKind, AuthEmailTemplate> {
  const shared = {
    brandName: brand.brandName,
    logoUrl: brand.logoUrl,
    logoAlt: brand.brandName,
    palette: brand.palette,
    recipientLabel: "Esta mensagem foi enviada para",
    closingNote: "Se não reconhece esta mensagem, pode ignorá-la em segurança.",
  };

  return {
    recovery: {
      subject: `${brand.brandName}: redefinir palavra-passe`,
      ...buildTransactionalEmail({
        ...shared,
        preheader: "Recebemos um pedido para redefinir a sua palavra-passe.",
        eyebrow: "Segurança da conta",
        title: "Escolha uma nova palavra-passe",
        introduction: "Recebemos um pedido para alterar a palavra-passe da sua conta. Use a ligação abaixo para continuar em segurança.",
        details: [
          { label: "Pedido", value: "Redefinição de palavra-passe" },
          { label: "Validade da ligação", value: "60 minutos" },
        ],
        actionLabel: "Redefinir palavra-passe",
        actionUrl: "{{ .ConfirmationURL }}",
        recipientEmail: "{{ .Email }}",
        closingNote: "Se não pediu esta alteração, ignore esta mensagem. A sua palavra-passe não será modificada.",
      }),
    },
    magicLink: {
      subject: `${brand.brandName}: ligação para iniciar sessão`,
      ...buildTransactionalEmail({
        ...shared,
        preheader: "A sua ligação segura para entrar no portal.",
        eyebrow: "Acesso sem palavra-passe",
        title: "Entre com uma ligação segura",
        introduction: "Use esta ligação única para iniciar sessão. Por segurança, não a partilhe nem a reencaminhe.",
        details: [
          { label: "Destino", value: "Portal" },
          { label: "Utilização", value: "Única e temporária" },
        ],
        actionLabel: "Entrar no portal",
        actionUrl: "{{ .ConfirmationURL }}",
        recipientEmail: "{{ .Email }}",
      }),
    },
    confirmation: {
      subject: `${brand.brandName}: confirme o seu email`,
      ...buildTransactionalEmail({
        ...shared,
        preheader: "Confirme o seu endereço de email para concluir o acesso.",
        eyebrow: "Confirmação de identidade",
        title: "Confirme o seu email",
        introduction: "Só falta confirmar que este endereço de email lhe pertence para concluir a configuração da conta.",
        details: [
          { label: "Email", value: "{{ .Email }}" },
          { label: "Próximo passo", value: "Confirmar endereço" },
        ],
        actionLabel: "Confirmar email",
        actionUrl: "{{ .ConfirmationURL }}",
        recipientEmail: "{{ .Email }}",
      }),
    },
    emailChange: {
      subject: `${brand.brandName}: confirme o novo email`,
      ...buildTransactionalEmail({
        ...shared,
        preheader: "Confirme o novo endereço associado à sua conta.",
        eyebrow: "Alteração da conta",
        title: "Confirme o seu novo email",
        introduction: "Recebemos um pedido para alterar o endereço de email associado à sua conta.",
        details: [
          { label: "Novo email", value: "{{ .NewEmail }}" },
          { label: "Ação", value: "Confirmar alteração" },
        ],
        actionLabel: "Confirmar novo email",
        actionUrl: "{{ .ConfirmationURL }}",
        recipientEmail: "{{ .Email }}",
        closingNote: "Se não pediu esta alteração, não confirme e contacte a equipa responsável pelo portal.",
      }),
    },
    reauthentication: {
      subject: `${brand.brandName}: código de verificação`,
      ...buildTransactionalEmail({
        ...shared,
        preheader: "Use este código para confirmar a sua identidade.",
        eyebrow: "Verificação de segurança",
        title: "Confirme que é mesmo você",
        introduction: "Introduza este código no portal para concluir a operação protegida. Não partilhe o código com ninguém.",
        details: [
          { label: "Código de verificação", value: "{{ .Token }}" },
          { label: "Utilização", value: "Única e temporária" },
        ],
        recipientEmail: "{{ .Email }}",
      }),
    },
    passwordChanged: {
      subject: `${brand.brandName}: palavra-passe alterada`,
      ...buildTransactionalEmail({
        ...shared,
        preheader: "A palavra-passe da sua conta foi alterada.",
        eyebrow: "Aviso de segurança",
        title: "A sua palavra-passe foi alterada",
        introduction: "Esta mensagem confirma que a palavra-passe da sua conta foi atualizada com sucesso.",
        details: [
          { label: "Estado", value: "Alteração concluída" },
          { label: "Conta", value: "{{ .Email }}" },
        ],
        actionLabel: "Entrar no portal",
        actionUrl: brand.portalUrl,
        recipientEmail: "{{ .Email }}",
        closingNote: "Se não fez esta alteração, contacte imediatamente a equipa responsável pelo portal.",
      }),
    },
    emailChanged: {
      subject: `${brand.brandName}: email alterado`,
      ...buildTransactionalEmail({
        ...shared,
        preheader: "O endereço de email da sua conta foi alterado.",
        eyebrow: "Aviso de segurança",
        title: "O seu email foi alterado",
        introduction: "Esta mensagem confirma que o endereço de email associado à sua conta foi atualizado.",
        details: [
          { label: "Email anterior", value: "{{ .OldEmail }}" },
          { label: "Novo email", value: "{{ .Email }}" },
        ],
        actionLabel: "Entrar no portal",
        actionUrl: brand.portalUrl,
        recipientEmail: "{{ .Email }}",
        closingNote: "Se não fez esta alteração, contacte imediatamente a equipa responsável pelo portal.",
      }),
    },
    phoneChanged: {
      subject: `${brand.brandName}: telefone alterado`,
      ...buildTransactionalEmail({
        ...shared,
        preheader: "O número de telefone da sua conta foi alterado.",
        eyebrow: "Aviso de segurança",
        title: "O seu telefone foi alterado",
        introduction: "Esta mensagem confirma que o número de telefone associado à sua conta foi atualizado.",
        details: [
          { label: "Novo telefone", value: "{{ .Phone }}" },
          { label: "Estado", value: "Alteração concluída" },
        ],
        actionLabel: "Entrar no portal",
        actionUrl: brand.portalUrl,
        recipientEmail: "{{ .Email }}",
        closingNote: "Se não fez esta alteração, contacte imediatamente a equipa responsável pelo portal.",
      }),
    },
    mfaFactorEnrolled: {
      subject: `${brand.brandName}: novo método de segurança`,
      ...buildTransactionalEmail({
        ...shared,
        preheader: "Foi adicionado um novo método de verificação à sua conta.",
        eyebrow: "Aviso de segurança",
        title: "Novo método de segurança adicionado",
        introduction: "Foi configurado um novo método de autenticação multifator na sua conta.",
        details: [
          { label: "Proteção", value: "Autenticação multifator" },
          { label: "Estado", value: "Ativa" },
        ],
        actionLabel: "Rever a conta",
        actionUrl: brand.portalUrl,
        recipientEmail: "{{ .Email }}",
        closingNote: "Se não reconhece esta ação, contacte imediatamente a equipa responsável pelo portal.",
      }),
    },
    mfaFactorUnenrolled: {
      subject: `${brand.brandName}: método de segurança removido`,
      ...buildTransactionalEmail({
        ...shared,
        preheader: "Foi removido um método de verificação da sua conta.",
        eyebrow: "Aviso de segurança",
        title: "Método de segurança removido",
        introduction: "Um método de autenticação multifator deixou de estar associado à sua conta.",
        details: [
          { label: "Proteção", value: "Autenticação multifator" },
          { label: "Estado", value: "Método removido" },
        ],
        actionLabel: "Rever a conta",
        actionUrl: brand.portalUrl,
        recipientEmail: "{{ .Email }}",
        closingNote: "Se não reconhece esta ação, contacte imediatamente a equipa responsável pelo portal.",
      }),
    },
    identityLinked: {
      subject: `${brand.brandName}: nova identidade associada`,
      ...buildTransactionalEmail({
        ...shared,
        preheader: "Foi associado um novo método de início de sessão à sua conta.",
        eyebrow: "Aviso de segurança",
        title: "Nova identidade associada",
        introduction: "Um novo fornecedor de identidade foi associado à sua conta e pode agora ser usado para iniciar sessão.",
        details: [
          { label: "Acesso", value: "Nova identidade ligada" },
          { label: "Conta", value: "{{ .Email }}" },
        ],
        actionLabel: "Rever a conta",
        actionUrl: brand.portalUrl,
        recipientEmail: "{{ .Email }}",
        closingNote: "Se não reconhece esta ação, contacte imediatamente a equipa responsável pelo portal.",
      }),
    },
    identityUnlinked: {
      subject: `${brand.brandName}: identidade removida`,
      ...buildTransactionalEmail({
        ...shared,
        preheader: "Foi removido um método de início de sessão da sua conta.",
        eyebrow: "Aviso de segurança",
        title: "Identidade removida",
        introduction: "Um fornecedor de identidade deixou de estar associado à sua conta e já não pode ser usado para iniciar sessão.",
        details: [
          { label: "Acesso", value: "Identidade desligada" },
          { label: "Conta", value: "{{ .Email }}" },
        ],
        actionLabel: "Rever a conta",
        actionUrl: brand.portalUrl,
        recipientEmail: "{{ .Email }}",
        closingNote: "Se não reconhece esta ação, contacte imediatamente a equipa responsável pelo portal.",
      }),
    },
  };
}
