"use client";
import { clientTasksDictionary as copy } from "./dictionary";

import { createContext, useContext, useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Sheet, SheetContent, StyledSelect } from "@brightweblabs/ui";
import { ListChecks } from "lucide-react";
import type { ProjectTask } from "../../types";
import type { ClientTaskConfigurationInput, ClientTaskWorkbench, StaffClientTask } from "../../client-tasks-contracts";
import { useProjectsUiClient } from "../context";
import { useProjectDetailData } from "../project-detail-data-provider";
import { AppSheetHeader } from "../shared/app-sheet";
import { sheetAccentTextareaClassName, sheetFieldLabelClassName } from "../shared/sheet-section";
import { sheetBodyClassName, sheetShellClassName } from "../constants";
import { ClientTaskResourceMessage, ClientTaskState } from "./task-state";
import { useClientTaskResource } from "./use-client-task-resource";
import { TaskRecipientSelector, MemberTaskResponsibleField, MemberTaskAudienceFields, useMemberTaskRecipients } from "../task-recipient-fields";

const OPEN_CLIENT_TASK_EVENT = "projects:open-client-task";
export function openClientTaskPanel(projectId: string, taskId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_CLIENT_TASK_EVENT, { detail: { projectId, taskId } }));
}

type Capabilities = ClientTaskWorkbench["capabilities"];
type Action = "create" | "configure" | "publish" | "withdraw" | "return" | "accept";
type Mutate = (task: StaffClientTask | null, action: Action, input: object) => Promise<boolean>;

function ClientTaskConfiguration({ task, organizations, milestones, busy, save }: {
  task: StaffClientTask | null;
  organizations: ClientTaskWorkbench["organizations"];
  milestones: Array<{ id: string; title: string; visibility?: string }>;
  busy: boolean;
  save: (input: ClientTaskConfigurationInput) => Promise<void>;
}) {
  const id = useId();
  const [title, setTitle] = useState(task?.clientTitle ?? "");
  const [instructions, setInstructions] = useState(task?.clientInstructions ?? "");
  const recipients = useMemberTaskRecipients(task, organizations);
  const [milestoneId, setMilestoneId] = useState(task?.milestone?.id ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || !title.trim() || !instructions.trim() || !recipients.valid) return;
    void save({
      clientTitle: title.trim(), clientInstructions: instructions.trim(), ...recipients.input,
      milestoneId: milestoneId || null, dueDate: dueDate || null,
    });
  };
  return <form onSubmit={submit} className="space-y-4" data-testid="client-task-configuration">
    <fieldset disabled={busy} className="space-y-4">
      <div><label className={sheetFieldLabelClassName} htmlFor={`${id}-title`}>{copy.title}</label><Input id={`${id}-title`} className="mt-1.5" required maxLength={240} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
      <div><label className={sheetFieldLabelClassName} htmlFor={`${id}-instructions`}>{copy.instructions}</label><textarea id={`${id}-instructions`} required rows={5} maxLength={20000} className={`${sheetAccentTextareaClassName} mt-1.5 w-full`} value={instructions} onChange={(event) => setInstructions(event.target.value)} /><p className="mt-1 text-meta text-muted-foreground">{copy.instructionsHint}</p></div>
      <TaskRecipientSelector value="client" locked />
      <MemberTaskResponsibleField recipients={recipients} id={`${id}-responsible`} />
      <MemberTaskAudienceFields recipients={recipients} organizations={organizations} id={id} />
      <div><label className={sheetFieldLabelClassName} htmlFor={`${id}-milestone`}>{copy.milestoneOptional}</label><StyledSelect id={`${id}-milestone`} className="mt-1.5 w-full" value={milestoneId} onChange={(event) => setMilestoneId(event.target.value)}><option value="">{copy.noMilestone}</option>{milestones.filter((milestone) => milestone.visibility === "client").map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}</StyledSelect></div>
      <div><label className={sheetFieldLabelClassName} htmlFor={`${id}-due`}>{copy.dueOptional}</label><Input id={`${id}-due`} className="mt-1.5" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>
      {task?.publication === "published" ? <p role="note" className="rounded-xl border border-border bg-muted/30 p-3 text-body">{copy.configurePublishedWarning}</p> : <p className="text-meta text-muted-foreground">{copy.draftHint}</p>}
      <Button type="submit" disabled={busy || !title.trim() || !instructions.trim() || !recipients.valid}>{busy ? copy.saving : task?.publication === "published" ? copy.saveAndWithdraw : copy.saveDraft}</Button>
    </fieldset>
  </form>;
}

function StaffTaskReview({ task, busy, mutate }: { task: StaffClientTask; busy: boolean; mutate: Mutate }) {
  const id = useId();
  const [feedback, setFeedback] = useState("");
  return <section className="space-y-3 rounded-xl border border-border p-4" data-testid="client-task-review">
    <h3 className="text-title font-semibold">{copy.reviewVersionPrefix}{task.submissionSequence}</h3>
    <p className="text-meta text-muted-foreground">{copy.publicationPrefix}{task.publicationGeneration}{copy.exactReviewHint}</p>
    <p className="whitespace-pre-wrap text-body">{task.response || copy.noWrittenResponse}</p>
    <label htmlFor={id} className={sheetFieldLabelClassName}>{copy.feedbackRequired}</label>
    <textarea id={id} value={feedback} rows={3} maxLength={20000} disabled={busy} className={`${sheetAccentTextareaClassName} w-full`} onChange={(event) => setFeedback(event.target.value)} />
    <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy || !feedback.trim()} onClick={() => void mutate(task, "return", { submissionSequence: task.submissionSequence, feedback: feedback.trim() })}>{copy.returnForCorrection}</Button><Button type="button" disabled={busy} onClick={() => void mutate(task, "accept", { submissionSequence: task.submissionSequence, feedback: feedback.trim() })}>{copy.accept}</Button></div>
  </section>;
}

type MemberTaskContextValue = {
  resource: ReturnType<typeof useClientTaskResource<ClientTaskWorkbench>>;
  canCreateMemberTasks: boolean;
  createMemberTask: (input: ClientTaskConfigurationInput) => Promise<boolean>;
};
const MemberTaskContext = createContext<MemberTaskContextValue | null>(null);
export function useOptionalMemberTasks() { return useContext(MemberTaskContext); }
export function usePresentedProjectTasks(tasks: ProjectTask[]) {
  const context = useOptionalMemberTasks();
  const members = context?.resource.data?.tasks;
  return useMemo(() => {
  const memberTasks = new Map(members?.map((task) => [task.id, task]));
  return tasks.map((task) => {
    const memberTask = task.kind === "client" ? memberTasks.get(task.id) : null;
    return memberTask ? { ...task, title: memberTask.clientTitle, description: memberTask.clientInstructions, assigneeLabel: memberTask.responsibleLabel, assigneeProfileId: memberTask.responsibleProfileId, clientPublication: memberTask.publication, clientWorkflow: memberTask.workflow } : task;
  });
  }, [tasks, members]);
}
export function MemberTaskLoadStatus() {
  const context = useOptionalMemberTasks();
  if (!context || (context.resource.state === "ready" && !context.resource.message)) return null;
  return <div className="space-y-1" aria-label={copy.staffTitle}><p className="text-label font-semibold text-muted-foreground">{copy.staffTitle}</p>{context.resource.message ? <p role="alert" className="text-body text-muted-foreground">{context.resource.message}</p> : null}<ClientTaskResourceMessage state={context.resource.state} refresh={context.resource.refresh} /></div>;
}

export function ProjectClientTasksProvider({ projectId, capabilities, children }: { projectId: string; capabilities: Capabilities; children: ReactNode }) {
  const client = useProjectsUiClient();
  const router = useRouter();
  const { milestones } = useProjectDetailData();
  const url = `/api/projects/${encodeURIComponent(projectId)}/client-tasks`;
  const resource = useClientTaskResource<ClientTaskWorkbench>(url, client.requestRaw);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const task = resource.data?.tasks.find((item) => item.id === selectedId) ?? null;
  const allowed = {
    canCreateTasks: capabilities.canCreateTasks && resource.data?.capabilities.canCreateTasks,
    canShareClientTasks: capabilities.canShareClientTasks && resource.data?.capabilities.canShareClientTasks,
    canReviewClientTasks: capabilities.canReviewClientTasks && resource.data?.capabilities.canReviewClientTasks,
  };
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId: string; taskId: string }>).detail;
      if (detail?.projectId !== projectId) return;
      setSelectedId(detail.taskId); setEditing(false);
      void resource.refresh();
    };
    window.addEventListener(OPEN_CLIENT_TASK_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CLIENT_TASK_EVENT, onOpen);
  }, [projectId, resource.refresh]);
  const mutate: Mutate = async (current, action, input) => {
    const succeeded = await resource.mutate(current ? `${url}/${encodeURIComponent(current.id)}` : url, current ? "PATCH" : "POST", { expectedRevision: current?.revision ?? null, action, input });
    if (succeeded) { setEditing(false); router.refresh(); }
    return succeeded;
  };
  const close = () => { setSelectedId(null); setEditing(false); };
  return <MemberTaskContext.Provider value={{ resource, canCreateMemberTasks: Boolean(allowed.canCreateTasks), createMemberTask: (input) => allowed.canCreateTasks ? mutate(null, "create", input) : Promise.resolve(false) }}>
    {children}
    <Sheet open={Boolean(resource.data && task)} onOpenChange={(open) => { if (!open && !resource.busy) close(); }}>
      <SheetContent className={sheetShellClassName}>
        <AppSheetHeader icon={ListChecks} editing={editing} eyebrow={copy.taskEyebrow} title={task?.clientTitle || copy.taskEyebrow} description={copy.sheetDescription} />
        <div className={`${sheetBodyClassName} space-y-5`}>
          {resource.message ? <p role="alert" className="text-body">{resource.message}</p> : null}
          {editing && task ? <><ClientTaskConfiguration key={task ? `${task.id}:${task.revision}` : "create"} task={task} organizations={resource.data?.organizations ?? []} milestones={milestones} busy={resource.busy} save={async (input) => { await mutate(task, task ? "configure" : "create", input); }} /><Button type="button" variant="outline" disabled={resource.busy} onClick={() => setEditing(false)}>{copy.cancel}</Button></> : task ? <>
            <div className="flex flex-wrap items-center gap-2"><ClientTaskState task={task} /><span className="text-meta text-muted-foreground">{task.publication === "published" ? copy.published : task.publication === "draft" ? copy.draftPrivate : copy.withdrawnFromClient}</span></div>
            <p className="whitespace-pre-wrap text-body">{task.clientInstructions}</p>
            <dl className="space-y-3 text-body"><div><dt className="text-label text-muted-foreground">{copy.taskFor}</dt><dd>{copy.organizationMembers}</dd></div><div><dt className="text-label text-muted-foreground">{copy.organization}</dt><dd>{resource.data?.organizations.find((organization) => organization.id === task.organizationId)?.name ?? copy.organizationUnavailable}</dd></div><div><dt className="text-label text-muted-foreground">{copy.audienceLabel}</dt><dd>{task.audienceMode === "all_eligible" ? copy.allEligible : copy.selectedCount(task.selectedProfileIds.length)}</dd></div><div><dt className="text-label text-muted-foreground">{copy.responsibleClient}</dt><dd>{task.responsibleLabel ?? copy.noResponsible}</dd></div><div><dt className="text-label text-muted-foreground">{copy.milestoneAndDue}</dt><dd>{task.milestone?.title ?? copy.noMilestone} · {task.dueDate ?? copy.noDueDate}</dd></div></dl>
            {allowed.canShareClientTasks ? <div className="space-y-3"><Button type="button" variant="outline" disabled={resource.busy} onClick={() => setEditing(true)}>{copy.editConfiguration}</Button>{task.publication === "published" ? <div><p className="mb-2 text-meta text-muted-foreground">{copy.withdrawHint}</p><Button type="button" variant="outline" disabled={resource.busy} onClick={() => void mutate(task, "withdraw", {})}>{copy.withdraw}</Button></div> : <div><p className="mb-2 text-meta text-muted-foreground">{copy.publishHint}</p><Button type="button" disabled={resource.busy || !task.clientTitle.trim() || !task.clientInstructions.trim()} onClick={() => void mutate(task, "publish", {})}>{copy.publish}</Button></div>}</div> : null}
            {allowed.canReviewClientTasks && task.publication === "published" && task.workflow === "submitted" && task.submissionSequence !== null ? <StaffTaskReview key={`${task.id}:${task.revision}`} task={task} busy={resource.busy} mutate={mutate} /> : null}
            {task.submissions.length > 0 ? <section className="space-y-3 border-t border-border pt-4"><h3 className="text-title font-semibold">{copy.history}</h3><ol className="space-y-3">{task.submissions.map((submission) => <li key={submission.sequence} className="rounded-xl border border-border p-3"><p className="text-label font-semibold">{copy.versionPrefix}{submission.sequence} {copy.publicationHistoryPrefix}{submission.publicationGeneration}</p><p className="mt-1 text-meta text-muted-foreground">{submission.submittedAt}</p><p className="mt-2 whitespace-pre-wrap text-body">{submission.response || copy.noWrittenResponse}</p>{submission.reviewFeedback ? <p className="mt-2 whitespace-pre-wrap text-body"><strong>{copy.feedbackPrefix}</strong>{submission.reviewFeedback}</p> : null}</li>)}</ol></section> : null}
          </> : null}
        </div>
      </SheetContent>
    </Sheet>
  </MemberTaskContext.Provider>;
}
