/**
 * Project activity → written message. Each event reads as a sentence: actor
 * first, then verb, entity and the concrete change, e.g. "Leonel Ribeiro moveu
 * a tarefa Setup backend de Por fazer para Concluída".
 *
 * Every human-readable string is supplied by a {@link ProjectActivityDictionary}
 * so each app chooses its own language; `ptProjectActivityDictionary` ships as
 * the default. The composition logic (which segments, in what order) is
 * language-neutral. Pairs with `@brightweblabs/ui`'s `ActivityMessage` renderer.
 */

import { toActivityChanges, type MsgSeg } from "@brightweblabs/ui/activity-format";

export type ProjectActivityMessageItem = {
  eventType: string;
  summary: string;
  payload?: Record<string, unknown>;
};

export type ProjectActivityDictionary = {
  /** Actor label for an empty/unknown actor. */
  systemActor: string;
  /** Subject form of the system actor (sentence-initial), e.g. "O sistema". */
  systemActorSubject: string;
  connectors: {
    /** Between a status/value pair's old value, e.g. " de ". */
    from: string;
    /** Before a status/value's new value, e.g. " para ". */
    to: string;
    /** Lead-in to the touched-fields detail, e.g. " — ". */
    detail: string;
    /** Separator between consecutive detail items, e.g. ", ". */
    item: string;
    /** Suffix when a field was cleared, e.g. " (removido)". */
    removed: string;
  };
  /** Fallback nouns when the subject name is unknown. */
  nouns: { project: string; task: string; milestone: string; link: string; member: string };
  verbs: {
    projectCreated: string;
    projectStatusChanged: string;
    projectUpdated: string;
    projectDeleted: string;
    taskCreated: string;
    taskMoved: string;
    taskUpdated: string;
    taskDeleted: string;
    milestoneCreated: string;
    milestoneMoved: string;
    milestoneUpdated: string;
    milestoneDeleted: string;
    linkCreated: string;
    linkUpdated: string;
    linkDeleted: string;
    memberAdded: string;
    memberAddedSuffix: string;
    memberRemoved: string;
    memberRemovedSuffix: string;
    memberRoleChanged: string;
    teamUpdated: string;
    teamUpdatedDetail: string;
  };
  /** Verbs/labels used inside the `project_members_synced` summary. */
  members: {
    added: string;
    removed: string;
    roleChanged: string;
    singular: string;
    plural: string;
  };
  statusLabels: {
    project: Record<string, string>;
    milestone: Record<string, string>;
    task: Record<string, string>;
  };
  priorityLabels: Record<string, string>;
  roleLabels: Record<string, string>;
  /** Field labels for the change diff (feeds `toActivityChanges`). */
  fieldLabels: Record<string, string>;
  /** Fields whose values are people (an empty one reads as the system). */
  personFields: string[];
  /** Locale + boolean words for value formatting. */
  value: { locale: string; trueLabel: string; falseLabel: string };
};

export const ptProjectActivityDictionary: ProjectActivityDictionary = {
  systemActor: "Sistema",
  systemActorSubject: "O sistema",
  connectors: { from: " de ", to: " para ", detail: " — ", item: ", ", removed: " (removido)" },
  nouns: { project: "um projeto", task: "uma tarefa", milestone: "uma milestone", link: "um link", member: "um membro" },
  verbs: {
    projectCreated: " criou o projeto ",
    projectStatusChanged: " alterou o estado do projeto ",
    projectUpdated: " atualizou o projeto ",
    projectDeleted: " eliminou o projeto ",
    taskCreated: " criou a tarefa ",
    taskMoved: " moveu a tarefa ",
    taskUpdated: " atualizou a tarefa ",
    taskDeleted: " eliminou a tarefa ",
    milestoneCreated: " criou a milestone ",
    milestoneMoved: " moveu a milestone ",
    milestoneUpdated: " atualizou a milestone ",
    milestoneDeleted: " eliminou a milestone ",
    linkCreated: " adicionou o link ",
    linkUpdated: " atualizou o link ",
    linkDeleted: " removeu o link ",
    memberAdded: " adicionou ",
    memberAddedSuffix: " à equipa",
    memberRemoved: " removeu ",
    memberRemovedSuffix: " da equipa",
    memberRoleChanged: " alterou a função de ",
    teamUpdated: " atualizou a equipa",
    teamUpdatedDetail: " atualizou a equipa — ",
  },
  members: { added: "adicionou", removed: "removeu", roleChanged: "atualizou a função de", singular: "membro", plural: "membros" },
  statusLabels: {
    project: {
      planned: "A planear",
      active: "Ativo",
      blocked: "Bloqueado",
      completed: "Concluído",
      canceled: "Cancelado",
    },
    milestone: {
      pending: "Pendente",
      in_progress: "Em progresso",
      achieved: "Concluído",
      delayed: "Atrasado",
    },
    task: {
      todo: "Por fazer",
      in_progress: "Em progresso",
      blocked: "Bloqueada",
      done: "Concluída",
    },
  },
  priorityLabels: { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" },
  roleLabels: { owner: "Responsável", contributor: "Colaborador", observer: "Observador" },
  fieldLabels: {
    title: "Título",
    name: "Nome",
    status: "Estado",
    target_date: "Data-alvo",
    due_date: "Prazo",
    priority: "Prioridade",
    role: "Função",
    completed_at: "Concluído em",
    assignee_profile_id: "Responsável",
    owner_profile_id: "Responsável",
    milestone_id: "Milestone",
    blocked_reason: "Motivo de bloqueio",
    description: "Descrição",
    summary: "Resumo",
  },
  personFields: ["assignee_profile_id", "owner_profile_id"],
  value: { locale: "pt-PT", trueLabel: "Sim", falseLabel: "Não" },
};

function str(payload: Record<string, unknown> | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(payload: Record<string, unknown> | undefined, key: string): number {
  const value = payload?.[key];
  if (typeof value === "number") return value;
  return Array.isArray(value) ? value.length : 0;
}

function names(payload: Record<string, unknown> | undefined, key: string): string[] {
  const value = payload?.[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

/** Pull the entity name out of "Tarefa criada: {title}" style summaries. */
function entityNameFromSummary(summary: string): string | null {
  const idx = summary.indexOf(": ");
  if (idx < 0) return null;
  const name = summary.slice(idx + 2).trim();
  return name || null;
}

function changeOf(payload: Record<string, unknown> | undefined, field: string): { from: string | null; to: string | null } | null {
  const changes = payload?.changes;
  if (!changes || typeof changes !== "object") return null;
  const entry = (changes as Record<string, unknown>)[field];
  if (!entry || typeof entry !== "object") return null;
  const { from, to } = entry as Record<string, unknown>;
  return {
    from: typeof from === "string" && from.trim() ? from.trim() : null,
    to: typeof to === "string" && to.trim() ? to.trim() : null,
  };
}

/** The actor as displayed — empty/unknown reads as the system. */
export function activityActorName(actor: string | null | undefined, dict: ProjectActivityDictionary = ptProjectActivityDictionary): string {
  return actor && actor.trim() ? actor : dict.systemActor;
}

function actorSeg(actorName: string, dict: ProjectActivityDictionary): MsgSeg {
  return { b: actorName === dict.systemActor ? dict.systemActorSubject : actorName };
}

function projectStatusLabel(eventType: string, value: string | null, dict: ProjectActivityDictionary): string | null {
  if (!value) return null;
  if (eventType.startsWith("task_")) return dict.statusLabels.task[value] ?? value;
  if (eventType.startsWith("milestone_")) return dict.statusLabels.milestone[value] ?? value;
  if (eventType.startsWith("project_")) return dict.statusLabels.project[value] ?? value;
  return value;
}

function projectSubject(item: ProjectActivityMessageItem): string | null {
  const p = item.payload;
  if (item.eventType.startsWith("member_")) return str(p, "profile_name");
  if (item.eventType.startsWith("project_")) return str(p, "project_name") ?? entityNameFromSummary(item.summary);
  return entityNameFromSummary(item.summary) ?? str(p, "project_name");
}

export function composeProjectMessage(
  item: ProjectActivityMessageItem,
  actorName: string,
  dict: ProjectActivityDictionary = ptProjectActivityDictionary,
): MsgSeg[] {
  const p = item.payload;
  const c = dict.connectors;
  const actor = actorSeg(actorName, dict);
  const subject = projectSubject(item);
  const status = changeOf(p, "status");

  const named = (fallback: string): MsgSeg[] => (subject ? [{ b: subject }] : [fallback]);

  const moved = (): MsgSeg[] => {
    if (!status) return [];
    const fromL = projectStatusLabel(item.eventType, status.from, dict);
    const toL = projectStatusLabel(item.eventType, status.to, dict);
    if (fromL && toL) return [c.from, { v: fromL }, c.to, { v: toL }];
    if (toL) return [c.to, { v: toL }];
    return [];
  };

  // Humanise a stored field value (enums like priority) on top of the generic
  // formatting toActivityChanges already applied (dates, truncation, ids→null).
  const fieldValue = (key: string, value: string | null): string | null => {
    if (!value) return null;
    if (key === "priority") return dict.priorityLabels[value] ?? value;
    return value;
  };

  // The non-status fields touched by an update, with their before/after values,
  // e.g. " — título de Antigo para Novo, prioridade de Baixa para Alta".
  const fields = (): MsgSeg[] => {
    const changes = toActivityChanges(p, {
      fieldLabels: dict.fieldLabels,
      personFields: dict.personFields,
      systemLabel: dict.systemActor,
      locale: dict.value.locale,
      trueLabel: dict.value.trueLabel,
      falseLabel: dict.value.falseLabel,
    }).filter((change) => change.key !== "status");
    if (changes.length === 0) return [];

    const parts: MsgSeg[][] = changes.map((change) => {
      const label = change.label.toLowerCase();
      const from = fieldValue(change.key, change.from);
      const to = fieldValue(change.key, change.to);
      if (from && to) return [`${label}${c.from}`, { v: from }, c.to, { v: to }];
      if (to) return [`${label}${c.to}`, { v: to }];
      if (from) return [`${label}${c.removed}`];
      return [label]; // ids / unresolved values — name the field only
    });

    const joined = parts.flatMap((part, index) => (index === 0 ? part : [c.item, ...part]));
    return [c.detail, ...joined];
  };

  // A status move plus any other fields touched in the same save.
  const movedAndFields = (): MsgSeg[] => [...moved(), ...fields()];

  const v = dict.verbs;

  switch (item.eventType) {
    case "project_created":
      return [actor, v.projectCreated, ...named(dict.nouns.project)];
    case "project_status_changed":
      return [actor, v.projectStatusChanged, ...named(dict.nouns.project), ...movedAndFields()];
    case "project_updated":
      return status
        ? [actor, v.projectStatusChanged, ...named(dict.nouns.project), ...movedAndFields()]
        : [actor, v.projectUpdated, ...named(dict.nouns.project), ...fields()];
    case "project_deleted":
      return [actor, v.projectDeleted, ...named(dict.nouns.project)];

    case "task_created":
      return [actor, v.taskCreated, ...named(dict.nouns.task)];
    case "task_status_changed":
      return moved().length > 0
        ? [actor, v.taskMoved, ...named(dict.nouns.task), ...movedAndFields()]
        : [actor, v.taskUpdated, ...named(dict.nouns.task), ...fields()];
    case "task_updated":
      return status
        ? [actor, v.taskMoved, ...named(dict.nouns.task), ...movedAndFields()]
        : [actor, v.taskUpdated, ...named(dict.nouns.task), ...fields()];
    case "task_deleted":
      return [actor, v.taskDeleted, ...named(dict.nouns.task)];

    case "milestone_created":
      return [actor, v.milestoneCreated, ...named(dict.nouns.milestone)];
    case "milestone_status_changed":
      return moved().length > 0
        ? [actor, v.milestoneMoved, ...named(dict.nouns.milestone), ...movedAndFields()]
        : [actor, v.milestoneUpdated, ...named(dict.nouns.milestone), ...fields()];
    case "milestone_updated":
      return status
        ? [actor, v.milestoneMoved, ...named(dict.nouns.milestone), ...movedAndFields()]
        : [actor, v.milestoneUpdated, ...named(dict.nouns.milestone), ...fields()];
    case "milestone_deleted":
      return [actor, v.milestoneDeleted, ...named(dict.nouns.milestone)];

    case "link_created":
      return [actor, v.linkCreated, ...named(dict.nouns.link)];
    case "link_updated":
      return [actor, v.linkUpdated, ...named(dict.nouns.link)];
    case "link_deleted":
      return [actor, v.linkDeleted, ...named(dict.nouns.link)];

    case "member_added":
      return [actor, v.memberAdded, ...named(dict.nouns.member), v.memberAddedSuffix];
    case "member_removed":
      return [actor, v.memberRemoved, ...named(dict.nouns.member), v.memberRemovedSuffix];
    case "member_role_changed": {
      const role = changeOf(p, "role");
      const fromR = role?.from ? dict.roleLabels[role.from] ?? role.from : null;
      const toR = role?.to ? dict.roleLabels[role.to] ?? role.to : null;
      const lead: MsgSeg[] = [actor, v.memberRoleChanged, ...named(dict.nouns.member)];
      if (fromR && toR) return [...lead, c.from, { v: fromR }, c.to, { v: toR }];
      if (toR) return [...lead, c.to, { v: toR }];
      return lead;
    }

    case "project_members_synced": {
      const group = (namesKey: string, idsKey: string, verb: string): MsgSeg[] | null => {
        const list = names(p, namesKey);
        if (list.length > 0) return [`${verb} `, { v: list.join(", ") }];
        const count = num(p, idsKey);
        return count > 0 ? [`${verb} ${count} ${count === 1 ? dict.members.singular : dict.members.plural}`] : null;
      };
      const parts = [
        group("added_profile_names", "added_profile_ids", dict.members.added),
        group("removed_profile_names", "removed_profile_ids", dict.members.removed),
        group("changed_profile_names", "changed_profile_ids", dict.members.roleChanged),
      ].filter((part): part is MsgSeg[] => part !== null);

      const detail: MsgSeg[] = parts.flatMap((part, index) => (index === 0 ? part : [c.item, ...part]));
      return detail.length > 0
        ? [actor, v.teamUpdatedDetail, ...detail]
        : [actor, v.teamUpdated];
    }

    default:
      return [actor, ` ${item.summary}`];
  }
}
