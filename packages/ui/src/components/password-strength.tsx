"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export type PasswordStrengthLevel = "weak" | "medium" | "strong" | null;

export interface PasswordStrengthLabels {
  weak: string;
  medium: string;
  strong: string;
  ariaLabel: string;
  prefix: string;
}

export interface PasswordStrengthProps {
  password: string;
  className?: string;
  labels?: Partial<PasswordStrengthLabels>;
}

const defaultPasswordStrengthLabels: PasswordStrengthLabels = {
  weak: "Fraca",
  medium: "Média",
  strong: "Forte",
  ariaLabel: "Força da palavra-passe",
  prefix: "Força",
};

export function calculatePasswordStrength(password: string): PasswordStrengthLevel {
  if (!password) return null;

  let score = 0;

  // Length check
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Character variety
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++; // Special chars

  // Determine strength level
  if (score <= 2) return "weak";
  if (score <= 4) return "medium";
  return "strong";
}

function getStrengthConfig(strength: PasswordStrengthLevel, labels: PasswordStrengthLabels) {
  switch (strength) {
    case "weak":
      return {
        label: labels.weak,
        color: "bg-[color:var(--semantic-danger)]",
        width: "w-1/3",
        textColor: "text-[color:var(--semantic-danger-strong)]",
      };
    case "medium":
      return {
        label: labels.medium,
        color: "bg-[color:var(--semantic-warning)]",
        width: "w-2/3",
        textColor: "text-[color:var(--semantic-warning-strong)]",
      };
    case "strong":
      return {
        label: labels.strong,
        color: "bg-[color:var(--semantic-success)]",
        width: "w-full",
        textColor: "text-[color:var(--semantic-success-strong)]",
      };
    default:
      return null;
  }
}

export function PasswordStrength({ password, className, labels: labelsOverride }: PasswordStrengthProps) {
  const labels = { ...defaultPasswordStrengthLabels, ...labelsOverride };
  const strength = calculatePasswordStrength(password);
  const config = getStrengthConfig(strength, labels);

  if (!config) return null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="h-1 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className={cn("h-full transition-[width,background-color] duration-300 motion-reduce:transition-none", config.color, config.width)}
          role="progressbar"
          aria-valuenow={strength === "weak" ? 33 : strength === "medium" ? 66 : 100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={labels.ariaLabel}
          aria-valuetext={config.label}
        />
      </div>

      <p className={cn("text-meta !font-semibold transition-colors motion-reduce:transition-none", config.textColor)}>
        {labels.prefix}: {config.label}
      </p>
    </div>
  );
}
