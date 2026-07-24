"use client";

import { useProjectsUiClient, useProjectsUiDictionary } from "../context";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { CalendarIcon, ListChecks, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Calendar } from "@brightweblabs/ui";
import { Input } from "@brightweblabs/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@brightweblabs/ui";
import { Sheet, SheetContent, SheetFooter } from "@brightweblabs/ui";
import { cn } from "../utils";
import { useWindowEventBridge } from "../window-events";


type ProjectTaskCreateSheetProps = {
  projectId: string;
  milestones: Array<{ id: string; title: string }>;
  members: Array<{ profileId: string; label: string }>;
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
  const [open, setOpen] = useState(initialOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [milestoneId, setMilestoneId] = useState("");
  const [assigneeProfileId, setAssigneeProfileId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const dueDateValue = useMemo(() => parseIsoDate(dueDate), [dueDate]);
  const memberOptions = useMemo(
    () =>
      members
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

  useWindowEventBridge(PROJECTS_EVENTS.openNewTask, () => {
    setOpen(true);
  }, { custom: false });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("medium");
    setMilestoneId("");
    setAssigneeProfileId("");
    setDueDate("");
    setBlockedReason("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !title.trim()) return;

    setIsSubmitting(true);
    try {
      await createTask(client, projectId, {
        title,
        description: description.trim() || undefined,
        status,
        priority,
        milestoneId: milestoneId || undefined,
        assigneeProfileId: assigneeProfileId || undefined,
        dueDate: dueDate || undefined,
        blockedReason: blockedReason.trim() || undefined,
      });
      toast.success(dictionary.create.taskCreated);
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : dictionary.create.taskCreateFallbackError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className={sheetShellClassName}>
        <AppSheetHeader
          icon={ListChecks}
          editing
          eyebrow={dictionary.create.creatingEyebrow}
          title={dictionary.forms.newTask}
          description={dictionary.create.taskDescription}
        />

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className={`${sheetBodyClassName} space-y-4`}>
            <SheetSection title={dictionary.board.task} editing bodyClassName="space-y-3 px-4 py-3">
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="task-create-title">{dictionary.forms.title}</label>
                <Input
                  id="task-create-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  className={cn(sheetEditControlClassName, "mt-1.5")}
                />
              </div>
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="task-create-desc">{dictionary.create.optionalDescription}</label>
                <textarea
                  id="task-create-desc"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)}
                />
              </div>
            </SheetSection>

            <SheetSection title={dictionary.create.classification} editing bodyClassName="space-y-3 px-4 py-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-create-status">{dictionary.forms.status}</label>
                  <select
                    id="task-create-status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                  >
                    <option value="todo">{dictionary.board.columns.todo}</option>
                    <option value="in_progress">{dictionary.board.columns.in_progress}</option>
                    <option value="blocked">{dictionary.board.columns.blocked}</option>
                    <option value="done">{dictionary.board.columns.done}</option>
                  </select>
                </div>
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-create-priority">{dictionary.forms.priority}</label>
                  <select
                    id="task-create-priority"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                    className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                  >
                    <option value="low">{dictionary.board.priority.low}</option>
                    <option value="medium">{dictionary.board.priority.medium}</option>
                    <option value="high">{dictionary.board.priority.high}</option>
                    <option value="urgent">{dictionary.board.priority.urgent}</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-create-milestone">{dictionary.create.milestoneOptional}</label>
                  <select
                    id="task-create-milestone"
                    value={milestoneId}
                    onChange={(event) => setMilestoneId(event.target.value)}
                    className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                  >
                    <option value="">{dictionary.board.noMilestone}</option>
                    {milestones.map((milestone) => (
                      <option key={milestone.id} value={milestone.id}>
                        {milestone.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-create-assignee">{dictionary.create.assigneeOptional}</label>
                  <select
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
                  </select>
                </div>
              </div>
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
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="task-create-blocked">{dictionary.create.blockedReasonOptional}</label>
                <Input
                  id="task-create-blocked"
                  value={blockedReason}
                  onChange={(event) => setBlockedReason(event.target.value)}
                  className={cn(sheetEditControlClassName, "mt-1.5")}
                />
              </div>
            </SheetSection>
          </div>
          <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
            <Button type="submit" className="flex-1" disabled={isSubmitting || !title.trim()}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? dictionary.create.creating : dictionary.create.createTask}
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              {dictionary.actions.cancel}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
