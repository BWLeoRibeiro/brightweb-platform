"use client";

import { clientTasksDictionary as copy } from "../client-tasks/dictionary";
import { useOptionalMemberTasks, MemberTaskLoadStatus } from "../client-tasks/staff-client-tasks";
import { TaskRecipientSelector, MemberTaskResponsibleField, MemberTaskAudienceFields, useMemberTaskRecipients, type TaskRecipient } from "../task-recipient-fields";

import { useTaskSubmission } from "../use-task-submission";

import { validateTaskDraft } from "../task-form";

import { StyledSelect } from "@brightweblabs/ui";

import { useProjectsUiClient, useProjectsUiDictionary } from "../context";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { CalendarIcon, ListChecks, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useShellAction } from "@brightweblabs/app-shell";
import {
  sheetBodyClassName,
  sheetFooterClassName,
  sheetShellClassName,
} from "../constants";
import { PROJECTS_EVENTS } from "../events";
import { createTask } from "../project-ui-actions";
import { parseIsoDate, toIsoDate } from "./date-utils";
import { AppSheetHeader, SheetSection } from "../shared/app-sheet";
import { sheetAccentTextareaClassName, sheetDatePickerButtonClassName, sheetEditControlClassName, sheetFieldLabelClassName } from "../shared/sheet-section";
import { Button } from "@brightweblabs/ui";
import { ProjectCalendar as Calendar } from "../shared/project-calendar";
import { Input } from "@brightweblabs/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@brightweblabs/ui";
import { Sheet, SheetContent, SheetFooter } from "@brightweblabs/ui";
import { cn } from "../utils";


type ProjectTaskCreateSheetProps = {
  projectId: string;
  milestones: Array<{ id: string; title: string; visibility?: string }>;
  members: Array<{ profileId: string; label: string; role?: "owner" | "contributor" | "observer" }>;
  initialOpen?: boolean;
};

export function ProjectTaskCreateSheet({
  projectId,
  milestones,
  members,
  initialOpen = false,
}: ProjectTaskCreateSheetProps) {
  const client = useProjectsUiClient();
  const dictionary = useProjectsUiDictionary();
  const router = useRouter();
  const memberTasks = useOptionalMemberTasks();
  const organizations = memberTasks?.resource.data?.organizations ?? [];
  const recipients = useMemberTaskRecipients(null, organizations);
  const [recipient, setRecipient] = useState<TaskRecipient>("internal");
  const isMemberTask = recipient === "client";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [milestoneId, setMilestoneId] = useState("");
  const [assigneeProfileId, setAssigneeProfileId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const { open, onOpenChange, isSubmitting, submit } = useTaskSubmission(client, projectId, initialOpen);
  const busy = isSubmitting || Boolean(isMemberTask && memberTasks?.resource.busy);
  const taskDraft = validateTaskDraft({ projectId, title, status, blockedReason, startDate, dueDate });
  useEffect(() => { if (status !== "blocked") setBlockedReason(""); }, [status]);
  const startDateValue = useMemo(() => parseIsoDate(startDate), [startDate]);
  const dueDateValue = useMemo(() => parseIsoDate(dueDate), [dueDate]);
  const memberOptions = useMemo(
    () =>
      members
        .filter((member) => member.role !== "observer")
        .map((member) => ({
          profileId: member.profileId,
          label: member.label.trim() || dictionary.people.noName,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-PT", { sensitivity: "base" })),
    [dictionary.people.noName, members],
  );

  useEffect(() => {
    setMilestoneId((current) => (
      current && milestones.some((milestone) => milestone.id === current) ? current : ""
    ));
  }, [milestones]);

  useEffect(() => {
    setAssigneeProfileId((current) => (
      current && members.some((member) => member.profileId === current) ? current : ""
    ));
  }, [members]);

  useShellAction(PROJECTS_EVENTS.openNewTask, () => {
    onOpenChange(true);
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("medium");
    setMilestoneId("");
    setAssigneeProfileId("");
    setStartDate("");
    setDueDate("");
    setBlockedReason("");
  };

  const canSave = isMemberTask
    ? Boolean(memberTasks?.canCreateMemberTasks && title.trim() && description.trim() && recipients.valid)
    : taskDraft.valid;
  const changeRecipient = (next: TaskRecipient) => {
    if (busy || (next === "client" && !memberTasks?.canCreateMemberTasks)) return;
    setRecipient(next);
    setAssigneeProfileId("");
    recipients.reset();
    // A private milestone must never cross into member-facing configuration.
    if (next === "client" && !milestones.some((milestone) => milestone.id === milestoneId && milestone.visibility === "client")) setMilestoneId("");
  };
  const changeOpen = (next: boolean) => {
    if (isMemberTask && busy) return;
    onOpenChange(next);
    if (!next && isMemberTask) {
      resetForm();
      recipients.reset();
      setRecipient("internal");
    }
  };
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !canSave) return;
    await submit({
      save: async () => {
        if (isMemberTask) {
          const saved = await memberTasks?.createMemberTask({
            clientTitle: title.trim(), clientInstructions: description.trim(), ...recipients.input,
            milestoneId: milestones.some((milestone) => milestone.id === milestoneId && milestone.visibility === "client") ? milestoneId : null,
            dueDate: dueDate || null,
          });
          if (!saved) throw new Error(copy.saveError);
          return;
        }
        return createTask(client, projectId, {
          ...taskDraft.input, description: description.trim() || undefined, status, priority,
          milestoneId: milestoneId || undefined, assigneeProfileId: memberOptions.some((member) => member.profileId === assigneeProfileId) ? assigneeProfileId : undefined,
        });
      },
      onPersisted: () => { if (!isMemberTask) router.refresh(); },
      onSuccess: () => {
        if (!isMemberTask) toast.success(dictionary.create.taskCreated);
        onOpenChange(false);
        resetForm();
        recipients.reset();
        setRecipient("internal");
      },
      onError: (error) => {
        if (!isMemberTask) toast.error(error instanceof Error ? error.message : dictionary.create.taskCreateFallbackError);
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetContent className={sheetShellClassName}>
        <AppSheetHeader
          icon={ListChecks}
          editing
          eyebrow={dictionary.create.creatingEyebrow}
          title={dictionary.forms.newTask}
          description={isMemberTask ? copy.draftHint : dictionary.create.taskDescription}
        />

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <fieldset disabled={busy} className={`${sheetBodyClassName} min-w-0 space-y-4`}>
            <SheetSection title={dictionary.board.contentSection} editing bodyClassName="space-y-3 px-4 py-3">
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="task-create-title">{dictionary.forms.title}</label>
                <Input
                  id="task-create-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  maxLength={isMemberTask ? 240 : undefined}
                  className={cn(sheetEditControlClassName, "mt-1.5")}
                />
              </div>
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="task-create-desc">{isMemberTask ? copy.instructions : dictionary.create.optionalDescription}</label>
                <textarea
                  id="task-create-desc"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required={isMemberTask}
                  maxLength={isMemberTask ? 20000 : undefined}
                  rows={3}
                  className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)}
                />
              </div>
            </SheetSection>

            <SheetSection title={dictionary.board.planningSection} editing bodyClassName="space-y-4 px-4 py-3">
              <TaskRecipientSelector value={recipient} onChange={changeRecipient} canCreateMemberTasks={Boolean(memberTasks?.canCreateMemberTasks)} />
              {isMemberTask ? <MemberTaskResponsibleField recipients={recipients} id="task-create-member-assignee" /> : (
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-create-assignee">{dictionary.create.assigneeOptional}</label>
                  <StyledSelect
                    id="task-create-assignee"
                    value={assigneeProfileId}
                    onChange={(event) => setAssigneeProfileId(event.target.value)}
                    className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                  >
                    <option value="">{dictionary.board.noAssignee}</option>
                    {memberOptions.map((member) => (
                      <option key={member.profileId} value={member.profileId}>
                        {member.label}
                      </option>
                    ))}
                  </StyledSelect>
                </div>
              )}
              {isMemberTask ? <>
                <MemberTaskLoadStatus />
                <MemberTaskAudienceFields recipients={recipients} organizations={organizations} id="task-create-member" />
              </> : <p className="text-meta text-muted-foreground">{copy.staffAssigneeHint}</p>}
            </SheetSection>
            {!isMemberTask ? <>
            <SheetSection title={dictionary.board.executionSection} editing bodyClassName="space-y-3 px-4 py-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-create-status">{dictionary.forms.status}</label>
                  <StyledSelect
                    id="task-create-status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                  >
                    <option value="todo">{dictionary.board.columns.todo}</option>
                    <option value="in_progress">{dictionary.board.columns.in_progress}</option>
                    <option value="blocked">{dictionary.board.columns.blocked}</option>
                    <option value="done">{dictionary.board.columns.done}</option>
                  </StyledSelect>
                </div>
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-create-priority">{dictionary.forms.priority}</label>
                  <StyledSelect
                    id="task-create-priority"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                    className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                  >
                    <option value="low">{dictionary.board.priority.low}</option>
                    <option value="medium">{dictionary.board.priority.medium}</option>
                    <option value="high">{dictionary.board.priority.high}</option>
                    <option value="urgent">{dictionary.board.priority.urgent}</option>
                  </StyledSelect>
                </div>
              </div>
              {status === "blocked" ? (
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-create-blocked">{dictionary.forms.blockedReason}</label>
                  <Input id="task-create-blocked" value={blockedReason} onChange={(event) => setBlockedReason(event.target.value)} required className={cn(sheetEditControlClassName, "mt-1.5")} />
                </div>
              ) : null}
            </SheetSection>

            </> : null}
            <SheetSection title={dictionary.board.planningSection} editing bodyClassName="space-y-3 px-4 py-3">
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="task-create-milestone">{isMemberTask ? copy.milestoneOptional : dictionary.create.milestoneOptional}</label>
                <StyledSelect id="task-create-milestone" value={milestoneId} onChange={(event) => setMilestoneId(event.target.value)} className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}>
                  <option value="">{dictionary.board.noMilestone}</option>
                  {milestones.filter((milestone) => !isMemberTask || milestone.visibility === "client").map((milestone) => <option key={milestone.id} value={milestone.id}>{milestone.title}</option>)}
                </StyledSelect>
              </div>
            </SheetSection>

            <SheetSection title={dictionary.board.calendarSection} editing bodyClassName="px-4 py-3">
              <div className="grid gap-3 sm:grid-cols-2">
              {!isMemberTask ? <div>
                <label className={sheetFieldLabelClassName} htmlFor="task-create-start">{dictionary.create.startDateOptional}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="task-create-start" type="button" variant="ghost" className={cn("mt-1.5", sheetDatePickerButtonClassName, startDateValue ? "text-foreground" : "text-foreground/45")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDateValue ? format(startDateValue, "dd/MM/yyyy") : dictionary.create.selectDate}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" captionLayout="dropdown" className="rounded-lg border" selected={startDateValue} onSelect={(date) => setStartDate(toIsoDate(date))} initialFocus />
                  </PopoverContent>
                </Popover>
              </div> : null}
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="task-create-due">{dictionary.create.dueDateOptional}</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="task-create-due"
                      type="button"
                      variant="ghost"
                      className={cn(
                        "mt-1.5",
                        sheetDatePickerButtonClassName,
                        dueDateValue ? "text-foreground" : "text-foreground/45",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDateValue ? format(dueDateValue, "dd/MM/yyyy") : dictionary.create.selectDate}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown"
                      className="rounded-lg border"
                      selected={dueDateValue}
                      onSelect={(date) => setDueDate(toIsoDate(date))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              </div>
            </SheetSection>
          </fieldset>
          <SheetFooter className={`${sheetFooterClassName} flex-row flex-wrap gap-2`}>
            <p className="w-full text-meta text-muted-foreground">{isMemberTask ? copy.draftHint : copy.internalRecipientHint}</p>
            <Button type="submit" className="flex-1" disabled={busy || !canSave}>
              <Save className="mr-2 h-4 w-4" />
              {busy ? dictionary.create.creating : isMemberTask ? copy.saveDraft : dictionary.create.createTask}
            </Button>
            <Button type="button" variant="outline" className="flex-1" disabled={isMemberTask && busy} onClick={() => changeOpen(false)}>
              {dictionary.actions.cancel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
