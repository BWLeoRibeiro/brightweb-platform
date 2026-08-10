import type {
  MilestoneStatus,
  ProjectHealth,
  ProjectLinkKind,
  ProjectStatus,
} from "../../contracts";

export const CLIENT_PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planeamento",
  active: "Ativo",
  blocked: "Bloqueado",
  completed: "Concluído",
  canceled: "Cancelado",
};

export const CLIENT_PROJECT_HEALTH_LABELS: Record<ProjectHealth, string> = {
  on_track: "Dentro do prazo",
  at_risk: "Em risco",
  off_track: "Fora do prazo",
};

export const CLIENT_PROJECT_PREVIEW_HEALTH_LABELS: Record<ProjectHealth, string> = {
  on_track: "no prazo",
  at_risk: "em risco",
  off_track: "fora do prazo",
};

export const CLIENT_MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Pendente",
  in_progress: "Em progresso",
  achieved: "Concluída",
  delayed: "Atrasada",
};

export const CLIENT_PROJECT_LINK_KIND_LABELS: Record<ProjectLinkKind, string> = {
  doc: "Documento",
  sheet: "Folha de cálculo",
  drive: "Drive",
  other: "Outro",
};

export const CLIENT_PROJECT_HEALTH_VAR: Record<ProjectHealth, string> = {
  on_track: "var(--project-health-on-track)",
  at_risk: "var(--project-health-at-risk)",
  off_track: "var(--project-health-off-track)",
};

export const CLIENT_PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  planned: "bg-[color:var(--project-ui-color-31)] text-[color:var(--project-state-planned-strong)]",
  active: "bg-[color:var(--project-ui-color-33)] text-[color:var(--project-state-active-strong)]",
  blocked: "bg-[color:var(--project-ui-color-35)] text-[color:var(--project-state-blocked-strong)]",
  completed: "bg-[color:var(--project-ui-color-37)] text-[color:var(--project-state-completed-strong)]",
  canceled: "bg-[color:var(--project-ui-color-39)] text-[color:var(--project-state-canceled-strong)] line-through",
};

export const CLIENT_MILESTONE_STATUS_CLASSES: Record<MilestoneStatus, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-[color:var(--project-state-active-strong)]",
  achieved: "text-[color:var(--project-state-completed-strong)]",
  delayed: "text-[color:var(--project-risk-overdue-strong)]",
};

export const clientProjectsDictionary = {
  common: {
    noDate: "Sem data",
    delayed: "atrasado",
  },
  list: {
    kicker: "Conta · Projetos",
    title: "Projetos com acesso",
    description: "Vista simplificada dos projetos que o teu perfil pode acompanhar.",
    back: "Voltar à conta",
    fullModule: "Módulo completo",
    total: "Total",
    active: "Ativos",
    onTime: "No prazo",
    schemaMissing: "O módulo de projetos ainda não está provisionado nesta base de dados.",
    loadError: "Não foi possível carregar os projetos.",
    empty: "Não existem projetos visíveis para o teu perfil neste momento.",
    milestones: (achieved: number, total: number) => `${achieved}/${total} metas`,
    noMilestones: "Sem metas",
    delayedMilestones: (count: number) => `· ${count} atrasadas`,
    milestoneProgress: "Progresso das metas",
    open: "Abrir projeto",
  },
  detail: {
    back: "Projetos",
    noAccessTitle: "Sem acesso ao projeto",
    moduleUnavailableTitle: "Módulo de projetos indisponível",
    schemaMissing: "O módulo de projetos ainda não está provisionado nesta base de dados.",
    loadErrorTitle: "Não foi possível abrir o projeto",
    unexpectedLoadError: "Erro inesperado ao carregar o projeto.",
    unexpectedDataError: "Erro inesperado ao carregar os dados do projeto.",
    projectDeadline: "Prazo do projeto",
    milestonesCompleted: "Metas concluídas",
    delayedMilestones: (count: number) => `${count} atrasadas`,
    completedMilestones: (percentage: number) => `${percentage}% completas`,
    nextDelivery: "Próxima entrega",
    milestonesTitle: "Metas do projeto",
    completedOn: (date: string) => `Concluída ${date}`,
    delayedSuffix: " (atrasada)",
    linksTitle: "Links partilhados",
    linksEmpty: "Ainda não existem links públicos neste projeto.",
    membersTitle: "Equipa do projeto",
  },
  preview: {
    title: "Projetos com acesso",
    fullList: "Ver lista completa",
    schemaMissing: "O módulo de projetos ainda não está provisionado nesta base de dados.",
    loadError: "Não foi possível carregar os projetos:",
    empty: "Nenhum projeto visível para o teu perfil.",
    explore: "Explorar projetos",
    showing: "A mostrar 3 pré-visualizações",
    viewAll: "Ver todos",
    open: "Abrir",
  },
} as const;
