"use client";

import * as React from "react";
import { cn } from "../lib/utils";

interface PasswordStrengthProps {
  password: string;
  className?: string;
}

type StrengthLevel = "weak" | "medium" | "strong" | null;

function calculatePasswordStrength(password: string): StrengthLevel {
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

function getStrengthConfig(strength: StrengthLevel) {
  switch (strength) {
    case "weak":
      return {
        label: "Fraca",
        color: "bg-destructive",
        width: "w-1/3",
        textColor: "text-destructive",
      };
    case "medium":
      return {
        label: "Média",
        color: "bg-accent",
        width: "w-2/3",
        textColor: "text-accent",
      };
    case "strong":
      return {
        label: "Forte",
        color: "bg-secondary",
        width: "w-full",
        textColor: "text-secondary",
      };
    default:
      return null;
  }
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const strength = calculatePasswordStrength(password);
  const config = getStrengthConfig(strength);

  if (!config) return null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {/* Strength bar */}
      <div className="h-1 w-full bg-foreground/10 rounded-full overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300", config.color, config.width)}
          role="progressbar"
          aria-valuenow={strength === "weak" ? 33 : strength === "medium" ? 66 : 100}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Força da palavra-passe"
        />
      </div>

      {/* Strength label */}
      <p className={cn("paragraph-mini font-medium transition-colors", config.textColor)}>
        Força: {config.label}
      </p>
    </div>
  );
}
