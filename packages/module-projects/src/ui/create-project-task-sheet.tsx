"use client";

import { useProjectsUiClient } from "./context";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { CalendarIcon, ClipboardList, Save } from "lucide-react";
import { toast } from "sonner";
import { sheetBodyClassName, sheetFooterClassName, sheetShellClassName } from "./constants";
import { PROJECTS_EVENTS, dispatchProjectsEvent } from "./events";
import { createTask } from "./project-ui-actions";
import {
  sheetAccentTextareaClassName,
  sheetDatePickerButtonClassName,
  sheetEditControlClassName,
  sheetFieldLabelClassName,
} from "./shared/sheet-section";
import { cn } from "./utils";
import { Button } from "@brightweblabs/ui";
import { Calendar } from "@brightweblabs/ui";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@brightweblabs/ui";
import { Input } from "@brightweblabs/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@brightweblabs/ui";
import { Sheet, SheetContent, SheetFooter } from "@brightweblabs/ui";
import { AppSheetHeader, SheetSection } from "./shared/app-sheet";
import { useWindowEventBridge } from "./window-events";


type ProjectOption = {
  id: string;
  name: string;
  organizationName?: string;
};

type CreateProjectTaskSheetProps = {
  projects: ProjectOption[];
  initialOpen?: boolean;
};

function toIsoDate(value?: Date): string {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function CreateProjectTaskSheet({ projects, initialOpen = false }: CreateProjectTaskSheetProps) {
  const client = useProjectsUiClient();
  const [open, setOpen] = useState(initialOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [blockedReason, setBlockedReason] = useState("");

  const canSubmit = useMemo(
    () => projectId.trim().length > 0 && title.trim().length > 0 && (status !== "blocked" || blockedReason.trim().length > 0),
    [blockedReason, projectId, status, title],
  );
  const dueDateValue = useMemo(() => parseIsoDate(dueDate), [dueDate]);
  const isBlockedStatus = status === "blocked";

  const resetForm = () => {
    setProjectId(projects[0]?.id ?? "");
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("medium");
    setDueDate("");
    setBlockedReason("");
  };

  useWindowEventBridge(PROJECTS_EVENTS.openNewTask, () => {
    setOpen(true);
  }, { custom: false });

  useEffect(() => {
    if (!projects.length) {
      setProjectId("");
      return;
    }
    setProjectId((current) => (
      current && projects.some((project) => project.id === current)
        ? current
        : projects[0]?.id || ""
    ));
  }, [projects]);

  useEffect(() => {
    if (status !== "blocked") {
      setBlockedReason("");
    }
  }, [status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await createTask(client, projectId, {
        title,
        description: description.trim() || undefined,
        status,
        priority,
        dueDate: dueDate || undefined,
        blockedReason: isBlockedStatus ? (blockedReason.trim() || undefined) : undefined,
      });
      toast.success("Tarefa criada com sucesso.");
      setOpen(false);
      resetForm();
      dispatchProjectsEvent(PROJECTS_EVENTS.refresh);
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
          icon={ClipboardList}
          editing
          eyebrow="A criar"
          title={<>Nova tarefa</>}
          description={<>Adiciona uma nova tarefa a um projeto existente.</>}
        />

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-0">
          <div className={`${sheetBodyClassName} space-y-4`}>
            <SheetSection title="Detalhes" editing>
              <FieldGroup className="gap-0 px-0 py-1">
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel className={sheetFieldLabelClassName}>Projeto</FieldLabel>
                  <FieldContent>
                    <select
                      id="task-project-id"
                      className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                      value={projectId}
                      onChange={(event) => setProjectId(event.target.value)}
                      required
                      disabled={projects.length === 0}
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.organizationName ? `${project.organizationName} · ` : ""}
                          {project.name}
                        </option>
                      ))}
                    </select>
                    {projects.length === 0 ? <p className="mt-1 text-[10px] text-foreground/55">Sem projetos disponíveis.</p> : null}
                  </FieldContent>
                </Field>
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel className={sheetFieldLabelClassName}>Título</FieldLabel>
                  <FieldContent>
                    <Input
                      id="task-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      required
                      className={cn(sheetEditControlClassName, "mt-1.5")}
                    />
                  </FieldContent>
                </Field>
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel className={sheetFieldLabelClassName}>Descrição</FieldLabel>
                  <FieldContent>
                    <textarea
                      id="task-description"
                      rows={3}
                      className={cn("mt-1.5 min-h-[72px]", sheetAccentTextareaClassName)}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Contexto, objetivo e critério de conclusão..."
                    />
                  </FieldContent>
                </Field>
              </FieldGroup>
            </SheetSection>

            <SheetSection title="Planeamento" editing>
              <FieldGroup className="gap-0 px-0 py-1">
                <div className="grid grid-cols-2 gap-3">
                  <Field className="gap-1.5 px-4 py-2">
                    <FieldLabel className={sheetFieldLabelClassName}>Estado</FieldLabel>
                    <FieldContent>
                      <select
                        id="task-status"
                        className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                      >
                        <option value="todo">Por fazer</option>
                        <option value="in_progress">Em progresso</option>
                        <option value="blocked">Bloqueada</option>
                        <option value="done">Concluída</option>
                      </select>
                    </FieldContent>
                  </Field>
                  <Field className="gap-1.5 px-4 py-2">
                    <FieldLabel className={sheetFieldLabelClassName}>Prioridade</FieldLabel>
                    <FieldContent>
                      <select
                        id="task-priority"
                        className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                        value={priority}
                        onChange={(event) => setPriority(event.target.value)}
                      >
                        <option value="low">Baixa</option>
                        <option value="medium">Média</option>
                        <option value="high">Alta</option>
                        <option value="critical">Crítica</option>
                      </select>
                    </FieldContent>
                  </Field>
                </div>
                <Field className="gap-1.5 px-4 py-2">
                  <FieldLabel className={sheetFieldLabelClassName}>Data limite (opcional)</FieldLabel>
                  <FieldContent>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="task-due-date"
                          type="button"
                          variant="ghost"
                          className={cn(
                            "mt-1.5",
                        sheetDatePickerButtonClassName,
                            dueDateValue ? "text-foreground" : "text-foreground/45",
                          )}
                        >
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
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
                  </FieldContent>
                </Field>
                {isBlockedStatus ? (
                  <Field className="gap-1.5 px-4 py-2">
                    <FieldLabel className={sheetFieldLabelClassName}>
                      Motivo de bloqueio
                    </FieldLabel>
                    <FieldContent>
                      <Input
                        id="task-blocked-reason"
                        value={blockedReason}
                        onChange={(event) => setBlockedReason(event.target.value)}
                        placeholder="Descreve o que está a bloquear esta tarefa"
                        required
                        className={cn(sheetEditControlClassName, "mt-1.5")}
                      />
                    </FieldContent>
                  </Field>
                ) : null}
              </FieldGroup>
            </SheetSection>
          </div>

          <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
            <Button type="submit" className="flex-1" disabled={!canSubmit || isSubmitting || projects.length === 0}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "A criar..." : "Criar tarefa"}
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancelar
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
