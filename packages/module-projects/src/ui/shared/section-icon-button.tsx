"use client";

import { Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@brightweblabs/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@brightweblabs/ui";
import { cn } from "../utils";

type SectionIconButtonProps = {
  icon: LucideIcon;
  /** Used for both the tooltip and the accessible label. */
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
};

// Shared icon affordance for surface-card section headers (add milestone/task/
// link, edit team, expand activity, …). One look everywhere: a soft circular
// button that tints to the accent on hover. Requires a TooltipProvider ancestor.
export function SectionIconButton({ icon: Icon, label, onClick, disabled, className }: SectionIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="soft"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
          disabled={disabled}
          className={cn(
            "rounded-full text-[color:var(--muted-foreground)] transition-colors hover:border-[color:var(--project-ui-color-80)] hover:bg-[color:var(--project-ui-color-18)] hover:text-[color:var(--accent)]",
            className,
          )}
        >
          <Icon className="size-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

// Convenience for the most common case: a "+" add button.
export function SectionAddButton(props: Omit<SectionIconButtonProps, "icon">) {
  return <SectionIconButton icon={Plus} {...props} />;
}
