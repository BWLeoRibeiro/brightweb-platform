"use client";
import { clientTasksDictionary as copy } from "../client-tasks/dictionary";

import { useState } from "react";
import { Button } from "@brightweblabs/ui";
import type { ClientTask } from "../../client-tasks-contracts";
import { ClientTaskResourceMessage, ClientTaskState } from "../client-tasks/task-state";
import { useClientTaskResource } from "../client-tasks/use-client-task-resource";
import { sheetAccentTextareaClassName, sheetFieldLabelClassName } from "../shared/sheet-section";
import { formatClientProjectDate } from "./shared";

function ClientTaskResponse({ task, busy, act }: { task: ClientTask; busy: boolean; act: (task: ClientTask, action: "start" | "submit", response?: string) => Promise<void> }) {
  const [response, setResponse] = useState(task.response ?? "");
  const editable = ["open", "in_progress", "returned"].includes(task.workflow);
  return <li data-client-task-id={task.id} className="space-y-4 rounded-[var(--radius-card)] border border-border/60 bg-background/55 p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><h3 className="text-title font-semibold">{task.clientTitle}</h3><ClientTaskState task={task} /></div>
    <p className="whitespace-pre-wrap text-body leading-relaxed">{task.clientInstructions}</p>
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-meta text-muted-foreground">
      {task.milestone ? <div><dt className="font-semibold">{copy.milestone}</dt><dd>{task.milestone.title}</dd></div> : null}
      {task.dueDate ? <div><dt className="font-semibold">{copy.dueDate}</dt><dd>{formatClientProjectDate(task.dueDate)}</dd></div> : null}
      {task.responsibleLabel ? <div><dt className="font-semibold">{copy.responsible}</dt><dd>{task.responsibleLabel}</dd></div> : null}
    </dl>
    {task.reviewFeedback ? <div className="rounded-xl border border-border bg-muted/30 p-4"><p className="text-label font-semibold">{copy.teamFeedback}</p><p className="mt-2 whitespace-pre-wrap text-body">{task.reviewFeedback}</p></div> : null}
    {editable ? <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void act(task, "submit", response); }}>
      <label className={sheetFieldLabelClassName} htmlFor={`client-task-response-${task.id}`}>{copy.response}</label>
      <textarea id={`client-task-response-${task.id}`} className={`${sheetAccentTextareaClassName} w-full`} rows={4} maxLength={20000} required value={response} disabled={busy} onChange={(event) => setResponse(event.target.value)} />
      <p className="text-meta text-muted-foreground">{copy.responseHint}</p>
      <div className="flex flex-wrap gap-2">
        {task.workflow === "open" || task.workflow === "returned" ? <Button type="button" variant="outline" disabled={busy} onClick={() => void act(task, "start")}>{copy.start}</Button> : null}
        <Button type="submit" disabled={busy || !response.trim()}>{busy ? copy.saving : copy.submit}</Button>
      </div>
    </form> : <div><p className="text-label font-semibold">{copy.sentResponse}{task.submissionSequence ? copy.sentVersion(task.submissionSequence) : ""}</p><p className="mt-2 whitespace-pre-wrap text-body text-muted-foreground">{task.response || copy.noWrittenResponse}</p></div>}
  </li>;
}

export function ClientProjectTasks({ projectId }: { projectId: string }) {
  const url = `/api/account/projects/${encodeURIComponent(projectId)}/tasks`;
  const resource = useClientTaskResource<ClientTask[]>(url);
  const act = async (task: ClientTask, action: "start" | "submit", response?: string) => {
    await resource.mutate(`${url}/${encodeURIComponent(task.id)}`, "POST", {
      expectedRevision: task.revision, action, input: action === "submit" ? { response: response ?? "" } : {},
    });
  };
  return <section aria-labelledby="client-project-tasks-title" data-testid="client-project-tasks" className="space-y-5 rounded-[var(--radius-card)] border border-border/55 bg-background/55 p-6 shadow-[var(--dashboard-shadow-sm)] sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-label text-primary">{copy.collaboration}</p><h2 id="client-project-tasks-title" className="mt-1 text-heading-3 font-bold">{copy.clientTitle}</h2></div><Button type="button" variant="outline" disabled={resource.busy || resource.state === "loading"} onClick={() => void resource.refresh()}>{copy.clientRefresh}</Button></div>
    {resource.message ? <p role="alert" className="text-body text-muted-foreground">{resource.message}</p> : null}
    <ClientTaskResourceMessage state={resource.state} refresh={resource.refresh} />
    {resource.data?.length === 0 ? <p className="text-body text-muted-foreground">{copy.clientEmpty}</p> : null}
    {resource.data ? <ul className="space-y-4">{resource.data.map((task) => <ClientTaskResponse key={`${task.id}:${task.publicationGeneration}:${task.revision}`} task={task} busy={resource.busy} act={act} />)}</ul> : null}
  </section>;
}
