# `@brightweblabs/theme` token contract

BrightWeb themes follow one cascade: L0 brand primitives feed L1 shadcn semantics, L2 describes brand-agnostic states, and L3 exposes component and experience controls. Package components consume L1-L3 tokens only; theme files such as `themes/mq.css` override values without changing component code.

## L3 visual tokens

| Tokens | Purpose |
| --- | --- |
| `--text-ui-chip`, `--text-ui-action`, `--text-ui-calendar` | Compact control and calendar type sizes. |
| `--text-ui-shell-title`, `--text-ui-report-title`, `--text-ui-report-title-lg`, `--text-ui-report-metric` | Shell and CRM report display type sizes. |
| `--surface-overlay`, `--surface-overlay-strong`, `--surface-tooltip`, `--surface-badge-tint` | Overlay, tooltip, and tint surfaces. |
| `--surface-button-soft`, `--surface-button-soft-hover`, `--border-button-soft-hover` | Soft button surface states. |
| `--surface-selection`, `--border-selection`, `--surface-pagination-active`, `--border-pagination-active` | Selected control and active pagination states. |
| `--surface-danger-subtle` | Subtle destructive-state background. |
| `--surface-account-team`, `--surface-account-client`, `--surface-account`, `--surface-account-hover`, `--account-presence` | Account rail identity, presence, and interaction surfaces. |
| `--account-presence-size`, `--radius-swatch`, `--radius-pill`, `--radius-scrollbar` | Presence, swatch, pill, avatar, and scrollbar geometry. |
| `--row-hover-sweep`, `--surface-status-success`, `--surface-status-warning`, `--surface-status-danger` | Shared row and status surfaces. |
| `--tint-soft-border`, `--tint-soft-bg`, `--tint-soft-hover`, `--tint-hero-border`, `--tint-hero-bg`, `--tint-hero-fg`, `--tint-hero-hover` | Dynamic tint recipes resolved where a component supplies `--tint`. |
| `--scrollbar-thumb`, `--scrollbar-thumb-hover`, `--scrollbar-size` | Shared scrollbar colour and geometry. |
| `--toast-success-bg`, `--toast-success-border`, `--toast-warning-bg`, `--toast-warning-text`, `--toast-warning-border`, `--toast-error-bg`, `--toast-error-border`, `--toast-info-bg`, `--toast-info-text`, `--toast-info-border` | Sonner semantic toast palette. |
| `--shadow-accent-control`, `--shadow-toolbar-control`, `--shadow-toolbar-popover`, `--shadow-tooltip`, `--shadow-dialog`, `--shadow-phone-dropdown` | Component elevation recipes. |
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
