import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { sheetBodyClassName, sheetFooterClassName, sheetHeaderClassName } from "../constants";
import { SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@brightweblabs/ui";
import {
  sheetSectionClassName,
  sheetSectionEditingClassName,
  sheetSectionHeaderClassName,
  sheetSectionHeaderEditingClassName,
  sheetSectionTitleClassName,
} from "./sheet-section";
import { cn } from "../utils";

// The accent-tinted header surface used whenever a sheet is editable (edit or
// create). View mode keeps the neutral `sheetHeaderClassName`. Centralised here
// so every sheet reads identically — see also `sheetSectionEditingClassName`.
export const sheetHeaderEditingClassName =
  "border-b-[color:var(--project-ui-color-65)] bg-[linear-gradient(135deg,var(--project-ui-color-66),transparent_62%)]";

type AppSheetHeaderProps = {
  /** Lucide icon shown in the primary-tinted chip. Provide this OR `leading`. */
  icon?: LucideIcon;
  /** Custom leading visual replacing the icon chip (e.g. a status avatar). */
  leading?: ReactNode;
  /** Small uppercase eyebrow above the title (e.g. "A visualizar"). */
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Optional node rendered after the title/description block (e.g. a status pill). */
  aside?: ReactNode;
  /** When true, paints the accent "editing" header surface (edit/create modes). */
  editing?: boolean;
  className?: string;
};

/**
 * The portal's single right-rail header: a primary-tinted icon chip (or custom
 * `leading` visual) beside the title and (optional) description, on the shared
 * `sheetHeaderClassName` surface and portal typography. Use this for every Sheet
 * so panels read identically.
 */
export function AppSheetHeader({
  icon: Icon,
  leading,
  eyebrow,
  title,
  description,
  aside,
  editing,
  className,
}: AppSheetHeaderProps) {
  return (
    <SheetHeader className={cn(sheetHeaderClassName, editing && sheetHeaderEditingClassName, className)}>
      {eyebrow ? (
        <p className="mb-3 text-left text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
          {eyebrow}
        </p>
      ) : null}
      <div className="flex items-center gap-3.5">
        {leading ?? (
          Icon ? (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-sm">
              <Icon className="size-5 text-primary" />
            </div>
          ) : null
        )}
        <div className="min-w-0 flex-1">
          <SheetTitle className="portal-card-title truncate leading-tight">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="portal-meta mt-0.5">{description}</SheetDescription>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </SheetHeader>
  );
}

/**
 * Scrollable body for a right-rail. Applies the shared body surface and a
 * default 4-unit vertical rhythm between fields (override via `className`).
 */
export function AppSheetBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(sheetBodyClassName, "space-y-4", className)}>{children}</div>;
}

/**
 * Footer for a right-rail. Applies the shared footer surface; children are the
 * action buttons (a 2-gap row by default — pass a single full-width button or a
 * Cancel/Save pair).
 */
export function AppSheetFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <SheetFooter className={cn(sheetFooterClassName, "gap-2", className)}>{children}</SheetFooter>;
}

/**
 * A section card inside a sheet body. Renders the shared card surface with an
 * optional titled header strip, and — when `editing` — the accent-tinted
 * "edit mode" treatment (tinted body + header strip), matching the contact
 * sheet. Put fields (use `sheetEditControlClassName` / `sheetViewControlClassName`)
 * as children.
 */
export function SheetSection({
  title,
  editing,
  aside,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  editing?: boolean;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn(sheetSectionClassName, editing && sheetSectionEditingClassName, className)}>
      {title ? (
        <div
          className={cn(
            sheetSectionHeaderClassName,
            editing && sheetSectionHeaderEditingClassName,
            "flex items-center justify-between gap-2",
          )}
        >
          <p className={sheetSectionTitleClassName}>{title}</p>
          {aside}
        </div>
      ) : null}
      <div className={cn(bodyClassName)}>{children}</div>
    </div>
  );
}
