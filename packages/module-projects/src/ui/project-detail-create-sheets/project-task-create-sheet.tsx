"use client";

import { useProjectsUiClient } from "../context";
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
          label: member.label.trim() || "Sem nome",
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-PT", { sensitivity: "base" })),
    [members],
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
      toast.success("Tarefa criada com sucesso.");
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar tarefa.");
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
          eyebrow="A criar"
          title="Nova tarefa"
          description="Adiciona uma nova tarefa e liga-a a um responsável ou milestone."
        />

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className={`${sheetBodyClassName} space-y-4`}>
            <SheetSection title="Tarefa" editing bodyClassName="space-y-3 px-4 py-3">
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="task-create-title">Título</label>
                <Input
                  id="task-create-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  className={cn(sheetEditControlClassName, "mt-1.5")}
                />
              </div>
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="task-create-desc">Descrição (opcional)</label>
                <textarea
                  id="task-create-desc"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)}
                />
              </div>
            </SheetSection>

            <SheetSection title="Classificação e atribuição" editing bodyClassName="space-y-3 px-4 py-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-create-status">Estado</label>
                  <select
                    id="task-create-status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                  >
                    <option value="todo">Por fazer</option>
                    <option value="in_progress">Em progresso</option>
                    <option value="blocked">Bloqueada</option>
                    <option value="done">Concluída</option>
                  </select>
                </div>
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-create-priority">Prioridade</label>
                  <select
                    id="task-create-priority"
                    value={priority}
                    onChange={(event) => setPriority(event.target.value)}
                    className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-create-milestone">Milestone (opcional)</label>
                  <select
                    id="task-create-milestone"
                    value={milestoneId}
                    onChange={(event) => setMilestoneId(event.target.value)}
                    className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                  >
                    <option value="">Sem milestone</option>
                    {milestones.map((milestone) => (
                      <option key={milestone.id} value={milestone.id}>
                        {milestone.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="task-create-assignee">Responsável (opcional)</label>
                  <select
                    id="task-create-assignee"
                    value={assigneeProfileId}
                    onChange={(event) => setAssigneeProfileId(event.target.value)}
                    className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                  >
                    <option value="">Sem responsável</option>
                    {memberOptions.map((member) => (
                      <option key={member.profileId} value={member.profileId}>
                        {member.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="task-create-due">Data limite (opcional)</label>
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
                      {dueDateValue ? format(dueDateValue, "dd/MM/yyyy") : "Selecionar data"}
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
                <label className={sheetFieldLabelClassName} htmlFor="task-create-blocked">Motivo de bloqueio (opcional)</label>
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
              {isSubmitting ? "A criar..." : "Criar tarefa"}
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
