import type { AccountUiDictionary } from "./types";

export const defaultAccountUiDictionary: AccountUiDictionary = {
  locale: "pt-PT",
  identity: {
    kicker: "A tua conta",
    fallbackName: "Utilizador",
    roleLabels: {
      client: "Cliente",
      staff: "Equipa",
      admin: "Administrador",
    },
  },
  profile: {
    title: "Dados do perfil",
    firstName: "Primeiro nome",
    lastName: "Último nome",
    email: "Email",
    language: "Idioma",
    preferredLanguage: "Idioma preferido",
    firstNamePlaceholder: "Ex.: Maria",
    lastNamePlaceholder: "Ex.: Silva",
    portuguese: "Português (PT)",
    english: "English",
    emailHint: "O email é gerido no processo de autenticação.",
    edit: "Editar",
    cancel: "Cancelar",
    save: "Guardar alterações",
    loadError: "Não foi possível carregar o perfil",
    saveSuccess: "Dados atualizados com sucesso.",
    saveError: "Não foi possível guardar as alterações da conta.",
    emptyValue: "—",
  },
  workAccess: {
    clientTitle: "Organização e projetos",
    internalTitle: "Acesso de trabalho",
    clientDescription: "Consulta os projetos partilhados com a tua organização numa área dedicada.",
    internalDescription: "Os projetos, tarefas e informação operacional permanecem separados das definições pessoais.",
    clientAction: "Os meus projetos",
    internalAction: "Abrir projetos",
  },
  security: {
    title: "Acesso e segurança",
    email: "Email",
    updatedAt: "Última atualização",
    changePassword: "Alterar password",
    noDate: "Sem data",
  },
};
