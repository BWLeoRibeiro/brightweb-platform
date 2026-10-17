"use client";

import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProjectDetailPage, ProjectTasksPage, createProjectsUiClient } from "@brightweblabs/module-projects/ui";
import type { ProjectDashboardData, ProjectTask } from "@brightweblabs/module-projects";
import type { ClientTaskWorkbench, StaffClientTask } from "../../../../../packages/module-projects/src/client-tasks-contracts";
import { Button } from "@brightweblabs/ui";

const projectId = "sample-project";
const timestamp = "2026-10-17T09:00:00Z";
const capabilities = { canCreateTasks: true, canShareClientTasks: true, canReviewClientTasks: true };
const people = [{ profileId: "member-ana", label: "Ana Martins" }, { profileId: "member-pedro", label: "Pedro Costa" }];
const organizations = [{ id: "sample-org", name: "Organização Exemplo", eligibleClients: people }];

function memberTask(id: string, title: string, publication: StaffClientTask["publication"], workflow: StaffClientTask["workflow"]): StaffClientTask {
  return { id, projectId, clientTitle: title, clientInstructions: "Partilhe os documentos necessários e confirme a informação para a equipa.", publication, workflow, revision: 1, publicationGeneration: publication === "draft" ? 0 : 1, organizationId: "sample-org", audienceMode: "all_eligible", selectedProfileIds: [], responsibleProfileId: "member-ana", responsibleLabel: "Ana Martins", dueDate: "2026-10-23", milestone: { id: "shared", title: "Entrega partilhada" }, response: workflow === "submitted" || workflow === "accepted" ? "Documentos enviados para validação." : null, reviewFeedback: null, submissionSequence: workflow === "submitted" || workflow === "accepted" ? 1 : null, submissions: workflow === "accepted" ? [{ sequence: 1, taskRevision: 1, publicationGeneration: 1, response: "Documentos enviados para validação.", submittedAt: timestamp, submittedByProfileId: "member-ana", reviewFeedback: "Validado pela equipa." }] : [] };
}
function presentation(task: StaffClientTask): ProjectTask {
  return { id: task.id, projectId, kind: "client", title: task.clientTitle, description: task.clientInstructions, clientPublication: task.publication, clientWorkflow: task.workflow, clientRevision: task.revision, status: task.workflow === "accepted" ? "done" : task.workflow === "open" ? "todo" : "in_progress", health: "on_track", priority: "medium", assigneeProfileId: null, assigneeLabel: null, reporterProfileId: null, reporterLabel: null, milestoneId: task.milestone?.id ?? null, dueDate: task.dueDate, startDate: null, position: 0, blockedReason: null, createdAt: timestamp, updatedAt: timestamp };
}
function sampleState(): { dashboard: ProjectDashboardData; workbench: ClientTaskWorkbench } {
  const tasks = [memberTask("member-draft", "Preparar documentos da organização", "draft", "open"), memberTask("member-review", "Validar dados da organização", "published", "submitted"), memberTask("member-accepted", "Confirmar os contactos", "published", "accepted")];
  const internal: ProjectTask = { ...presentation(tasks[0]), id: "staff-task", kind: "internal", title: "Rever plano de implementação", description: "Preparar o plano interno da equipa.", status: "in_progress", assigneeProfileId: "staff-sofia", assigneeLabel: "Sofia Silva", milestoneId: "private", clientPublication: undefined, clientWorkflow: undefined, clientRevision: undefined };
  return {
    workbench: { tasks, organizations, capabilities },
    dashboard: {
      project: { id: projectId, organizationId: "sample-org", organizationName: "Organização Exemplo", organizationOwnerLabel: "Ana Martins", organizationOwnerEmail: null, organizationOwnerPhone: null, name: "Implementação do portal", code: "PRJ-024", status: "active", health: "on_track", ownerProfileId: "staff-sofia", ownerLabel: "Sofia Silva", ownerEmail: null, ownerPhone: null, activatedAt: timestamp, startDate: "2026-10-01", targetDate: "2026-11-30", completedAt: null, cancellationReason: null, summary: "Um projeto de exemplo para experimentar as tarefas internas e as tarefas para membros.", createdAt: timestamp, updatedAt: timestamp, taskStats: { total: 4, done: 1, overdue: 0, blocked: 0 }, milestoneStats: { total: 2, achieved: 0, delayed: 0 } },
      members: [{ id: "sofia", projectId, profileId: "staff-sofia", label: "Sofia Silva", role: "owner", email: null, phone: null, createdAt: timestamp }, { id: "miguel", projectId, profileId: "staff-miguel", label: "Miguel Santos", role: "contributor", email: null, phone: null, createdAt: timestamp }, { id: "observer", projectId, profileId: "staff-observer", label: "Observador", role: "observer", email: null, phone: null, createdAt: timestamp }],
      milestones: [{ id: "private", projectId, title: "Preparação interna", status: "in_progress", health: "on_track", targetDate: "2026-10-22", completedAt: null, position: 0, visibility: "staff", createdAt: timestamp, updatedAt: timestamp }, { id: "shared", projectId, title: "Entrega partilhada", status: "pending", health: "on_track", targetDate: "2026-10-30", completedAt: null, position: 1, visibility: "client", createdAt: timestamp, updatedAt: timestamp }],
      tasks: [internal, ...tasks.map(presentation)], links: [], activity: [], activityTotal: 0,
    },
  };
}

export function UnifiedTasksPreview() {
  const params = useSearchParams();
  const board = params.get("view") === "board";
  const store = useRef(sampleState());
  const [dashboard, setDashboard] = useState(store.current.dashboard);
  const [lastAction, setLastAction] = useState("");
  const client = useMemo(() => {
    const update = () => {
      const internal = store.current.dashboard.tasks.filter(task => task.kind !== "client");
      const tasks = [...internal, ...store.current.workbench.tasks.map(presentation)];
      store.current.dashboard = { ...store.current.dashboard, tasks, project: { ...store.current.dashboard.project, taskStats: { total: tasks.length, done: tasks.filter(task => task.status === "done").length, blocked: 0, overdue: 0 } } };
      setDashboard(store.current.dashboard);
    };
    // Every request stays in this in-memory fixture; it never falls back to a real API.
    const fetcher: typeof fetch = async (request, init) => {
      const path = String(request);
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      if (path.includes("/client-tasks")) {
        if (body) {
          setLastAction(body.action);
          if (body.action === "create") {
            const task = memberTask(crypto.randomUUID(), body.input.clientTitle, "draft", "open");
            Object.assign(task, body.input, { milestone: store.current.dashboard.milestones.find(item => item.id === body.input.milestoneId) ?? null, responsibleLabel: people.find(person => person.profileId === body.input.responsibleProfileId)?.label ?? null });
            store.current.workbench.tasks.push(task);
          } else {
            const task = store.current.workbench.tasks.find(item => path.endsWith(`/${item.id}`));
            if (!task) return Response.json({}, { status: 404 });
            if (task.revision !== body.expectedRevision) return Response.json({}, { status: 409 });
            if (body.action === "configure") Object.assign(task, body.input, { publication: task.publication === "published" ? "withdrawn" : task.publication, workflow: "open", responsibleLabel: people.find(person => person.profileId === body.input.responsibleProfileId)?.label ?? null, milestone: store.current.dashboard.milestones.find(item => item.id === body.input.milestoneId) ?? null });
            if (body.action === "publish") { task.publication = "published"; task.workflow = "open"; task.publicationGeneration += 1; }
            if (body.action === "withdraw") task.publication = "withdrawn";
            if (body.action === "accept") task.workflow = "accepted";
            if (body.action === "return") { task.workflow = "returned"; task.reviewFeedback = body.input.feedback; }
            task.revision += 1;
          }
          update();
        }
        return Response.json({ data: store.current.workbench });
      }
      if (path.endsWith("/tasks") && body) {
        setLastAction("internal:create");
        const task: ProjectTask = { ...presentation(store.current.workbench.tasks[0]), ...body, description: body.description ?? null, dueDate: body.dueDate ?? null, startDate: body.startDate ?? null, blockedReason: body.blockedReason ?? null, id: crypto.randomUUID(), kind: "internal", clientPublication: undefined, clientWorkflow: undefined, clientRevision: undefined, assigneeProfileId: body.assigneeProfileId ?? null, assigneeLabel: store.current.dashboard.members.find(person => person.profileId === body.assigneeProfileId)?.label ?? null, milestoneId: body.milestoneId ?? null };
        store.current.dashboard = { ...store.current.dashboard, tasks: [...store.current.dashboard.tasks, task] }; update();
      } else if (path.includes("/tasks/") && body) {
        setLastAction("internal:update");
        store.current.dashboard = { ...store.current.dashboard, tasks: store.current.dashboard.tasks.map(task => path.endsWith(`/${task.id}`) && task.kind !== "client" ? { ...task, ...body } : task) }; update();
      } else if (path.includes("/activity")) return Response.json({ data: { items: [], page: 1, pageSize: 10, total: 0, totalPages: 0 } });
      else if (path !== `/api/projects/${projectId}`) return Response.json({}, { status: 404 });
      return Response.json({ data: store.current.dashboard });
    };
    return createProjectsUiClient("/api/projects", fetcher);
  }, []);
  const props = { client, initialData: dashboard, projectRole: "contributor" as const, viewerProfileId: "staff-sofia", permissions: { canEditProjectItems: true, ...capabilities, canManageClientContent: true }, navigation: { detailHrefPattern: "/preview/unified-tasks", boardHrefPattern: "/preview/unified-tasks?view=board", listHref: "/preview/unified-tasks" } };
  return <main className="min-h-screen bg-background p-4 md:p-8"><div className="mx-auto mb-6 flex max-w-[1360px] flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><div><h1 className="text-title font-semibold">Tarefas unificadas · Pré-visualização local</h1><p className="text-meta text-muted-foreground">Dados de exemplo. As alterações desaparecem ao recarregar.</p>{lastAction ? <p role="status" className="text-meta text-muted-foreground">Última ação de teste: {lastAction}</p> : null}</div><Button asChild variant="outline"><a href={board ? "/preview/unified-tasks" : "/preview/unified-tasks?view=board"}>{board ? "Visão geral" : "Quadro de tarefas"}</a></Button></div>{board ? <ProjectTasksPage {...props} /> : <ProjectDetailPage {...props} />}</main>;
}
