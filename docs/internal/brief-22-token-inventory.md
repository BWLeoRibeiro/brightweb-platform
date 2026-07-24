# Brief 22 token inventory

Every entry is an L3 experience token. “—” in the MQ column means MQ does not need a direct override: the default is the exact pre-extraction value, or the recipe follows MQ through its L0-L2 dependencies.

Brief 23 adds `--project-hero-base` and `--project-hero-shadow` to the theme and centralizes the remaining literal MQ Projects recipes in `@brightweblabs/module-projects/tokens.css`; package component source contains no raw color recipes.

## Files changed

- Release notes: `.changeset/calm-crm-dashboard.md`, `.changeset/crm-pixel-parity.md`.
- App shell: `packages/app-shell/src/components/account-menu.tsx`, `packages/app-shell/src/components/shell-surfaces.module.css`, `packages/app-shell/src/components/toolbar-shared.tsx`.
- CRM UI: `packages/module-crm/src/ui/activity-card.tsx`, `packages/module-crm/src/ui/contacts-table.tsx`, `packages/module-crm/src/ui/dashboard-sidebar.tsx`, `packages/module-crm/src/ui/dictionary.ts`, `packages/module-crm/src/ui/organizations-browser.tsx`, `packages/module-crm/src/ui/report-banner.tsx`, `packages/module-crm/src/ui/report.tsx`, `packages/module-crm/src/ui/status-dialog.tsx`, `packages/module-crm/src/ui/timeline.tsx`, `packages/module-crm/src/ui/toolbar-controls.tsx`, `packages/module-crm/src/ui/types.ts`.
- Theme: `packages/theme/README.md`, `packages/theme/src/surfaces.css`, `packages/theme/src/tokens.css`, `packages/theme/src/typography.css`, `packages/theme/themes/mq-aliases.css`.
- Shared UI: `packages/ui/src/components/alert-dialog.tsx`, `packages/ui/src/components/badge.tsx`, `packages/ui/src/components/button-variants.ts`, `packages/ui/src/components/calendar.tsx`, `packages/ui/src/components/chart.tsx`, `packages/ui/src/components/dropdown-menu.tsx`, `packages/ui/src/components/kpi-breakdown-bar.tsx`, `packages/ui/src/components/phone-input.tsx`, `packages/ui/src/components/sheet.tsx`, `packages/ui/src/components/skeleton-table.tsx`, `packages/ui/src/components/skeleton.tsx`, `packages/ui/src/components/sonner.tsx`, `packages/ui/src/components/table-pagination.tsx`, `packages/ui/src/components/tooltip.tsx`.
- Guardrails and inventory: `tests/theme-contract.test.ts`, `tests/ui-hygiene.test.ts`, `docs/internal/brief-22-token-inventory.md`.

| Token | Layer | Neutral default (literal → token) | Direct MQ override | Consumers |
| --- | --- | --- | --- | --- |
| `--text-ui-chip` | L3 | `0.78125rem` | — | `packages/module-crm/src/ui/toolbar-controls.tsx`<br>`packages/theme/src/typography.css` |
| `--text-ui-action` | L3 | `0.8125rem` | — | `packages/app-shell/src/components/account-menu.tsx`<br>`packages/app-shell/src/components/shell-surfaces.module.css`<br>`packages/app-shell/src/components/toolbar-shared.tsx`<br>`packages/module-crm/src/ui/report-banner.tsx`<br>`packages/module-crm/src/ui/toolbar-controls.tsx`<br>`packages/theme/src/typography.css` |
| `--text-ui-shell-title` | L3 | `1.3125rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css`<br>`packages/theme/src/typography.css` |
| `--text-ui-report-title` | L3 | `1.75rem` | — | `packages/module-crm/src/ui/report-banner.tsx`<br>`packages/theme/src/typography.css` |
| `--text-ui-report-title-lg` | L3 | `2.25rem` | — | `packages/module-crm/src/ui/report-banner.tsx`<br>`packages/theme/src/typography.css` |
| `--text-ui-calendar` | L3 | `0.8rem` | — | `packages/theme/src/typography.css`<br>`packages/ui/src/components/calendar.tsx` |
| `--text-ui-report-metric` | L3 | `2.5rem` | — | `packages/module-crm/src/ui/report-banner.tsx`<br>`packages/theme/src/typography.css` |
| `--radius-swatch` | L3 | `0.125rem` | — | `packages/ui/src/components/chart.tsx`<br>`packages/ui/src/components/kpi-breakdown-bar.tsx` |
| `--radius-pill` | L3 | `999px` | — | `packages/module-crm/src/ui/dashboard-sidebar.tsx`<br>`packages/theme/src/surfaces.css`<br>`packages/ui/src/components/skeleton-table.tsx`<br>`packages/ui/src/components/skeleton.tsx` |
| `--radius-scrollbar` | L3 | `9999px` | — | `packages/theme/src/typography.css`<br>`packages/theme/themes/mq-aliases.css` |
| `--surface-overlay` | L3 | `color-mix(in srgb, var(--foreground) 50%, transparent)` | — | `packages/ui/src/components/sheet.tsx` |
| `--surface-overlay-strong` | L3 | `color-mix(in srgb, var(--foreground) 55%, transparent)` | — | `packages/ui/src/components/alert-dialog.tsx` |
| `--surface-tooltip` | L3 | `color-mix(in srgb, var(--popover) 95%, transparent)` | — | `packages/ui/src/components/tooltip.tsx` |
| `--surface-badge-tint` | L3 | `color-mix(in srgb, currentColor 14%, transparent)` | — | `packages/ui/src/components/badge.tsx` |
| `--surface-button-soft` | L3 | `color-mix(in srgb, var(--foreground) 3.5%, var(--card))` | — | `packages/ui/src/components/button-variants.ts` |
| `--surface-button-soft-hover` | L3 | `color-mix(in srgb, var(--foreground) 7%, var(--card))` | — | `packages/ui/src/components/button-variants.ts` |
| `--border-button-soft-hover` | L3 | `color-mix(in srgb, var(--foreground) 16%, transparent)` | — | `packages/ui/src/components/button-variants.ts` |
| `--surface-selection` | L3 | `color-mix(in srgb, var(--accent) 12%, var(--card))` | — | `packages/module-crm/src/ui/toolbar-controls.tsx` |
| `--border-selection` | L3 | `color-mix(in srgb, var(--accent) 40%, var(--hairline))` | — | `packages/module-crm/src/ui/toolbar-controls.tsx` |
| `--surface-pagination-active` | L3 | `color-mix(in srgb, var(--accent) 10%, var(--card))` | — | `packages/ui/src/components/table-pagination.tsx` |
| `--border-pagination-active` | L3 | `color-mix(in srgb, var(--accent) 36%, transparent)` | — | `packages/ui/src/components/table-pagination.tsx` |
| `--surface-danger-subtle` | L3 | `color-mix(in srgb, var(--semantic-danger) 10%, transparent)` | — | `packages/module-crm/src/ui/status-dialog.tsx` |
| `--surface-account-team` | L3 | `color-mix(in srgb, var(--role-team) 20%, var(--card))` | — | `packages/app-shell/src/components/account-menu.tsx` |
| `--surface-account-client` | L3 | `color-mix(in srgb, var(--role-client) 20%, var(--card))` | — | `packages/app-shell/src/components/account-menu.tsx` |
| `--surface-account` | L3 | `color-mix(in srgb, var(--foreground) 3%, var(--card) 97%)` | — | `packages/app-shell/src/components/account-menu.tsx` |
| `--surface-account-hover` | L3 | `color-mix(in srgb, var(--foreground) 5%, transparent)` | — | `packages/app-shell/src/components/account-menu.tsx` |
| `--account-presence` | L3 | `#10b981` | — | `packages/app-shell/src/components/account-menu.tsx` |
| `--account-presence-size` | L3 | `0.625rem` | — | `packages/app-shell/src/components/account-menu.tsx` |
| `--row-hover-sweep` | L3 | `linear-gradient(90deg, transparent, color-mix(in srgb, var(--row-sweep-tint, var(--foreground)) 9%, transparent) 50%, transparent)` | — | `packages/theme/src/surfaces.css` |
| `--surface-status-success` | L3 | `color-mix(in srgb, var(--semantic-success) 14%, transparent)` | — | `packages/theme/src/surfaces.css` |
| `--surface-status-warning` | L3 | `color-mix(in srgb, var(--semantic-warning) 14%, transparent)` | — | `packages/theme/src/surfaces.css` |
| `--surface-status-danger` | L3 | `color-mix(in srgb, var(--semantic-danger) 12%, transparent)` | — | `packages/theme/src/surfaces.css` |
| `--scrollbar-thumb` | L3 | `color-mix(in srgb, var(--foreground) 18%, transparent)` | — | `packages/theme/src/typography.css`<br>`packages/theme/themes/mq-aliases.css` |
| `--scrollbar-thumb-hover` | L3 | `color-mix(in srgb, var(--foreground) 30%, transparent)` | — | `packages/theme/src/typography.css`<br>`packages/theme/themes/mq-aliases.css` |
| `--toast-success-bg` | L3 | `color-mix(in srgb, var(--primary) 12%, var(--background))` | — | `packages/ui/src/components/sonner.tsx` |
| `--toast-success-border` | L3 | `color-mix(in srgb, var(--primary) 30%, var(--background))` | — | `packages/ui/src/components/sonner.tsx` |
| `--toast-warning-bg` | L3 | `color-mix(in srgb, var(--accent) 12%, var(--background))` | — | `packages/ui/src/components/sonner.tsx` |
| `--toast-warning-text` | L3 | `color-mix(in srgb, var(--accent) 80%, var(--foreground))` | — | `packages/ui/src/components/sonner.tsx` |
| `--toast-warning-border` | L3 | `color-mix(in srgb, var(--accent) 30%, var(--background))` | — | `packages/ui/src/components/sonner.tsx` |
| `--toast-error-bg` | L3 | `color-mix(in srgb, var(--destructive) 12%, var(--background))` | — | `packages/ui/src/components/sonner.tsx` |
| `--toast-error-border` | L3 | `color-mix(in srgb, var(--destructive) 30%, var(--background))` | — | `packages/ui/src/components/sonner.tsx` |
| `--toast-info-bg` | L3 | `color-mix(in srgb, var(--secondary) 15%, var(--background))` | — | `packages/ui/src/components/sonner.tsx` |
| `--toast-info-text` | L3 | `color-mix(in srgb, var(--secondary) 70%, var(--foreground))` | — | `packages/ui/src/components/sonner.tsx` |
| `--toast-info-border` | L3 | `color-mix(in srgb, var(--secondary) 30%, var(--background))` | — | `packages/ui/src/components/sonner.tsx` |
| `--shadow-accent-control` | L3 | `0 4px 14px color-mix(in srgb, var(--brand-accent) 26%, transparent)` | — | `packages/ui/src/components/button-variants.ts` |
| `--shadow-toolbar-control` | L3 | `0 4px 14px rgba(91, 197, 242, 0.26)` | — | `packages/app-shell/src/components/toolbar-shared.tsx` |
| `--shadow-toolbar-popover` | L3 | `0 18px 44px rgba(10, 21, 26, 0.16), 0 2px 10px rgba(10, 21, 26, 0.08)` | — | `packages/module-crm/src/ui/toolbar-controls.tsx` |
| `--shadow-tooltip` | L3 | `0 14px 34px var(--elevate-3)` | — | `packages/ui/src/components/tooltip.tsx` |
| `--shadow-dialog` | L3 | `0 24px 64px var(--elevate-3)` | — | `packages/ui/src/components/alert-dialog.tsx` |
| `--shadow-phone-dropdown` | L3 | `0 12px 28px var(--elevate-3)` | — | `packages/ui/src/components/phone-input.tsx` |
| `--report-hero-glow` | L3 | `radial-gradient(circle, color-mix(in srgb, var(--accent) 38%, transparent), transparent 70%)` | — | `packages/module-crm/src/ui/report-banner.tsx`<br>`packages/module-crm/src/ui/report.tsx` |
| `--report-hero-rule` | L3 | `linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 60%, transparent), transparent)` | — | `packages/module-crm/src/ui/report-banner.tsx`<br>`packages/module-crm/src/ui/report.tsx` |
| `--shell-frame-offset` | L3 | `0.75rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-sidebar-width` | L3 | `15rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-sidebar-collapsed-width` | L3 | `4rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-sidebar-toggle-offset` | L3 | `3.25rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-sidebar-toggle-size` | L3 | `1.625rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-sidebar-toggle-inset` | L3 | `-0.8125rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-brand-height` | L3 | `2.25rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-item-height` | L3 | `2.625rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-item-collapsed-size` | L3 | `2.75rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-icon-well-size` | L3 | `1.6875rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-icon-radius` | L3 | `0.5rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-icon-size` | L3 | `0.9375rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-divider-width` | L3 | `2.25rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-child-height` | L3 | `2.25rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-child-enter-offset` | L3 | `0.25rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-active-indicator-inset` | L3 | `0.5625rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-active-indicator-collapsed-inset` | L3 | `0.6875rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-active-indicator-width` | L3 | `0.1875rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-active-indicator-offset` | L3 | `-0.0625rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-context-dot-size` | L3 | `0.5rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-context-dot-offset` | L3 | `-0.1875rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-context-dot-border` | L3 | `0.125rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-header-divider-height` | L3 | `1.25rem` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-account-gap` | L3 | `0.6875rem` | — | `packages/app-shell/src/components/account-menu.tsx` |
| `--shell-account-padding-y` | L3 | `0.4375rem` | — | `packages/app-shell/src/components/account-menu.tsx` |
| `--shell-surface-border` | L3 | `color-mix(in srgb, var(--foreground) 10%, transparent)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-surface-hover` | L3 | `color-mix(in srgb, var(--card) 78%, var(--foreground) 3%)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-surface-active` | L3 | `color-mix(in srgb, var(--accent) 11%, var(--card) 89%)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-hairline` | L3 | `color-mix(in srgb, var(--foreground) 7%, transparent)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-icon-bg` | L3 | `color-mix(in srgb, var(--foreground) 4.5%, var(--card) 95.5%)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-group-open` | L3 | `color-mix(in srgb, var(--foreground) 2.6%, transparent)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-shadow` | L3 | `0 16px 38px rgba(10, 21, 26, 0.06), 0 2px 10px rgba(10, 21, 26, 0.04)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-background` | L3 | `#f4f8fb` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-sidebar-background` | L3 | `linear-gradient(180deg, color-mix(in srgb, var(--card) 94%, white 6%) 0%, color-mix(in srgb, var(--card) 98%, transparent) 100%)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-control-muted` | L3 | `color-mix(in srgb, var(--foreground) 58%, transparent)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-foreground` | L3 | `color-mix(in srgb, var(--foreground) 70%, transparent)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-active-border` | L3 | `color-mix(in srgb, var(--accent) 28%, var(--shell-surface-border))` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-active-icon-bg` | L3 | `color-mix(in srgb, var(--accent) 18%, var(--card) 82%)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-active-icon-fg` | L3 | `color-mix(in srgb, var(--accent) 82%, black 18%)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-context-icon-bg` | L3 | `color-mix(in srgb, var(--accent) 16%, var(--card) 84%)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-context-icon-fg` | L3 | `color-mix(in srgb, var(--accent) 80%, black 20%)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-child-fg` | L3 | `color-mix(in srgb, var(--foreground) 64%, transparent)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-child-icon-fg` | L3 | `color-mix(in srgb, var(--foreground) 48%, transparent)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-child-active-bg` | L3 | `color-mix(in srgb, var(--accent) 13%, var(--card) 87%)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-nav-child-active-border` | L3 | `color-mix(in srgb, var(--accent) 26%, var(--shell-surface-border))` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-navbar-fg` | L3 | `#0a151a` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-navbar-muted` | L3 | `#8e8f9a` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--shell-navbar-hairline` | L3 | `color-mix(in srgb, #0a151a 8%, transparent)` | — | `packages/app-shell/src/components/shell-surfaces.module.css` |
| `--toolbar-popover-width` | L3 | `18.75rem` | — | `packages/module-crm/src/ui/toolbar-controls.tsx` |
| `--toolbar-chip-height` | L3 | `1.875rem` | — | `packages/module-crm/src/ui/toolbar-controls.tsx` |
| `--toolbar-search-min-width` | L3 | `13.125rem` | — | `packages/module-crm/src/ui/toolbar-controls.tsx` |
| `--toolbar-icon-size` | L3 | `0.9375rem` | — | `packages/module-crm/src/ui/toolbar-controls.tsx` |
| `--radius-toolbar-popover` | L3 | `0.875rem` | — | `packages/module-crm/src/ui/toolbar-controls.tsx` |
| `--crm-sidebar-gap` | L3 | `1.125rem` | — | `packages/module-crm/src/ui/dashboard-sidebar.tsx` |
| `--crm-report-copy-max-width` | L3 | `34rem` | — | `packages/module-crm/src/ui/report-banner.tsx` |
| `--crm-report-metric-min-width` | L3 | `6.5rem` | — | `packages/module-crm/src/ui/report-banner.tsx` |
| `--timeline-list-inset` | L3 | `0.625rem` | — | `packages/module-crm/src/ui/activity-card.tsx`<br>`packages/module-crm/src/ui/dashboard-sidebar.tsx`<br>`packages/module-crm/src/ui/timeline.tsx` |
| `--timeline-line-offset` | L3 | `0.28125rem` | — | `packages/module-crm/src/ui/activity-card.tsx`<br>`packages/module-crm/src/ui/timeline.tsx` |
| `--timeline-marker-offset` | L3 | `0.3125rem` | — | `packages/module-crm/src/ui/activity-card.tsx`<br>`packages/module-crm/src/ui/timeline.tsx` |
| `--table-header-height` | L3 | `2.25rem` | — | `packages/module-crm/src/ui/contacts-table.tsx` |
| `--table-cell-padding-x` | L3 | `1rem` | — | `packages/module-crm/src/ui/contacts-table.tsx` |
| `--table-cell-padding-y` | L3 | `0.5rem` | — | `packages/module-crm/src/ui/contacts-table.tsx` |
| `--crm-table-viewport-offset` | L3 | `12rem` | — | `packages/module-crm/src/ui/contacts-table.tsx` |
| `--crm-table-min-height` | L3 | `35rem` | — | `packages/module-crm/src/ui/contacts-table.tsx` |
| `--crm-table-empty-min-height` | L3 | `26.25rem` | — | `packages/module-crm/src/ui/contacts-table.tsx` |
| `--report-stat-min-width` | L3 | `9rem` | — | `packages/module-crm/src/ui/report.tsx` |
| `--dialog-width` | L3 | `28rem` | — | `packages/ui/src/components/alert-dialog.tsx` |
| `--sheet-width` | L3 | `24rem` | — | `packages/ui/src/components/sheet.tsx` |
| `--crm-sheet-width` | L3 | `32rem` | — | `packages/module-crm/src/ui/organizations-browser.tsx` |
| `--menu-min-width` | L3 | `8rem` | — | `packages/ui/src/components/dropdown-menu.tsx` |
| `--chart-tooltip-min-width` | L3 | `8rem` | — | `packages/ui/src/components/chart.tsx` |
| `--skeleton-line-height` | L3 | `0.6rem` | — | `packages/ui/src/components/skeleton-table.tsx`<br>`packages/ui/src/components/skeleton.tsx` |
| `--skeleton-line-height-lg` | L3 | `0.7rem` | — | `packages/ui/src/components/skeleton.tsx` |
| `--skeleton-line-height-compact` | L3 | `0.55rem` | — | `packages/module-crm/src/ui/dashboard-sidebar.tsx` |
| `--skeleton-line-height-xs` | L3 | `0.5rem` | — | `packages/module-crm/src/ui/dashboard-sidebar.tsx` |
| `--section-icon-size` | L3 | `1.875rem` | — | `packages/theme/src/surfaces.css` |
| `--surface-enter-offset` | L3 | `0.625rem` | — | `packages/theme/src/surfaces.css` |
| `--space-eyebrow-y` | L3 | `0.375rem` | — | `packages/theme/src/surfaces.css` |
| `--scrollbar-size` | L3 | `0.375rem` | — | `packages/theme/src/typography.css`<br>`packages/theme/themes/mq-aliases.css` |
| `--tint-soft-border` | L3 | `color-mix(in srgb, var(--tint) 34%, transparent)` | — | `packages/theme/src/surfaces.css` |
| `--tint-soft-bg` | L3 | `color-mix(in srgb, var(--tint) 10%, var(--card))` | — | `packages/theme/src/surfaces.css` |
| `--tint-soft-hover` | L3 | `color-mix(in srgb, var(--tint) 14%, var(--card))` | — | `packages/theme/src/surfaces.css` |
| `--tint-hero-border` | L3 | `color-mix(in srgb, var(--tint) 46%, transparent)` | — | `packages/theme/src/surfaces.css` |
| `--tint-hero-bg` | L3 | `color-mix(in srgb, var(--tint) 16%, transparent)` | — | `packages/theme/src/surfaces.css` |
| `--tint-hero-fg` | L3 | `color-mix(in srgb, var(--tint) 18%, white)` | — | `packages/theme/src/surfaces.css` |
| `--tint-hero-hover` | L3 | `color-mix(in srgb, var(--tint) 24%, transparent)` | — | `packages/theme/src/surfaces.css` |
