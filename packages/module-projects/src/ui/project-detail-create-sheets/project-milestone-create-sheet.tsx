"use client";

import { useProjectsUiClient } from "../context";
import { useMemo, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { CalendarIcon, Flag, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  sheetBodyClassName,
  sheetFooterClassName,
  sheetShellClassName,
} from "../constants";
import { AppSheetHeader, SheetSection } from "../shared/app-sheet";
import { sheetDatePickerButtonClassName, sheetEditControlClassName, sheetFieldLabelClassName } from "../shared/sheet-section";
import { cn } from "../utils";
import { PROJECTS_EVENTS } from "../events";
import { createMilestone } from "../project-ui-actions";
import { parseIsoDate, toIsoDate } from "./date-utils";
import { Button } from "@brightweblabs/ui";
import { Calendar } from "@brightweblabs/ui";
import { Input } from "@brightweblabs/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@brightweblabs/ui";
import {
  Sheet,
  SheetContent,
  SheetFooter,
} from "@brightweblabs/ui";
import { useWindowEventBridge } from "../window-events";

type ProjectMilestoneCreateSheetProps = {
  projectId: string;
  initialOpen?: boolean;
};

export function ProjectMilestoneCreateSheet({ projectId, initialOpen = false }: ProjectMilestoneCreateSheetProps) {
  const client = useProjectsUiClient();
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("pending");
  const [targetDate, setTargetDate] = useState("");
  const targetDateValue = useMemo(() => parseIsoDate(targetDate), [targetDate]);

  useWindowEventBridge(PROJECTS_EVENTS.openNewMilestone, () => {
    setOpen(true);
  }, { custom: false });

  const resetForm = () => {
    setTitle("");
    setStatus("pending");
    setTargetDate("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !title.trim()) return;

    setIsSubmitting(true);
    try {
      await createMilestone(client, projectId, {
        title,
        status,
        targetDate: targetDate || undefined,
      });
      toast.success("Milestone criada com sucesso.");
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar milestone.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className={sheetShellClassName}>
        <AppSheetHeader
          icon={Flag}
          editing
          eyebrow="A criar"
          title={<>Nova milestone</>}
          description={<>Regista um novo marco para acompanhar o progresso do projeto.</>}
        />

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className={`${sheetBodyClassName} space-y-4`}>
            <SheetSection title="Milestone" editing bodyClassName="space-y-3 px-4 py-3">
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="milestone-create-title">Título</label>
                <Input
                  id="milestone-create-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  className={cn(sheetEditControlClassName, "mt-1.5")}
                />
              </div>
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="milestone-create-status">Estado</label>
                <select
                  id="milestone-create-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                >
                  <option value="pending">Pendente</option>
                  <option value="in_progress">Em progresso</option>
                  <option value="achieved">Concluído</option>
                  <option value="delayed">Atrasado</option>
                </select>
              </div>
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="milestone-create-date">Data-alvo (opcional)</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="milestone-create-date"
                      type="button"
                      variant="ghost"
                      className={cn(
                        "mt-1.5",
                        sheetDatePickerButtonClassName,
                        targetDateValue ? "text-foreground" : "text-foreground/45",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {targetDateValue ? format(targetDateValue, "dd/MM/yyyy") : "Selecionar data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown"
                      className="rounded-lg border"
                      selected={targetDateValue}
                      onSelect={(date) => setTargetDate(toIsoDate(date))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </SheetSection>
          </div>
          <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
            <Button type="submit" className="flex-1" disabled={isSubmitting || !title.trim()}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "A criar..." : "Criar milestone"}
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
