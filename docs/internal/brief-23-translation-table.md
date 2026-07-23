# Brief 23 translation ledger

The map was fixed before implementation. MQ is read-only. Board/task-route files under `quadro/` and `tarefas/` are intentionally deferred to part 2.

## In-scope Projects route files

| MQ source (relative to `projetos/`) | Package destination | Status |
| --- | --- | --- |
| `[projectId]/_components/project-activity-card-loader.tsx` | — | Removed in Brief 27 after the translated loader remained unreferenced |
| `[projectId]/_components/project-activity-card.tsx` | `packages/module-projects/src/ui/project-activity-card.tsx` | Translated |
| `[projectId]/_components/project-detail-create-sheets/date-utils.ts` | `packages/module-projects/src/ui/project-detail-create-sheets/date-utils.ts` | Translated |
| `[projectId]/_components/project-detail-create-sheets/project-detail-create-sheets-mount.tsx` | `packages/module-projects/src/ui/project-detail-create-sheets/project-detail-create-sheets-mount.tsx` | Translated |
| `[projectId]/_components/project-detail-create-sheets/project-link-create-sheet.tsx` | `packages/module-projects/src/ui/project-detail-create-sheets/project-link-create-sheet.tsx` | Translated |
| `[projectId]/_components/project-detail-create-sheets/project-milestone-create-sheet.tsx` | `packages/module-projects/src/ui/project-detail-create-sheets/project-milestone-create-sheet.tsx` | Translated |
| `[projectId]/_components/project-detail-create-sheets/project-task-create-sheet.tsx` | `packages/module-projects/src/ui/project-detail-create-sheets/project-task-create-sheet.tsx` | Translated |
| `[projectId]/_components/project-detail-data-provider.test.ts` | `tests/module-projects-ui.test.ts` | Translated |
| `[projectId]/_components/project-detail-data-provider.tsx` | `packages/module-projects/src/ui/project-detail-data-provider.tsx` | Translated |
| `[projectId]/_components/project-detail-editable-cards.tsx` | `packages/module-projects/src/ui/project-detail-editable-cards.tsx` | Translated |
| `[projectId]/_components/project-detail-hero.tsx` | `packages/module-projects/src/ui/project-detail-hero.tsx` | Translated |
| `[projectId]/_components/project-detail-metadata-strip.tsx` | `packages/module-projects/src/ui/project-detail-metadata-strip.tsx` | Translated |
| `[projectId]/_components/project-detail-stats-strip.tsx` | — | Removed in Brief 27 after the translated strip remained unreferenced |
| `[projectId]/_components/project-detail-team-card.tsx` | `packages/module-projects/src/ui/project-detail-team-card.tsx` | Translated |
| `[projectId]/_components/project-edit-header-button.tsx` | `packages/module-projects/src/ui/project-edit-header-button.tsx` | Translated |
| `[projectId]/_components/project-edit-sheet.tsx` | `packages/module-projects/src/ui/project-edit-sheet.tsx` | Translated |
| `[projectId]/_components/project-lazy-panels.tsx` | `packages/module-projects/src/ui/project-lazy-panels.tsx` | Translated |
| `[projectId]/_components/project-links-card.tsx` | `packages/module-projects/src/ui/project-links-card.tsx` | Translated |
| `[projectId]/_components/project-members-edit-sheet.tsx` | `packages/module-projects/src/ui/project-members-edit-sheet.tsx` | Translated |
| `[projectId]/_components/project-milestone-task-lists.tsx` | `packages/module-projects/src/ui/project-milestone-task-lists.tsx` | Translated |
| `[projectId]/_components/project-recent-activity.tsx` | `packages/module-projects/src/ui/project-recent-activity.tsx` | Translated |
| `[projectId]/_components/project-status-quick-action.tsx` | `packages/module-projects/src/ui/project-status-quick-action.tsx` | Translated |
| `[projectId]/loading.tsx` | `packages/module-projects/src/ui/project-detail-loading.tsx` | Translated |
| `[projectId]/page.tsx` | `packages/module-projects/src/ui/project-detail-page.tsx` | Translated |
| `_components/create-project-sheet.tsx` | `packages/module-projects/src/ui/create-project-sheet.tsx` | Translated |
| `_components/create-project-task-sheet.tsx` | `packages/module-projects/src/ui/create-project-task-sheet.tsx` | Translated |
| `_components/hooks/use-projects-window-events.ts` | `packages/module-projects/src/ui/hooks/use-projects-window-events.ts` | Translated |
| `_components/project-create/shared-fields.tsx` | `packages/module-projects/src/ui/project-create/shared-fields.tsx` | Translated |
| `_components/project-create/use-organization-creation-state.ts` | `packages/module-projects/src/ui/project-create/use-organization-creation-state.ts` | Translated |
| `_components/project-create/use-project-form-state.ts` | `packages/module-projects/src/ui/project-create/use-project-form-state.ts` | Translated |
| `_components/project-create/use-project-setup-state.ts` | `packages/module-projects/src/ui/project-create/use-project-setup-state.ts` | Translated |
| `_components/project-link-url-utils.ts` | `packages/module-projects/src/ui/project-link-url-utils.ts` | Translated |
| `_components/project-state-badge.tsx` | `packages/module-projects/src/ui/project-state-badge.tsx` | Translated |
| `_components/project-ui-actions.ts` | `packages/module-projects/src/ui/project-ui-actions.ts` | Translated |
| `_components/projects-list-response-parser.ts` | `packages/module-projects/src/ui/projects-list-response-parser.ts` | Translated |
| `_components/projects-portfolio/index.tsx` | `packages/module-projects/src/ui/projects-portfolio/index.tsx` | Translated |
| `_components/projects-portfolio/projects-portfolio-list.tsx` | `packages/module-projects/src/ui/projects-portfolio/projects-portfolio-list.tsx` | Translated |
| `_components/projects-portfolio/projects-portfolio-modals.tsx` | `packages/module-projects/src/ui/projects-portfolio/projects-portfolio-modals.tsx` | Translated |
| `_components/projects-portfolio/projects-portfolio-pagination.tsx` | `packages/module-projects/src/ui/projects-portfolio/projects-portfolio-pagination.tsx` | Translated |
| `_components/projects-portfolio/projects-portfolio-root.tsx` | `packages/module-projects/src/ui/projects-portfolio/projects-portfolio-root.tsx` | Translated |
| `_components/projects-portfolio/projects-portfolio-stats.tsx` | `packages/module-projects/src/ui/projects-portfolio/projects-portfolio-stats.tsx` | Translated |
| `_components/projects-portfolio/types.ts` | `packages/module-projects/src/ui/projects-portfolio/types.ts` | Translated |
| `_components/projects-portfolio/use-projects-portfolio-bridge.ts` | `packages/module-projects/src/ui/projects-portfolio/use-projects-portfolio-bridge.ts` | Translated |
| `_components/projects-portfolio/use-projects-portfolio-controller.ts` | `packages/module-projects/src/ui/projects-portfolio/use-projects-portfolio-controller.ts` | Translated |
| `events.ts` | `packages/module-projects/src/ui/events.ts` | Translated |
| `loading.tsx` | `packages/module-projects/src/ui/projects-loading.tsx` | Translated |
| `page.tsx` | `packages/module-projects/src/ui/projects-page.tsx` | Translated |

## Required shared MQ dependencies

| MQ source (relative to portal) | Package destination | Status |
| --- | --- | --- |
| `components/projects/contact-action-buttons.tsx` | `packages/module-projects/src/ui/shared/contact-action-buttons.tsx` | Translated |
| `components/projects/member-initials-avatar.tsx` | `packages/module-projects/src/ui/shared/project-owner-avatar.tsx` | Normalized to the shared Projects avatar during the board/task parity pass |
| `components/projects/member-role-badge.tsx` | `packages/module-projects/src/ui/shared/member-role-badge.tsx` | Translated |
| `components/projects/project-overview-stat-card.tsx` | `packages/module-projects/src/ui/shared/project-overview-stat-card.tsx` | Translated |
| `components/projects/project-owner-avatar.tsx` | `packages/module-projects/src/ui/shared/project-owner-avatar.tsx` | Translated |
| `components/projects/project-pill.tsx` | `packages/module-projects/src/ui/shared/project-pill.tsx` | Translated |
| `components/projects/project-progress.tsx` | `packages/module-projects/src/ui/shared/project-progress.tsx` | Translated |
| `components/projects/project-risk.ts` | `packages/module-projects/src/ui/shared/project-risk.ts` | Translated |
| `components/projects/project-summary-card-skeleton.tsx` | `packages/module-projects/src/ui/shared/project-summary-card-skeleton.tsx` | Translated |
| `components/projects/project-summary-card.tsx` | `packages/module-projects/src/ui/shared/project-summary-card.tsx` | Translated |
| `components/projects/project-surface-card.tsx` | `packages/module-projects/src/ui/shared/project-surface-card.tsx` | Translated |
| `components/projects/section-feedback.tsx` | `packages/module-projects/src/ui/shared/section-feedback.tsx` | Translated |
| `components/projects/section-icon-button.tsx` | `packages/module-projects/src/ui/shared/section-icon-button.tsx` | Translated |
| `components/projects/task-tags.tsx` | `packages/module-projects/src/ui/shared/task-tags.tsx` | Translated |
| `components/app/app-sheet.tsx` | `packages/module-projects/src/ui/shared/app-sheet.tsx` | Translated |
| `components/app/sheet-section.ts` | `packages/module-projects/src/ui/shared/sheet-section.ts` | Translated |
| `components/app/portal-typography.ts` | `packages/module-projects/src/ui/shared/typography.ts` | Translated |
| `lib/projects/contact-links.ts` | `packages/module-projects/src/ui/shared/contact-links.ts` | Translated |
| `lib/projects/formatters.ts` | `packages/module-projects/src/ui/shared/formatters.ts` | Translated |
| `lib/roles/role-colors.ts` | `packages/module-projects/src/ui/shared/role-colors.ts` | Translated |
