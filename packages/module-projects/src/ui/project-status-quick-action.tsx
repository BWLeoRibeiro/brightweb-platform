"use client";

import { useProjectsUiClient, useProjectsUiDictionary } from "./context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ProjectStatus } from "../contracts";
import { useProjectDetailActions, useProjectDetailProject } from "./project-detail-data-provider";
import {
  PROJECT_STATUS_LABELS,
  projectStatusTint,
} from "./project-state-badge";
import { ProjectPill } from "./shared/project-pill";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@brightweblabs/ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@brightweblabs/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@brightweblabs/ui";
import { cn } from "./utils";

type ProjectStatusQuickActionProps = {
  className?: string;
  surface?: "default" | "hero";
};

const statusOptions: ProjectStatus[] = [
  "planned",
  "active",
  "blocked",
  "completed",
  "canceled",
];

const PROJECT_STATUS_MENU_HOVER_CLASSES: Record<ProjectStatus, string> = {
  planned:
    "data-[highlighted]:border-[color:var(--project-ui-color-30)] data-[highlighted]:bg-[color:var(--project-ui-color-31)] data-[highlighted]:text-[color:var(--project-state-planned-strong)]",
  active:
    "data-[highlighted]:border-[color:var(--project-ui-color-32)] data-[highlighted]:bg-[color:var(--project-ui-color-33)] data-[highlighted]:text-[color:var(--project-state-active-strong)]",
  blocked:
    "data-[highlighted]:border-[color:var(--project-ui-color-34)] data-[highlighted]:bg-[color:var(--project-ui-color-35)] data-[highlighted]:text-[color:var(--project-state-blocked-strong)]",
  completed:
    "data-[highlighted]:border-[color:var(--project-ui-color-36)] data-[highlighted]:bg-[color:var(--project-ui-color-37)] data-[highlighted]:text-[color:var(--project-state-completed-strong)]",
  canceled:
    "data-[highlighted]:border-[color:var(--project-ui-color-38)] data-[highlighted]:bg-[color:var(--project-ui-color-39)] data-[highlighted]:text-[color:var(--project-state-canceled-strong)]",
};

export function ProjectStatusQuickAction({
  className, surface = "default" }: ProjectStatusQuickActionProps) {
  const client = useProjectsUiClient();
  const dictionary = useProjectsUiDictionary();
  const router = useRouter();
  const project = useProjectDetailProject();
  const { applyDashboardPayload } = useProjectDetailActions();
  const projectId = project.id;
  const initialStatus = project.status;
  const initialCancellationReason = project.cancellationReason;
  const [status, setStatus] = useState<ProjectStatus>(initialStatus);
  const [cancellationReason, setCancellationReason] = useState(initialCancellationReason ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<ProjectStatus | null>(null);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    setCancellationReason(initialCancellationReason ?? "");
  }, [initialCancellationReason]);

  const handleChange = async (nextStatus: ProjectStatus, reason?: string) => {
    if (nextStatus === status || isSaving) return;

    const previousStatus = status;
    const previousCancellationReason = cancellationReason;
    setStatus(nextStatus);
    setIsSaving(true);

    try {
      const normalizedReason = reason?.trim() ?? "";
      const response = await client.requestRaw(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          cancellationReason: nextStatus === "canceled" ? normalizedReason : "",
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : dictionary.statusAction.updateError);
      }

      setCancellationReason(nextStatus === "canceled" ? normalizedReason : "");
      const didApplyDashboard = applyDashboardPayload(payload);
      toast.success(dictionary.statusAction.updated);
      if (!didApplyDashboard) {
        router.refresh();
      }
    } catch (error) {
      setStatus(previousStatus);
      setCancellationReason(previousCancellationReason);
      toast.error(error instanceof Error ? error.message : dictionary.statusAction.updateFallbackError);
    } finally {
      setIsSaving(false);
      setPendingStatus(null);
    }
  };

  const handleStatusOptionClick = (option: ProjectStatus) => {
    if (option === status || isSaving) return;

    if (option === "canceled") {
      setPendingStatus(option);
      setCancelDialogOpen(true);
      return;
    }

    void handleChange(option);
  };

  const handleConfirmCancel = () => {
    const normalizedReason = cancellationReason.trim();
    if (!normalizedReason || pendingStatus !== "canceled") {
      toast.error(dictionary.statusAction.cancellationReasonRequired);
      return;
    }

    setCancelDialogOpen(false);
    void handleChange("canceled", normalizedReason);
  };

  const currentStatusLabel = PROJECT_STATUS_LABELS[status] ?? dictionary.forms.status;
  const triggerTint = projectStatusTint(status, surface === "hero" ? "hero" : "default");

  return (
    <>
      <DropdownMenu>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild disabled={isSaving}>
                <ProjectPill
                  asChild
                  size="normal"
                  className={cn(
                    "transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70",
                    triggerTint.className,
                    className,
                  )}
                  style={triggerTint.style}
                >
                <button
                  type="button"
                  id="project-status-quick-action-trigger"
                  aria-label={dictionary.statusAction.changeStatus}
                >
                  <span>{currentStatusLabel}</span>
                  {isSaving ? (
                    <Loader2 className="size-3.5 animate-spin opacity-70" />
                  ) : (
                    <ChevronDown className="size-3.5 opacity-70" />
                  )}
                </button>
                </ProjectPill>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">{dictionary.statusAction.changeStatus}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="start" className="w-fit min-w-[170px]">
          {statusOptions.map((option) => {
            const isSelected = option === status;
            const optionTint = isSelected ? projectStatusTint(option) : null;
            return (
              <DropdownMenuItem
                key={option}
                onClick={() => handleStatusOptionClick(option)}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md border border-transparent",
                  PROJECT_STATUS_MENU_HOVER_CLASSES[option],
                  optionTint?.className,
                )}
                style={optionTint?.style}
                disabled={isSaving}
              >
                <span>{PROJECT_STATUS_LABELS[option]}</span>
                <Check className={cn("size-3.5", isSelected ? "opacity-100" : "opacity-0")} />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog
        open={isCancelDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isSaving) {
            setCancelDialogOpen(nextOpen);
            if (!nextOpen) setPendingStatus(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-[480px]">
          <AlertDialogHeader>
            <AlertDialogTitle>{dictionary.statusAction.cancelProject}</AlertDialogTitle>
            <AlertDialogDescription>
              {dictionary.statusAction.cancelDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            rows={4}
            value={cancellationReason}
            onChange={(event) => setCancellationReason(event.target.value)}
            placeholder={dictionary.statusAction.cancelPlaceholder}
            className="w-full rounded-xl border border-black/12 bg-background/70 px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-white/15 dark:bg-white/[0.04]"
            disabled={isSaving}
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full px-4 text-xs" disabled={isSaving}>
              {dictionary.statusAction.close}
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-rose-600 px-4 text-xs text-white hover:bg-rose-700"
              onClick={(event) => {
                event.preventDefault();
                handleConfirmCancel();
              }}
              disabled={isSaving}
            >
              {dictionary.statusAction.confirmCancellation}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
