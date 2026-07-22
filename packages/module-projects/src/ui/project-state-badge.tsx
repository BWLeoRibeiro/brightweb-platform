import type { ComponentProps } from "react";
import {
  PROJECT_PILL_SIZE_CLASSES,
  ProjectPill,
  type ProjectPillSize,
} from "./shared/project-pill";
import { isProjectHealth, type ProjectHealth, type ProjectStatus } from "../contracts";
import { tintPill } from "@brightweblabs/theme/tint";
import { cn } from "./utils";
import { defaultProjectsUiDictionary } from "./dictionary";

type ProjectBadgeSize = ProjectPillSize;
type ProjectHealthTone = ProjectHealth | "neutral";
type ProjectPillSurface = "default" | "hero";

export const PROJECT_BADGE_SIZE_CLASSES: Record<ProjectBadgeSize, string> = PROJECT_PILL_SIZE_CLASSES;

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ...defaultProjectsUiDictionary.badge.status,
};

export const PROJECT_HEALTH_LABELS: Record<ProjectHealth, string> = {
  ...defaultProjectsUiDictionary.badge.health,
};

/** Base hue token per status / health tone. The opacity stops live in the
 *  `.tint-soft` / `.tint-hero` recipes (globals.css) via `tintPill`. */
const PROJECT_STATUS_TINT: Record<ProjectStatus, string> = {
  planned: "--project-state-planned",
  active: "--project-state-active",
  blocked: "--project-state-blocked",
  completed: "--project-state-completed",
  canceled: "--project-state-canceled",
};

const PROJECT_HEALTH_TINT: Record<Exclude<ProjectHealthTone, "neutral">, string> = {
  on_track: "--project-state-active",
  at_risk: "--project-risk-at-risk",
  off_track: "--project-risk-overdue",
};

/** Neutral (untinted) fallbacks keep their own quiet surface styling. */
const HEALTH_NEUTRAL_SOFT =
  "border-foreground/12 bg-foreground/5 text-foreground/60 dark:border-foreground/18 dark:bg-foreground/8 dark:text-foreground/65";
const HEALTH_NEUTRAL_HERO = "border-white/22 bg-white/10 text-white/78 hover:bg-white/16";
const STATUS_UNKNOWN =
  "border-black/15 bg-white/90 text-foreground/75 dark:border-white/20 dark:bg-white/10 dark:text-foreground/80";

type SharedBadgeProps = Omit<ComponentProps<"span">, "children"> & {
  size?: ProjectBadgeSize;
  surface?: ProjectPillSurface;
};

type ProjectStatusBadgeProps = SharedBadgeProps & {
  status: ProjectStatus | string;
  label?: string;
};

type ProjectHealthBadgeProps = SharedBadgeProps & {
  health: ProjectHealth | string;
  tone?: ProjectHealthTone;
  label?: string;
};

/** Canonical tint (className + inline `--tint` vars) for a project status. */
export function projectStatusTint(status: ProjectStatus, surface: ProjectPillSurface = "default") {
  return tintPill(PROJECT_STATUS_TINT[status], surface === "hero" ? "hero" : "soft");
}

export function ProjectStatusBadge({ status, size = "normal", surface = "default", className, label, style, ...props }: ProjectStatusBadgeProps) {
  const knownStatus = status in PROJECT_STATUS_LABELS ? (status as ProjectStatus) : null;
  const resolvedLabel = label ?? (knownStatus ? PROJECT_STATUS_LABELS[knownStatus] : status);
  const tint = knownStatus ? projectStatusTint(knownStatus, surface) : null;

  return (
    <ProjectPill
      size={size}
      className={cn(tint?.className ?? STATUS_UNKNOWN, className)}
      style={tint ? { ...tint.style, ...style } : style}
      {...props}
    >
      {resolvedLabel}
    </ProjectPill>
  );
}

export function ProjectHealthBadge({ health, size = "normal", surface = "default", tone, className, label, style, ...props }: ProjectHealthBadgeProps) {
  const resolvedTone: ProjectHealthTone = tone ?? (isProjectHealth(health) ? health : "neutral");
  const resolvedLabel = label ?? (isProjectHealth(health) ? PROJECT_HEALTH_LABELS[health] : health);
  const tint = resolvedTone === "neutral" ? null : tintPill(PROJECT_HEALTH_TINT[resolvedTone], surface === "hero" ? "hero" : "soft");
  const neutralClass = surface === "hero" ? HEALTH_NEUTRAL_HERO : HEALTH_NEUTRAL_SOFT;

  return (
    <ProjectPill
      size={size}
      className={cn(tint?.className ?? neutralClass, className)}
      style={tint ? { ...tint.style, ...style } : style}
      {...props}
    >
      {resolvedLabel}
    </ProjectPill>
  );
}

export const ProjectStateBadge = {
  Status: ProjectStatusBadge,
  Health: ProjectHealthBadge,
};
