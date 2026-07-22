"use client";

import { Pencil } from "lucide-react";
import { PROJECTS_EVENTS, dispatchProjectsEvent } from "./events";
import { Button } from "@brightweblabs/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@brightweblabs/ui";
import { cn } from "./utils";
import { useProjectsUiDictionary } from "./context";

export function ProjectEditHeaderButton({ className }: { className?: string }) {
  const dictionary = useProjectsUiDictionary();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => dispatchProjectsEvent(PROJECTS_EVENTS.openEditProject)}
            className={cn("size-8 rounded-full", className)}
            aria-label={dictionary.detail.editProject}
          >
            <Pencil className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">{dictionary.detail.editProject}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
