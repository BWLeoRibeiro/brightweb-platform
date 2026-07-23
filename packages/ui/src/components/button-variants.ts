import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-ui-body !font-semibold transition-all outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:border-current focus-visible:ring-[3px] focus-visible:ring-current aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        accent:
          "relative isolate h-auto overflow-hidden !rounded-none px-0 py-0 font-display !font-bold text-[length:var(--text-ui-body)] leading-[1.6] text-foreground [padding:var(--space-button-y)_var(--space-button-x)] hover:text-foreground focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2",
        accentLink:
          "h-auto min-h-0 gap-[var(--space-sm)] !rounded-none px-0 py-0 font-display !font-bold text-[length:var(--text-ui-subhead)] leading-[1.66] text-[color:var(--foreground-accent-link)] no-underline hover:underline",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-[1.05]",
        brand:
          "bg-[color:var(--surface-button-brand)] text-[color:var(--accent-foreground)] !font-extrabold shadow-[var(--shadow-accent-control)] hover:brightness-[1.05]",
        soft:
          "border border-[color:var(--border)] bg-[color:var(--surface-button-soft)] text-foreground hover:border-[color:var(--border-button-soft-hover)] hover:bg-[color:var(--surface-button-soft-hover)]",
        outline:
          "border bg-background shadow-xs hover:bg-[color:var(--surface-button-soft-hover)] hover:text-foreground dark:bg-input/30 dark:hover:bg-[color:var(--surface-button-soft-hover)]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-[color:var(--surface-button-soft-hover)] hover:text-foreground",
        link: "text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-[var(--radius-control)] px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-[var(--radius-control)] px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-[var(--radius-control)] px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-[var(--radius-control)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
        link: "h-auto min-h-0 px-0 py-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export { buttonVariants };
export type { ButtonVariantProps };
