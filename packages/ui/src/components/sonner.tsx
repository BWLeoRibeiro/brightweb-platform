"use client";

import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      richColors
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "color-mix(in srgb, var(--primary) 12%, var(--background))",
          "--success-text": "var(--primary)",
          "--success-border": "color-mix(in srgb, var(--primary) 30%, var(--background))",
          "--warning-bg": "color-mix(in srgb, var(--accent) 12%, var(--background))",
          "--warning-text": "color-mix(in srgb, var(--accent) 80%, var(--foreground))",
          "--warning-border": "color-mix(in srgb, var(--accent) 30%, var(--background))",
          "--error-bg": "color-mix(in srgb, var(--destructive) 12%, var(--background))",
          "--error-text": "var(--destructive)",
          "--error-border": "color-mix(in srgb, var(--destructive) 30%, var(--background))",
          "--info-bg": "color-mix(in srgb, var(--secondary) 15%, var(--background))",
          "--info-text": "color-mix(in srgb, var(--secondary) 70%, var(--foreground))",
          "--info-border": "color-mix(in srgb, var(--secondary) 30%, var(--background))",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
