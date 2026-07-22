"use client";

import { useProjectsUiClient } from "../context";
import { useState, type FormEvent } from "react";
import { Link2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useOptionalProjectDetailActions } from "../project-detail-data-provider";
import {
  sheetBodyClassName,
  sheetFooterClassName,
  sheetShellClassName,
} from "../constants";
import { AppSheetHeader, SheetSection } from "../shared/app-sheet";
import { sheetEditControlClassName, sheetFieldLabelClassName } from "../shared/sheet-section";
import { cn } from "../utils";
import { PROJECTS_EVENTS } from "../events";
import { isValidProjectLinkUrl, normalizeProjectLinkUrl } from "../project-link-url-utils";
import { Button } from "@brightweblabs/ui";
import { Input } from "@brightweblabs/ui";
import {
  Sheet,
  SheetContent,
  SheetFooter,
} from "@brightweblabs/ui";
import { useWindowEventBridge } from "../window-events";

type ProjectLinkCreateSheetProps = {
  projectId: string;
  initialOpen?: boolean;
};

export function ProjectLinkCreateSheet({
  projectId, initialOpen = false }: ProjectLinkCreateSheetProps) {
  const client = useProjectsUiClient();
  const router = useRouter();
  const detailActions = useOptionalProjectDetailActions();
  const [open, setOpen] = useState(initialOpen);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState("other");
  const [visibility, setVisibility] = useState("staff");

  useWindowEventBridge(PROJECTS_EVENTS.openNewLink, () => {
    setOpen(true);
  }, { custom: false });

  const resetForm = () => {
    setLabel("");
    setUrl("");
    setKind("other");
    setVisibility("staff");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !label.trim() || !url.trim()) return;

    const normalizedUrl = normalizeProjectLinkUrl(url);
    if (!isValidProjectLinkUrl(normalizedUrl)) {
      toast.error("URL inválido. Usa um endereço como https://exemplo.com.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await client.requestRaw(`/api/projects/${projectId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          url: normalizedUrl,
          kind,
          visibility,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Não foi possível criar o link.";
        throw new Error(message);
      }
      const didApplyLinks = detailActions?.applyLinksPayload(payload) ?? false;

      toast.success("Link criado com sucesso.");
      setOpen(false);
      resetForm();
      if (!didApplyLinks) {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className={sheetShellClassName}>
        <AppSheetHeader
          icon={Link2}
          editing
          eyebrow="A criar"
          title={<>Novo link</>}
          description={<>Centraliza um recurso importante para a equipa do projeto.</>}
        />

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className={`${sheetBodyClassName} space-y-4`}>
            <SheetSection title="Link" editing bodyClassName="space-y-3 px-4 py-3">
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="link-create-label">Nome</label>
                <Input
                  id="link-create-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  required
                  className={cn(sheetEditControlClassName, "mt-1.5")}
                />
              </div>
              <div>
                <label className={sheetFieldLabelClassName} htmlFor="link-create-url">URL</label>
                <Input
                  id="link-create-url"
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  onBlur={(event) => setUrl(normalizeProjectLinkUrl(event.target.value))}
                  required
                  placeholder="https://"
                  className={cn(sheetEditControlClassName, "mt-1.5")}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="link-create-kind">Tipo</label>
                  <select
                    id="link-create-kind"
                    value={kind}
                    onChange={(event) => setKind(event.target.value)}
                    className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                  >
                    <option value="other">Outro</option>
                    <option value="doc">Documento</option>
                    <option value="sheet">Folha de cálculo</option>
                    <option value="drive">Pasta/Drive</option>
                  </select>
                </div>
                <div>
                  <label className={sheetFieldLabelClassName} htmlFor="link-create-visibility">Visibilidade</label>
                  <select
                    id="link-create-visibility"
                    value={visibility}
                    onChange={(event) => setVisibility(event.target.value)}
                    className={cn(sheetEditControlClassName, "mt-1.5 text-foreground outline-none")}
                  >
                    <option value="staff">Equipa interna</option>
                    <option value="client">Cliente</option>
                  </select>
                </div>
              </div>
            </SheetSection>
          </div>
          <SheetFooter className={`${sheetFooterClassName} flex-row gap-2`}>
            <Button type="submit" className="flex-1" disabled={isSubmitting || !label.trim() || !url.trim()}>
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? "A criar..." : "Criar link"}
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
