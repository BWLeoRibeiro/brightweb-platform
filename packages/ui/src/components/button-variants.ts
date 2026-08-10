import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-control)] text-body text-[length:var(--text-ui-action)] !font-extrabold transition-[color,background-color,border-color,box-shadow,transform,filter,text-decoration-color] motion-reduce:transition-none outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:border-current focus-visible:ring-[3px] focus-visible:ring-current aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[var(--toolbar-icon-size)]",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-[color:var(--surface-button-brand)] text-[color:var(--foreground-button-brand)] hover:brightness-[1.05]",
        accent:
          "relative isolate h-auto overflow-hidden !rounded-none px-0 py-0 font-display !font-bold text-body leading-[var(--type-leading-160)] text-foreground [padding:var(--space-button-y)_var(--space-button-x)] hover:text-foreground focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2",
        accentLink:
          "h-auto min-h-0 gap-[var(--space-sm)] !rounded-none px-0 py-0 font-display !font-bold text-heading-4 leading-[var(--type-leading-166)] text-[color:var(--foreground-accent-link)] no-underline hover:underline",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-[1.05]",
        brand:
          "border border-transparent bg-[color:var(--surface-button-brand)] !text-[color:var(--foreground-button-brand)] hover:brightness-[1.05]",
        soft:
          "border border-[color:var(--border)] bg-[color:var(--surface-button-soft)] text-foreground hover:border-[color:var(--border-button-soft-hover)] hover:bg-[color:var(--surface-button-soft-hover)]",
        outline:
          "border border-[color:var(--hairline-strong)] bg-[color:var(--elevate-1)] text-foreground hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-hover)] hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-[color:var(--surface-button-soft-hover)] hover:text-foreground",
        link: "text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline",
      },
      size: {
        default: "h-9 px-3 py-2",
        xs: "h-6 gap-1 rounded-[var(--radius-control)] px-2 text-meta has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
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
