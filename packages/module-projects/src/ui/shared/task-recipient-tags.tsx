import type { ProjectTask } from "../../types";
import { clientTasksDictionary as copy } from "../client-tasks/dictionary";
import { ClientTaskState } from "../client-tasks/task-state";
import { TaskStatusTag } from "./task-tags";

export function TaskRecipientTags({ task }: { task: ProjectTask }) {
  const memberTask = task.kind === "client";
  return <>
    <span className={memberTask ? "rounded-md border border-primary/15 bg-primary/5 px-2 py-0.5 text-label font-semibold text-foreground" : "rounded-md border border-border bg-muted/40 px-2 py-0.5 text-label font-semibold text-muted-foreground"}>{memberTask ? copy.memberKind : copy.internalKind}</span>
    {memberTask ? <>
      <span className="rounded-md border border-border px-2 py-0.5 text-label text-muted-foreground">{task.clientPublication === "published" ? copy.published : task.clientPublication === "withdrawn" ? copy.withdrawn : copy.draft}</span>
      {task.clientPublication === "published" && task.clientWorkflow ? <ClientTaskState task={{ workflow: task.clientWorkflow }} /> : null}
    </> : <TaskStatusTag task={task} />}
  </>;
}

export type TaskRecipientFilterValue = "all" | "internal" | "client";
export function matchesTaskRecipient(task: ProjectTask, value: TaskRecipientFilterValue) {
  return value === "all" || (task.kind ?? "internal") === value;
}

export function TaskRecipientFilter({ value, onChange }: { value: TaskRecipientFilterValue; onChange: (value: TaskRecipientFilterValue) => void }) {
  return <div role="group" aria-label={copy.taskFilter} className="flex w-fit max-w-full flex-wrap gap-1 rounded-xl bg-muted/40 p-1">
    {([{ value: "all", label: copy.allTasks }, { value: "internal", label: copy.internalTeam }, { value: "client", label: copy.memberTasks }] as const).map((item) => <button key={item.value} type="button" aria-pressed={item.value === value} onClick={() => onChange(item.value)} className={item.value === value ? "min-h-9 rounded-lg border border-border bg-background px-3 text-meta font-semibold text-foreground shadow-sm" : "min-h-9 rounded-lg border border-transparent px-3 text-meta text-muted-foreground hover:bg-background/60"}>{item.label}</button>)}
  </div>;
}
