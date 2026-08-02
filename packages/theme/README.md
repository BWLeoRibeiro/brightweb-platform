# `@brightweblabs/theme` token contract

BrightWeb themes follow one cascade: L0 brand primitives feed L1 shadcn semantics, L2 describes brand-agnostic states, and L3 exposes component and experience controls. Package components consume L1-L3 tokens only; theme files such as `themes/mq.css` override values without changing component code.

## Typography and font loading

Geist is the offline-safe platform default. Applications load `GeistSans` and `GeistMono` from the `geist/font` package and attach their variables to the app root (the platform layout uses `<body>`):

```tsx
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

<body className={`${GeistSans.variable} ${GeistMono.variable}`}>
```

The family contract starts at `--font-body`, `--font-heading`, and `--font-code`; Tailwind-facing `--font-sans`, `--font-display`, and `--font-mono` aliases resolve through those tokens. Canonical sizes live in visual-role `--text-*` tokens, with `--text-ui-*` and `--type-*` retained as compatibility scales. New components should use the canonical utilities below. A utility's role is visual rather than semantic: choose the correct HTML element independently, and compose text color separately.

| Utility | Size | Intended role |
| --- | --- | --- |
| `text-heading-1` | `clamp(1.75rem, 1.6rem + 0.7vw, 2rem)` | Primary page heading |
| `text-heading-2` | `1.5rem` | Major section heading |
| `text-heading-3` | `1.25rem` | Panel or subsection heading |
| `text-heading-4` | `1.125rem` | Compact subsection heading |
| `text-title` | `0.9375rem` | Card or item title |
| `text-body-lg` | `1rem` | Emphasized or introductory body copy |
| `text-body` | `0.875rem` | Default interface body copy |
| `text-meta` | `0.75rem` | Secondary metadata |
| `text-label` | `0.6875rem` | Uppercase interface label |
| `text-micro` | `0.625rem` | Dense supporting copy |
| `text-kpi` | `2.75rem` | Display-face headline KPI |
| `text-kpi-lg` | `3.5rem` | Large display-face headline KPI |
| `text-data` | inherited | Structured data: counters, ratios, percentages, dates, and numeric table cells |
| `text-data-sm` | `0.75rem` | Compact structured data |

Numeric typography follows one rule: big numbers are display, structured numbers
are mono, and numbers in sentences inherit their surrounding prose. The legacy
`text-metric`, `text-metric-display`, and `text-metric-lg` utilities retain their
existing rendered output for compatibility; new code should use the semantic roles
above.

Existing recipes remain supported and preserve their rendered values. The table
below gives the recommended semantic role for new code; it is a migration guide,
not a claim that every compatibility utility renders identically:

| Compatibility utility | Recommended role |
| --- | --- |
| `text-ui-title` | `text-heading-1` |
| `text-ui-heading` | `text-heading-2` |
| `text-ui-panel-title` | `text-heading-3` |
| `text-ui-subhead` | `text-heading-4` |
| `text-ui-card-title` | `text-title` |
| `text-ui-body` | `text-body` |
| `text-ui-meta` | `text-meta` |
| `text-ui-label` | `text-label` |
| `text-ui-micro` | `text-micro` |
| `text-ui-metric` | `text-kpi` |
| `text-ui-metric-display` | `text-kpi` |
| `text-ui-metric-xl` | `text-kpi-lg` |

The matching `portal-*` recipes have the same typography but continue to include their established tone: headings, titles, body, and metrics use `text-foreground`; meta, label, and micro roles use `text-muted-foreground`. `text-ui-title-sm`, shell/report/preview/auth sizes, MQ `heading-2`, and MQ paragraph aliases are contextual rather than exact canonical equivalents. Keep them until their route family is visually migrated and screenshot-checked.

BrightWeb package-owned UI now consumes the canonical roles directly. Compatibility
recipes remain exported for independently versioned clients, but new package code
must not introduce `text-ui-*`, `portal-*`, MQ paragraph aliases, or raw named
Tailwind font sizes. Contextual sizes compose a canonical role with the existing
specialized size token so their established geometry remains explicit.

Client themes can override the family without forking recipes. The MQ path is:

```css
@import "@brightweblabs/theme/css";
@import "@brightweblabs/theme/themes/mq";
@import "@brightweblabs/theme/themes/mq-aliases";

:root {
  --font-client-body: "Mulish", sans-serif;
  --font-body: var(--font-client-body);
}
```

`themes/mq.css` supplies MQ color and surface values, while `themes/mq-aliases.css` maps legacy MQ typography names onto the same tokenized scale. Import the MQ stylesheet after the base theme. Keep font loading at the app root; theme packages only select variables and never fetch fonts.

## Runtime theme switching

Theme tokens respond to both `html.dark` and `html[data-theme="dark"]`. Platform apps should use the shell-owned controller so those selectors never drift:

```tsx
import { ThemeProvider, ThemeScript } from "@brightweblabs/app-shell";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript defaultTheme="light" />
      </head>
      <body>
        <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

`ThemeScript` applies the stored `bw-theme` mode before hydration to prevent a light-theme flash. `ThemeProvider` keeps the root class, `data-theme`, and `color-scheme` synchronized, persists `"light" | "dark" | "system"`, and follows `prefers-color-scheme` while system mode is selected. Account menus rendered below the provider use this controller automatically.

## L3 visual tokens

| Tokens | Purpose |
| --- | --- |
| `--font-body`, `--font-heading`, `--font-code`; `--font-sans`, `--font-display`, `--font-mono` | Root font families and their Tailwind-facing aliases. |
| `--type-weight-*`, `--type-leading-*`, `--type-tracking-*` | Shared typography weight, rhythm, and tracking primitives. |
| `--text-heading-*`, `--text-title`, `--text-body*`, `--text-meta`, `--text-label`, `--text-micro`, `--text-kpi*`, `--text-data-sm`; `--text-metric*`, `--text-ui-*`, `--type-*` | Canonical visual-role typography tokens and compatibility scales. |
| `--foreground-muted-accessible`, `--foreground-inverse-muted`, `--foreground-inverse-subtle` | Contrast-safe secondary and inverse text roles. |
| `--text-ui-chip`, `--text-ui-action`, `--text-ui-calendar` | Compact control and calendar type sizes. |
| `--text-ui-shell-title`, `--text-ui-report-title`, `--text-ui-report-title-lg`, `--text-ui-report-metric` | Shell and CRM report display type sizes. |
| `--surface-overlay`, `--surface-overlay-strong`, `--surface-tooltip`, `--surface-badge-tint` | Overlay, tooltip, and tint surfaces. |
| `--surface-button-soft`, `--surface-button-soft-hover`, `--border-button-soft-hover` | Soft button surface states. |
| `--surface-selection`, `--border-selection`, `--surface-pagination-active`, `--border-pagination-active` | Selected control and active pagination states. |
| `--surface-danger-subtle` | Subtle destructive-state background. |
| `--surface-account-team`, `--surface-account-client`, `--surface-account`, `--surface-account-hover`, `--account-presence` | Account rail identity, presence, and interaction surfaces. |
| `--account-presence-size`, `--radius-swatch`, `--radius-pill`, `--radius-scrollbar` | Presence, swatch, pill, avatar, and scrollbar geometry. |
| `--row-hover-sweep`, `--surface-status-success`, `--surface-status-warning`, `--surface-status-danger` | Shared row and status surfaces. |
| `--dashboard-*` | Aggregate dashboard glows, shadows, task groups, milestone states, and local shell contrast recipes. |
| `--tint-soft-border`, `--tint-soft-bg`, `--tint-soft-hover`, `--tint-hero-border`, `--tint-hero-bg`, `--tint-hero-fg`, `--tint-hero-hover` | Dynamic tint recipes resolved where a component supplies `--tint`. |
| `--scrollbar-thumb`, `--scrollbar-thumb-hover`, `--scrollbar-size` | Shared scrollbar colour and geometry. |
| `--toast-success-bg`, `--toast-success-border`, `--toast-warning-bg`, `--toast-warning-text`, `--toast-warning-border`, `--toast-error-bg`, `--toast-error-border`, `--toast-info-bg`, `--toast-info-text`, `--toast-info-border` | Sonner semantic toast palette. |
| `--shadow-accent-control`, `--shadow-toolbar-popover`, `--shadow-tooltip`, `--shadow-dialog`, `--shadow-phone-dropdown` | Component elevation recipes. |
| `--report-hero-glow`, `--report-hero-rule` | CRM report decorative surfaces. |
| `--shell-frame-offset`, `--shell-sidebar-width`, `--shell-sidebar-collapsed-width`, `--shell-sidebar-toggle-offset`, `--shell-sidebar-toggle-size`, `--shell-sidebar-toggle-inset`, `--shell-brand-height` | Shell frame and sidebar geometry. |
| `--shell-nav-item-height`, `--shell-nav-item-collapsed-size`, `--shell-nav-icon-well-size`, `--shell-nav-icon-radius`, `--shell-nav-icon-size`, `--shell-nav-divider-width`, `--shell-nav-child-height`, `--shell-nav-child-enter-offset` | Shell navigation sizing and entry geometry. |
| `--shell-nav-active-indicator-inset`, `--shell-nav-active-indicator-collapsed-inset`, `--shell-nav-active-indicator-width`, `--shell-nav-active-indicator-offset`, `--shell-nav-context-dot-size`, `--shell-nav-context-dot-offset`, `--shell-nav-context-dot-border` | Shell navigation active markers. |
| `--shell-header-divider-height`, `--shell-account-gap`, `--shell-account-padding-y` | Header and account-control anatomy. |
| `--shell-surface-border`, `--shell-surface-hover`, `--shell-surface-active`, `--shell-hairline`, `--shell-icon-bg`, `--shell-group-open`, `--shell-shadow`, `--shell-background`, `--shell-sidebar-background` | Shell surfaces and elevation. |
| `--shell-control-muted`, `--shell-nav-foreground`, `--shell-nav-active-border`, `--shell-nav-active-icon-bg`, `--shell-nav-active-icon-fg`, `--shell-nav-context-icon-bg`, `--shell-nav-context-icon-fg` | Shell control and navigation colours. |
| `--shell-nav-child-fg`, `--shell-nav-child-icon-fg`, `--shell-nav-child-active-bg`, `--shell-nav-child-active-border`, `--shell-navbar-fg`, `--shell-navbar-muted`, `--shell-navbar-hairline` | Child-navigation and header colours. |
| `--toolbar-popover-width`, `--toolbar-chip-height`, `--toolbar-search-min-width`, `--toolbar-icon-size`, `--radius-toolbar-popover` | Shared CRM toolbar geometry. |
| `--crm-sidebar-gap`, `--crm-report-copy-max-width`, `--crm-report-metric-min-width`, `--report-stat-min-width` | CRM dashboard and report layout. |
| `--timeline-list-inset`, `--timeline-line-offset`, `--timeline-marker-offset` | Timeline anatomy. |
| `--table-header-height`, `--table-cell-padding-x`, `--table-cell-padding-y`, `--crm-table-viewport-offset`, `--crm-table-min-height`, `--crm-table-empty-min-height` | Table row anatomy and CRM viewport sizing. |
| `--dialog-width`, `--sheet-width`, `--crm-sheet-width`, `--menu-min-width`, `--chart-tooltip-min-width` | Overlay and floating-surface geometry. |
| `--skeleton-line-height`, `--skeleton-line-height-lg`, `--skeleton-line-height-compact`, `--skeleton-line-height-xs` | Skeleton text-line anatomy. |
| `--section-icon-size`, `--surface-enter-offset`, `--space-eyebrow-y` | Shared surface icon, entrance, and eyebrow geometry. |

All tokens above have neutral defaults in `src/tokens.css`. Values that are derived from semantic tokens automatically follow `themes/mq.css`; a direct MQ declaration is needed only when MQ intentionally differs from the neutral default. `themes/mq-aliases.css` remains the compatibility layer for legacy MQ primitive and typography names.

The base stylesheet also provides the global `prefers-reduced-motion: reduce` contract. It disables smooth scrolling and collapses animation and transition timing; skeleton and package styles add static fallbacks where their animated state would otherwise remain off-screen or transparent.
