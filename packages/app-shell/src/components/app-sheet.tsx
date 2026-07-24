import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@brightweblabs/ui";
import { cn } from "../lib/utils";

export const sheetShellClassName = "gap-0 h-screen w-full border-l border-[color:var(--border)] bg-[color:var(--background)] sm:max-w-[28rem]";
export const sheetHeaderClassName = "relative overflow-hidden border-b border-[color:var(--border)] bg-[image:var(--sheet-header-surface)] px-5 pb-5 pt-5";
export const sheetBodyClassName = "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-4";
export const sheetFooterClassName = "border-t border-[color:var(--border)] px-5 py-4";
export const sheetHeaderEditingClassName = "border-b-[color:var(--sheet-edit-border)] bg-[image:var(--sheet-edit-header-surface)]";
export const sheetSectionClassName = "overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--project-surface-secondary)]";
export const sheetSectionHeaderClassName = "border-b border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2.5";
export const sheetSectionTitleClassName = "text-[11px] font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]";
export const sheetFieldLabelClassName = "text-[9px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]";
export const sheetSectionEditingClassName = "border-[color:var(--sheet-edit-border)] bg-[color:var(--sheet-edit-surface)]";
export const sheetSectionHeaderEditingClassName = "border-b-[color:var(--sheet-edit-border)] bg-[color:var(--sheet-edit-header)]";
export const sheetViewControlClassName = "h-7 appearance-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 disabled:cursor-default disabled:opacity-100";
export const sheetEditControlClassName = "h-9 w-full rounded-lg border border-[color:var(--sheet-edit-control-border)] bg-[color:var(--card)] px-2.5 text-sm shadow-none transition focus-visible:border-[color:var(--accent)] focus-visible:ring-[3px] focus-visible:ring-[color:var(--sheet-edit-control-ring)] disabled:opacity-100";
export const sheetAccentTextareaClassName = "w-full rounded-xl border border-[color:var(--sheet-edit-control-border)] bg-[color:var(--card)] px-3 py-2 text-sm text-foreground placeholder:text-foreground/35 focus:border-[color:var(--accent)] focus:outline-none focus:ring-[3px] focus:ring-[color:var(--sheet-edit-control-ring)] disabled:opacity-100";
export const sheetDatePickerButtonClassName = "h-9 w-full justify-start rounded-lg border border-[color:var(--sheet-edit-control-border)] bg-[color:var(--card)] px-2.5 text-sm hover:bg-[color:var(--card)]";

export type AppSheetHeaderProps = {
  icon?: LucideIcon;
  leading?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  editing?: boolean;
  className?: string;
};

export function AppSheetHeader({ icon: Icon, leading, eyebrow, title, description, aside, editing, className }: AppSheetHeaderProps) {
  return (
    <SheetHeader className={cn(sheetHeaderClassName, editing && sheetHeaderEditingClassName, className)}>
      {eyebrow ? <p className="mb-3 text-left text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">{eyebrow}</p> : null}
      <div className="flex items-center gap-3.5">
        {leading ?? (Icon ? <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm"><Icon className="size-5 text-primary" /></div> : null)}
        <div className="min-w-0 flex-1">
          <SheetTitle className="portal-card-title truncate leading-tight">{title}</SheetTitle>
          {description ? <SheetDescription className="portal-meta mt-0.5">{description}</SheetDescription> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </SheetHeader>
  );
}

export function AppSheetBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(sheetBodyClassName, "space-y-4", className)}>{children}</div>;
}

export function AppSheetFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <SheetFooter className={cn(sheetFooterClassName, "gap-2", className)}>{children}</SheetFooter>;
}

export function SheetSection({ title, editing, aside, children, className, bodyClassName }: { title?: ReactNode; editing?: boolean; aside?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <div className={cn(sheetSectionClassName, editing && sheetSectionEditingClassName, className)}>
      {title ? <div className={cn(sheetSectionHeaderClassName, editing && sheetSectionHeaderEditingClassName, "flex items-center justify-between gap-2")}><p className={sheetSectionTitleClassName}>{title}</p>{aside}</div> : null}
      <div className={cn(bodyClassName)}>{children}</div>
    </div>
  );
}
