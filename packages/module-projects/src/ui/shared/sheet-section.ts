export const sheetSectionClassName =
  "overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--project-surface-secondary)]";

export const sheetSectionHeaderClassName =
  "border-b border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2.5";

export const sheetSectionTitleClassName =
  "text-[11px] font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]";

export const sheetFieldLabelClassName =
  "text-[9px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]";

// Applied to a section card while its sheet is in an editable (edit/create)
// state: an accent-tinted border + body so the live, fillable fields read as
// distinct from the neutral read-only view. Pair with the accent header tint.
export const sheetSectionEditingClassName =
  "border-[color:var(--project-ui-color-81)] bg-[color:var(--project-ui-color-82)]";

// The section-header strip while editing: an accent wash so the card titles
// Section names read as active, paired with the tinted body.
export const sheetSectionHeaderEditingClassName =
  "border-b-[color:var(--project-ui-color-81)] bg-[color:var(--project-ui-color-77)]";

// Read-only field control: borderless, sits flat in the divider-separated rows.
// `appearance-none` strips the native <select> chevron so read-only selects read
// as plain values (no dropdown affordance) — they just show the chosen answer.
export const sheetViewControlClassName =
  "h-7 appearance-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 disabled:cursor-default disabled:opacity-100";

// Editable field control: a light accent-bordered box on the card surface, so
// fields read as distinct and fillable. Pair with dividers removed.
export const sheetEditControlClassName =
  "h-9 w-full rounded-lg border border-[color:var(--project-ui-color-01)] bg-[color:var(--card)] px-2.5 text-sm shadow-none transition focus-visible:border-[color:var(--accent)] focus-visible:ring-[3px] focus-visible:ring-[color:var(--project-ui-color-10)] disabled:opacity-100";

// Editable multi-line control (accent box, auto height). Same border/focus as
// `sheetEditControlClassName` but without the fixed height.
export const sheetAccentTextareaClassName =
  "w-full rounded-xl border border-[color:var(--project-ui-color-01)] bg-[color:var(--card)] px-3 py-2 text-sm text-foreground placeholder:text-foreground/35 focus:border-[color:var(--accent)] focus:outline-none focus:ring-[3px] focus:ring-[color:var(--project-ui-color-10)] disabled:opacity-100";

// Editable date/picker trigger button (accent box matching the controls above).
export const sheetDatePickerButtonClassName =
  "h-9 w-full justify-start rounded-lg border border-[color:var(--project-ui-color-01)] bg-[color:var(--card)] px-2.5 text-sm hover:bg-[color:var(--card)]";
