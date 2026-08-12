import type {
  MilestoneStatus,
  ProjectLinkKind,
  ProjectStatus,
} from "../../contracts";

export const CLIENT_PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planned: "Planeamento",
  active: "Ativo",
  paused: "Em pausa",
  blocked: "Bloqueado",
  completed: "Concluído",
  canceled: "Cancelado",
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

export const CLIENT_PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  planned: "bg-[color:var(--project-ui-color-31)] text-[color:var(--project-state-planned-strong)]",
  active: "bg-[color:var(--project-ui-color-33)] text-[color:var(--project-state-active-strong)]",
  paused: "bg-[color:var(--project-ui-color-31)] text-[color:var(--project-state-planned-strong)]",
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
  portal: {
    clientFallbackName: "cliente",
    greetingPrefix: "Olá",
    homeDescription: "O essencial sobre o trabalho que estamos a desenvolver contigo.",
    organizationAdmin: "Administrador",
    organizationMember: "Membro",
    yourOrganization: "A tua organização",
    yourOrganizations: "As tuas organizações",
    allOrganizations: "Todas as organizações",
    activeProject: "Projeto em curso",
    currentWork: "Agora",
    ongoingProjects: "Projetos em curso",
    seeAllProjects: "Ver todos os projetos",
    noOngoingProjects: "Não tens projetos em curso",
    noOngoingProjectsDescription: "Podes continuar a consultar os projetos concluídos e o restante histórico partilhado contigo.",
    seeProjectHistory: "Consultar histórico",
    progress: "Progresso",
    sharedMetas: "Metas partilhadas",
    currentMeta: "Meta em curso",
    currentMetas: "Metas em curso",
    nextMeta: "Próxima meta",
    targetDate: "Data prevista",
    responsible: "Responsável",
    openProject: "Abrir projeto",
    accountAndSecurity: "Informação e segurança",
    accountAndSecurityDescription: "Consulta ou atualiza os teus dados pessoais e opções de segurança.",
    openAccountAndSecurity: "Ver perfil e segurança",
    loadError: "Não foi possível carregar o teu espaço.",
    statusLabels: CLIENT_PROJECT_STATUS_LABELS,
  },
  profile: {
    organizations: "Organizações",
    noOrganizations: "Não existem organizações associadas a esta conta.",
    readOnlyMemberships: "Estas associações são geridas pela equipa BrightWeb.",
  },
  safeUi: {
    notFoundTitle: "Projeto não encontrado",
    notFoundDescription: "Este projeto não existe ou já não está disponível para a tua conta.",
    openErrorTitle: "Não foi possível abrir o projeto",
    openErrorDescription: "Tenta novamente dentro de alguns momentos.",
    completedMetas: "Metas concluídas",
    completedMetasLower: "metas concluídas",
    of: "de",
    summary: "Sobre o projeto",
    progress: "Progresso",
    dates: "Datas",
    startDate: "Início",
    scope: "Âmbito",
    noSharedMetas: "Ainda não existem metas partilhadas.",
    noSharedDocuments: "Ainda não existem documentos partilhados.",
    completedPercent: (percent: number) => `${percent}% concluído`,
    completedProjects: "Concluídos",
    ongoingProjects: "Em curso",
    allProjects: "Todos",
    myProjects: "Os meus projetos",
    openProjects: "Abrir projetos",
    projectsLoadError: "Não foi possível carregar os projetos.",
    retry: "Tentar novamente",
    emptyProjects: "Ainda não existem projetos partilhados contigo.",
    emptyFilteredProjects: "Nenhum projeto corresponde aos filtros selecionados.",
    pageDescription: "Acompanha os projetos partilhados contigo e com as tuas organizações.",
    previewDescription: "Consulta os projetos partilhados contigo numa área dedicada.",
    projectsBack: "Projetos",
    filterLabel: "Filtrar projetos",
    searchPlaceholder: "Pesquisar projetos",
    deadline: "Prazo",
    contact: "Contacto",
    metas: "Metas",
    sharedDocuments: "Documentos partilhados",
  },
  common: {
    noDate: "Sem data",
    delayed: "atrasado",
  },
  list: {
    milestoneProgress: "Progresso das metas",
    open: "Abrir projeto",
  },
} as const;
