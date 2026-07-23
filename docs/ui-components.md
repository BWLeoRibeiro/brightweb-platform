# BrightWeb UI component inventory

This inventory records the reusable visual APIs shipped by the platform as of Brief 27. “Used by” names package consumers rather than individual files. A dash in the MQ origin column means the component is a platform primitive or predates the file-by-file MQ translation ledgers.

Tier definitions:

- **primitive** — low-level control or compound control family.
- **pattern** — reusable composition with BrightWeb layout or semantic styling.
- **surface** — route-, shell-, or module-level experience.

## `@brightweblabs/ui`

| Component | Package | Path | Tier (primitive / pattern / surface) | Used by (packages) | MQ origin (file) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `Button`, `buttonVariants` | `@brightweblabs/ui` | `packages/ui/src/components/button.tsx` | primitive | app-shell, module-admin, module-crm, module-projects, platform-preview | — | Canonical button element and variants. |
| `Checkbox` | `@brightweblabs/ui` | `packages/ui/src/components/checkbox.tsx` | primitive | module-admin, module-crm, module-projects | — | Native-input wrapper; deliberately emits the same input markup as the controls normalized in Brief 27. |
| `Input` | `@brightweblabs/ui` | `packages/ui/src/components/input.tsx` | primitive | module-projects | — | Styled text input. Literal preview playground fields remain app-owned because their classes differ. |
| `Label` | `@brightweblabs/ui` | `packages/ui/src/components/label.tsx` | primitive | module-projects | — | Radix-backed form label. |
| `Field`, `FieldContent`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldLabel`, `FieldLegend`, `FieldSet` | `@brightweblabs/ui` | `packages/ui/src/components/field.tsx` | pattern | module-projects | — | Form layout family. |
| `PasswordInput` | `@brightweblabs/ui` | `packages/ui/src/components/password-input.tsx` | pattern | downstream apps | — | Input with visibility control. |
| `PasswordStrength` | `@brightweblabs/ui` | `packages/ui/src/components/password-strength.tsx` | pattern | downstream apps | — | Password-policy feedback. |
| `PhoneInput` | `@brightweblabs/ui` | `packages/ui/src/components/phone-input.tsx` | pattern | module-crm, module-projects | — | International phone control. |
| `SearchField` | `@brightweblabs/ui` | `packages/ui/src/components/search-field.tsx` | pattern | module-crm, module-projects | — | Search input with clear action. Toolbar search chips keep their literal MQ pill composition because markup and dimensions differ. |
| `Badge`, `badgeVariants` | `@brightweblabs/ui` | `packages/ui/src/components/badge.tsx` | primitive | module-admin, module-crm | — | Generic badge. |
| `StatusPill` | `@brightweblabs/ui` | `packages/ui/src/components/status-pill.tsx` | pattern | module-crm, platform-preview | — | Token-driven status pill. Projects state, task, and visibility pills retain literal MQ markup where their size/tone recipes differ. |
| `RoleBadge` | `@brightweblabs/ui` | `packages/ui/src/components/role-badge.tsx` | pattern | downstream apps | — | Generic role label and token resolver. Projects `MemberRoleBadge` retains MQ-specific role-color behavior. |
| `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount` | `@brightweblabs/ui` | `packages/ui/src/components/avatar.tsx` | primitive | UI patterns, downstream apps | — | Radix avatar family. |
| `InitialsAvatar` | `@brightweblabs/ui` | `packages/ui/src/components/initials-avatar.tsx` | pattern | downstream apps | — | General initials avatar. Shell account avatars and Projects `ProjectOwnerAvatar` retain literal class and fallback behavior. |
| `Separator` | `@brightweblabs/ui` | `packages/ui/src/components/separator.tsx` | primitive | app-shell, downstream apps | — | Radix separator. |
| `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` | `@brightweblabs/ui` | `packages/ui/src/components/tooltip.tsx` | primitive | app-shell, module-projects | `components/ui/tooltip.tsx` | Canonical tooltip family used by translated MQ surfaces. |
| `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor` | `@brightweblabs/ui` | `packages/ui/src/components/popover.tsx` | primitive | module-crm, module-projects | — | Radix popover family. |
| `DropdownMenu` family | `@brightweblabs/ui` | `packages/ui/src/components/dropdown-menu.tsx` | primitive | app-shell, module-admin, module-crm, module-projects | — | Includes portal, trigger, content, group, label, item, checkbox/radio items, separator, shortcut, and sub-menu exports. |
| `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription` | `@brightweblabs/ui` | `packages/ui/src/components/sheet.tsx` | primitive | app-shell, module-crm, module-projects | `components/ui/sheet.tsx` | Radix dialog-backed sheet family. |
| `AlertDialog` family | `@brightweblabs/ui` | `packages/ui/src/components/alert-dialog.tsx` | primitive | module-admin, module-crm, module-projects | `components/ui/alert-dialog.tsx` | Root, trigger, portal, overlay, content, header, footer, title, description, action, and cancel. |
| `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption` | `@brightweblabs/ui` | `packages/ui/src/components/table.tsx` | primitive | module-admin, module-crm | — | Canonical semantic table family. Dashboard and Projects board/task layouts keep MQ’s non-table grid/list markup. |
| `Pagination` family | `@brightweblabs/ui` | `packages/ui/src/components/pagination.tsx` | primitive | downstream apps | — | Root, content, item, link, previous, next, and ellipsis exports. |
| `TablePagination` | `@brightweblabs/ui` | `packages/ui/src/components/table-pagination.tsx` | pattern | module-crm, module-projects | — | Shared page window and navigation; Projects wraps it only to bind dictionary text and controller state. |
| `Card`, `CardHeader`, `CardFooter`, `CardTitle`, `CardAction`, `CardDescription`, `CardContent` | `@brightweblabs/ui` | `packages/ui/src/components/card.tsx` | primitive | downstream apps | — | Generic card family. MQ surfaces may keep literal surface recipes when padding or border markup differs. |
| `SurfaceCard` | `@brightweblabs/ui` | `packages/ui/src/components/surface-card.tsx` | pattern | module-crm, platform-preview | — | Canonical BrightWeb surface. Projects `ProjectSurfaceCard` retains MQ-specific classes and section slots. |
| `SectionHeading` | `@brightweblabs/ui` | `packages/ui/src/components/section-heading.tsx` | pattern | module-crm, platform-preview | — | General icon/title/subtitle/action heading. Dashboard and Projects section headings preserve their distinct MQ markup. |
| `StatTile`, `StatValue` | `@brightweblabs/ui` | `packages/ui/src/components/stat-tile.tsx` | pattern | platform-preview | — | General metric tile. Projects overview stats preserve a denser literal MQ composition. |
| `KpiBreakdownBar` | `@brightweblabs/ui` | `packages/ui/src/components/kpi-breakdown-bar.tsx` | pattern | module-crm | — | Shared token-driven breakdown. AppDashboard’s local bar is retained because MQ’s DOM, animation, and labels differ. |
| `EmptyState` | `@brightweblabs/ui` | `packages/ui/src/components/empty-state.tsx` | pattern | module-crm | — | General icon/title/hint/action empty state. Alerts, dashboard, and Projects keep compact or in-card literal empty states with different markup. |
| `ActionButton`, `actionClassName` | `@brightweblabs/ui` | `packages/ui/src/components/action.tsx` | pattern | downstream apps | `components/app/portal-action.tsx` | General action treatment; dashboard owns its exact portal action link. |
| `ActivityMessage` | `@brightweblabs/ui` | `packages/ui/src/components/activity-message.tsx` | pattern | module-crm, module-projects | — | Renders structured activity message segments. |
| `Skeleton`, `SkeletonLine`, `SkeletonText`, `SkeletonCard`, `SkeletonCircle` | `@brightweblabs/ui` | `packages/ui/src/components/skeleton.tsx` | primitive | app-shell, module-crm, module-projects | `components/ui/skeleton.tsx` | Shared loading primitives. |
| `TableRowsSkeleton` | `@brightweblabs/ui` | `packages/ui/src/components/skeleton-table.tsx` | pattern | module-crm | — | Table-shaped loading rows. |
| `Calendar`, `CalendarDayButton` | `@brightweblabs/ui` | `packages/ui/src/components/calendar.tsx` | primitive | module-projects | — | React DayPicker calendar. |
| `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle` | `@brightweblabs/ui` | `packages/ui/src/components/chart.tsx` | pattern | downstream apps | — | Recharts context and presentation family. |
| `Breadcrumb` family | `@brightweblabs/ui` | `packages/ui/src/components/breadcrumb.tsx` | primitive | downstream apps | — | Root, list, item, link, page, separator, and ellipsis exports. |
| `Toaster` | `@brightweblabs/ui` | `packages/ui/src/components/sonner.tsx` | surface | platform-preview, downstream apps | — | Theme-aware Sonner host. |
| `ThemeProvider`, `ThemeScript`, `useTheme` | `@brightweblabs/app-shell` | `packages/app-shell/src/theme` | surface | platform-preview, downstream apps | — | Persistent shell-owned theme context plus pre-hydration document integration. |

## `@brightweblabs/app-shell`

| Component | Package | Path | Tier (primitive / pattern / surface) | Used by (packages) | MQ origin (file) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `AppShellFrame` | `@brightweblabs/app-shell` | `packages/app-shell/src/components/app-shell-frame.tsx` | surface | platform-preview | — | Canonical shell frame for desktop sidebar, header, mobile nav, and content. |
| `DesktopSidebar` | `@brightweblabs/app-shell` | `packages/app-shell/src/components/desktop-sidebar.tsx` | surface | platform-preview | — | Desktop navigation and account surface. |
| `MobileNav` | `@brightweblabs/app-shell` | `packages/app-shell/src/components/mobile-nav.tsx` | surface | platform-preview | — | Mobile primary/tools/module navigation. |
| `AppHeader` | `@brightweblabs/app-shell` | `packages/app-shell/src/components/app-header.tsx` | surface | platform-preview | — | Breadcrumb/title/contextual-toolbar/utility header. |
| `AlertsMenu` | `@brightweblabs/app-shell` | `packages/app-shell/src/components/alerts-menu.tsx` | surface | AppHeader, platform-preview | — | Notification popover. Its compact empty state intentionally differs from `EmptyState`. |
| `AccountMenu` | `@brightweblabs/app-shell` | `packages/app-shell/src/components/account-menu.tsx` | surface | DesktopSidebar | — | Account, role, theme, and sign-out popover. Literal account avatar markup is retained. |
| `ThemeMenu` | `@brightweblabs/app-shell` | `packages/app-shell/src/components/theme-menu.tsx` | pattern | AccountMenu | — | Theme selection menu. |
| `SidebarNavLink`, `SidebarSectionToggle`, `SidebarSubNavLink` | `@brightweblabs/app-shell` | `packages/app-shell/src/components/nav-primitives.tsx` | pattern | DesktopSidebar | — | Internal sidebar navigation patterns. |
| `MobileNavPill`, `MobileTogglePill` | `@brightweblabs/app-shell` | `packages/app-shell/src/components/nav-primitives.tsx` | pattern | MobileNav | — | Internal mobile navigation pills; not status pills. |
| `ToolbarNewMenu`, `ToolbarFilterToggle`, `ToolbarFiltersPill`, `ToolbarDropdownChip`, `ToolbarSearchRefreshPill` | `@brightweblabs/app-shell` | `packages/app-shell/src/components/toolbar-shared.tsx` | pattern | module-crm, module-projects, platform-preview | — | Canonical shell toolbar compositions. Module filter contents remain literal within the shared containers. |
| `AppSheetHeader`, `AppSheetBody`, `AppSheetFooter`, `SheetSection` | `@brightweblabs/app-shell` | `packages/app-shell/src/components/app-sheet.tsx` | pattern | module-crm, module-projects | `components/app/app-sheet.tsx`, `components/app/sheet-section.ts` | Shared application-sheet structure and class recipes. |
| `DashboardActionLink` | `@brightweblabs/app-shell` | `packages/app-shell/src/dashboard/primitives.tsx` | pattern | AppDashboard | `components/app/portal-action.tsx` | Dashboard’s literal link treatment differs from UI `ActionButton`. |
| `DashboardSectionHeading` | `@brightweblabs/app-shell` | `packages/app-shell/src/dashboard/primitives.tsx` | pattern | AppDashboard | `components/app/portal-section-heading.tsx` | Dashboard’s exact MQ heading composition. |
| `AppDashboard`, `DashboardClient` | `@brightweblabs/app-shell` | `packages/app-shell/src/dashboard/dashboard-client.tsx` | surface | platform-preview; module contributions from module-crm and module-projects | `app/(app)/dashboard/dashboard-client.tsx` | Aliases for the aggregate dashboard surface. Local KPI bars, tags, contact avatars, empty states, and task grids remain literal for parity. |
| `DashboardLoading` | `@brightweblabs/app-shell` | `packages/app-shell/src/dashboard/dashboard-loading.tsx` | surface | platform-preview | `app/(app)/dashboard/loading.tsx` | Dashboard route fallback. |

## Module UI surfaces and shared patterns

| Component | Package | Path | Tier (primitive / pattern / surface) | Used by (packages) | MQ origin (file) | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `CrmDashboard` | `@brightweblabs/module-crm/ui` | `packages/module-crm/src/ui/dashboard.tsx` | surface | platform-preview | — (pre-ledger CRM port) | CRM aggregate surface. |
| `CrmContactsTable` | `@brightweblabs/module-crm/ui` | `packages/module-crm/src/ui/contacts-table.tsx` | surface | module-crm | — (pre-ledger CRM port) | Uses shared Table, Checkbox, StatusPill, and TablePagination. Its icon-led no-data table cell differs from general `EmptyState`. |
| `CrmDashboardSidebar` | `@brightweblabs/module-crm/ui` | `packages/module-crm/src/ui/dashboard-sidebar.tsx` | surface | module-crm | — (pre-ledger CRM port) | CRM timeline/organization sidebar cards. |
| `CrmActivityCard` | `@brightweblabs/module-crm/ui` | `packages/module-crm/src/ui/activity-card.tsx` | pattern | module-crm, app-shell dashboard contribution | — (pre-ledger CRM port) | CRM activity row/card. |
| `CrmFunnelStats` | `@brightweblabs/module-crm/ui` | `packages/module-crm/src/ui/funnel-stats.tsx` | pattern | module-crm, app-shell dashboard contribution | — (pre-ledger CRM port) | Funnel metric pattern using shared KPI breakdown. |
| `CrmTimeline`, `CrmTimelineBrowser` | `@brightweblabs/module-crm/ui` | `packages/module-crm/src/ui/timeline.tsx`, `packages/module-crm/src/ui/timeline-browser.tsx` | surface | module-crm | — (pre-ledger CRM port) | Embedded timeline plus searchable sheet browser. |
| `CrmOrganizationsBrowser`, `CrmOrganizationSheet` | `@brightweblabs/module-crm/ui` | `packages/module-crm/src/ui/organizations-browser.tsx`, `packages/module-crm/src/ui/organization-sheet.tsx` | surface | module-crm | — (pre-ledger CRM port) | Organization browser and edit sheet. |
| `CrmContactDialog`, `CrmStatusDialog`, `CrmDeleteDialog` | `@brightweblabs/module-crm/ui` | `packages/module-crm/src/ui/contact-dialog.tsx`, `packages/module-crm/src/ui/status-dialog.tsx`, `packages/module-crm/src/ui/delete-dialog.tsx` | surface | module-crm | — (pre-ledger CRM port) | CRM mutation dialogs. Stage selectors retain literal interactive pill markup. |
| `CrmReport`, `CrmReportPage`, `CrmReportBanner` | `@brightweblabs/module-crm/ui` | `packages/module-crm/src/ui/report.tsx`, `packages/module-crm/src/ui/report-banner.tsx` | surface | platform-preview, module-crm | — (pre-ledger CRM port) | Report page and dashboard banner. |
| `CrmToolbarSearchChip`, `CrmToolbarFiltersPill`, `CrmToolbarCreateMenu`, `CrmToolbarControls` | `@brightweblabs/module-crm/ui` | `packages/module-crm/src/ui/toolbar-controls.tsx` | pattern | platform-preview, module-crm | — (pre-ledger CRM port) | Binds CRM state and dictionary to app-shell toolbar patterns. |
| `ProjectsPage`, `ProjectsPortfolioRoot` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/projects-page.tsx`, `packages/module-projects/src/ui/projects-portfolio/projects-portfolio-root.tsx` | surface | platform-preview | `projetos/page.tsx`, `projetos/_components/projects-portfolio/projects-portfolio-root.tsx` | Projects portfolio route and client root. |
| `ProjectsPortfolioList`, `ProjectsPortfolioStats`, `ProjectsPortfolioPagination`, `ProjectsPortfolioModals` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/projects-portfolio/` | pattern | module-projects | `projetos/_components/projects-portfolio/*` | Portfolio sub-surfaces. Pagination wraps shared `TablePagination` without changing its markup. |
| `ProjectDetailPage`, `ProjectDetailDataProvider` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/project-detail-page.tsx`, `packages/module-projects/src/ui/project-detail-data-provider.tsx` | surface | platform-preview | `projetos/[projectId]/page.tsx`, `projetos/[projectId]/_components/project-detail-data-provider.tsx` | Project detail composition and data context. |
| `ProjectDetailHero`, `ProjectDetailMetadataStrip`, `ProjectDetailTeamCard` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/project-detail-hero.tsx`, `packages/module-projects/src/ui/project-detail-metadata-strip.tsx`, `packages/module-projects/src/ui/project-detail-team-card.tsx` | surface | module-projects | Matching files under `projetos/[projectId]/_components/` | Literal MQ detail sections. |
| `ProjectMilestonesAndTasksCards`, `ProjectMilestonesAndTasksLists` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/project-detail-editable-cards.tsx`, `packages/module-projects/src/ui/project-milestone-task-lists.tsx` | surface | module-projects | Matching files under `projetos/[projectId]/_components/` | In-card and full list/task compositions. Their compact section-empty markup differs from UI `EmptyState`. |
| `ProjectActivityCard`, `ProjectRecentActivity`, `ActivityChangeRows` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/project-activity-card.tsx`, `packages/module-projects/src/ui/project-recent-activity.tsx`, `packages/module-projects/src/ui/shared/activity-change-rows.tsx` | pattern | module-projects | `projetos/[projectId]/_components/project-activity-card.tsx` and MQ activity composition | Project activity surfaces sharing UI activity formatting. |
| `ProjectLinksCard` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/project-links-card.tsx` | surface | module-projects | `projetos/[projectId]/_components/project-links-card.tsx` | Link visibility pills and its empty state remain literal because shared patterns do not emit the same structure. |
| `ProjectBoardKanban`, `ProjectBoardLoading`, `ProjectBoardToolbarControls` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/project-board-kanban.tsx`, `packages/module-projects/src/ui/project-board-loading.tsx`, `packages/module-projects/src/ui/project-board-toolbar-controls.tsx` | surface | platform-preview | `projetos/[projectId]/quadro/*` | Literal board surface and toolbar binding. |
| `ProjectTasksPage`, `ProjectBoardPage` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/project-tasks-page.tsx` | surface | platform-preview | `projetos/[projectId]/tarefas/page.tsx`, `projetos/[projectId]/quadro/page.tsx` | Public aliases sharing one task/board route composition. |
| `CreateProjectSheet`, `CreateProjectTaskSheet` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/create-project-sheet.tsx`, `packages/module-projects/src/ui/create-project-task-sheet.tsx` | surface | module-projects | `projetos/_components/create-project-sheet.tsx`, `projetos/_components/create-project-task-sheet.tsx` | Creation sheets; member selection now uses shared native Checkbox with identical markup/classes. |
| `ProjectEditSheet`, `ProjectMembersEditSheet`, `ProjectStatusQuickAction` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/project-edit-sheet.tsx`, `packages/module-projects/src/ui/project-members-edit-sheet.tsx`, `packages/module-projects/src/ui/project-status-quick-action.tsx` | surface | module-projects | Matching files under `projetos/[projectId]/_components/` | Edit/membership/status surfaces. Confirmation-button styling stays literal. |
| `ProjectMilestoneCreateSheet`, `ProjectTaskCreateSheet`, `ProjectLinkCreateSheet`, `ProjectDetailCreateSheetsMount` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/project-detail-create-sheets/` | surface | module-projects | Matching directory under `projetos/[projectId]/_components/` | Lazily mounted detail creation sheets. |
| `ProjectStateBadge`, `ProjectStatusBadge`, `ProjectHealthBadge` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/project-state-badge.tsx` | pattern | module-projects | `projetos/_components/project-state-badge.tsx` | MQ-specific hero/default surfaces use `tintPill`; not interchangeable with generic `StatusPill`. |
| `ProjectPill`, `ProjectDotPill` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/shared/project-pill.tsx` | pattern | module-projects | `components/projects/project-pill.tsx` | Base Projects pill geometry. |
| `ProjectOwnerAvatar` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/shared/project-owner-avatar.tsx` | pattern | module-projects, app-shell dashboard contribution | `components/projects/project-owner-avatar.tsx` | Role-colored literal avatar. Fallback and classes differ from UI `InitialsAvatar`. |
| `MemberRoleBadge` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/shared/member-role-badge.tsx` | pattern | module-projects | `components/projects/member-role-badge.tsx` | Projects role palette and labels. |
| `ProjectProgressBar` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/shared/project-progress.tsx` | pattern | module-projects, app-shell dashboard contribution | `components/projects/project-progress.tsx` | Project progress recipe. |
| `ProjectSummaryCard`, `ProjectSummaryCardSkeleton` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/shared/project-summary-card.tsx`, `packages/module-projects/src/ui/shared/project-summary-card-skeleton.tsx` | pattern | module-projects, app-shell | `components/projects/project-summary-card.tsx`, `components/projects/project-summary-card-skeleton.tsx` | Injected into AppDashboard through module registration. |
| `ProjectSurfaceCard`, `ProjectSurfaceSectionHeader` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/shared/project-surface-card.tsx` | pattern | module-projects | `components/projects/project-surface-card.tsx` | Literal Projects surface composition; differs from UI `SurfaceCard` and `SectionHeading`. |
| `ProjectOverviewStatCard`, `ProjectOverviewStatValue`, `ProjectOverviewStatIconValue`, `ProjectOverviewStatMeta` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/shared/project-overview-stat-card.tsx` | pattern | module-projects | `components/projects/project-overview-stat-card.tsx` | Dense MQ project metric family. |
| `TaskTag`, `TaskPriorityTag`, `TaskStatusTag`, `TaskMilestoneMeta`, `TaskAssigneeMeta`, `TaskDueMeta` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/shared/task-tags.tsx` | pattern | module-projects, app-shell | `components/projects/task-tags.tsx` | Task-specific pill/meta family; generic `StatusPill` cannot reproduce all variants. |
| `SectionEmptyState`, `SectionLoadingState` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/shared/section-feedback.tsx` | pattern | module-projects | `components/projects/section-feedback.tsx` | Compact section feedback, intentionally distinct from UI `EmptyState`. |
| `SectionIconButton`, `SectionAddButton` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/shared/section-icon-button.tsx` | pattern | module-projects | `components/projects/section-icon-button.tsx` | Projects section actions. |
| `ContactActionButtons` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/shared/contact-action-buttons.tsx` | pattern | module-projects | `components/projects/contact-action-buttons.tsx` | Email/phone action pair. |
| `FormSection`, `SelectField`, `DateField` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/project-create/shared-fields.tsx` | pattern | module-projects | `projetos/_components/project-create/shared-fields.tsx` | Shared project-creation fields. |
| `ProjectsToolbarControls` | `@brightweblabs/module-projects/ui` | `packages/module-projects/src/ui/toolbar-controls.tsx` | pattern | platform-preview | MQ Projects toolbar composition | Binds Projects filters and creation actions to app-shell toolbar containers. |

## Brief 27 changelog

### REMOVED

| Item | Former location | Reason |
| --- | --- | --- |
| `ProjectActivityCardLoader` | `packages/module-projects/src/ui/project-activity-card-loader.tsx:1` | Orphaned translated wrapper; no import, public export, route, test, contract, or documentation consumer beyond the stale translation ledger. |
| `ProjectDetailStatsStrip` | `packages/module-projects/src/ui/project-detail-stats-strip.tsx:1` | Orphaned alternate detail strip; the live detail composition uses the editable cards and metadata strip. |
| Legacy Projects playground page | `apps/platform-preview/app/playground/projects/page.tsx:1` | Superseded by the packaged `/projects`, detail, board, and task previews; it was no longer linked by preview module configuration. |
| `--project-ui-color-65` | `packages/module-projects/tokens.css:69` | Definition-only token with no static or computed consumer. |
| `--project-ui-color-66` | `packages/module-projects/tokens.css:70` | Definition-only token with no static or computed consumer. |
| `--project-ui-color-81` | `packages/module-projects/tokens.css:85` | Definition-only token with no static or computed consumer. |
| `--project-ui-color-82` | `packages/module-projects/tokens.css:86` | Definition-only token with no static or computed consumer. |
| `.project-chip-code` | `packages/module-projects/tokens.css:159` | Unused class; no component or app applied it. |
| `.project-group-title` | `packages/module-projects/tokens.css:283` | Unused class; no component or app applied it. |

The stale `member-initials-avatar.tsx` entry in `docs/internal/brief-23-translation-table.md:62` was corrected to the live `ProjectOwnerAvatar` normalization. The two removed component rows in that ledger now record their Brief 27 disposition.

### NORMALIZED

| Replacement | Location | Parity statement |
| --- | --- | --- |
| Raw admin select-all checkbox → UI `Checkbox` | `packages/module-admin/src/users-client.tsx:353` | Same native `input`, props, classes, and event handler. |
| Raw admin row checkbox → UI `Checkbox` | `packages/module-admin/src/users-client.tsx:384` | Same native `input`, props, classes, and event handler. |
| Raw CRM select-all checkbox → UI `Checkbox` | `packages/module-crm/src/ui/contacts-table.tsx:182` | Same native `input`, props, classes, and event handler. |
| Raw CRM row checkbox → UI `Checkbox` | `packages/module-crm/src/ui/contacts-table.tsx:206` | Same native `input`, props, classes, and event handler. |
| Raw Projects member checkbox → UI `Checkbox` | `packages/module-projects/src/ui/create-project-sheet.tsx:813` | Same native `input`, id, props, classes, and event handler. |

`tests/ui-hygiene.test.ts` enforces that package and preview source cannot introduce another raw `<input type="checkbox">` outside the UI primitive.
