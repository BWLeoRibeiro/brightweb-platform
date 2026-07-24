import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { defaultProjectsUiDictionary } from "../dictionary";

type SectionEmptyStateProps = {
  message: string;
  hint?: string;
  icon?: LucideIcon;
};

export function SectionEmptyState({ message, hint, icon: Icon }: SectionEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/10 px-4 py-8 text-center dark:border-white/12">
      {Icon ? <Icon className="size-5 text-foreground/35" /> : null}
      <p className="paragraph-small font-semibold text-muted-foreground">{message}</p>
      {hint ? <p className="paragraph-mini text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

type SectionLoadingStateProps = {
  message?: string;
};

export function SectionLoadingState({ message = defaultProjectsUiDictionary.detail.loading }: SectionLoadingStateProps) {
  return (
    <div className="inline-flex items-center gap-2 paragraph-small text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      {message}
    </div>
  );
}
