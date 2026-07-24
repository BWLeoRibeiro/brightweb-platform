# MQ translation ledger

This is the single entry point for the file-by-file MQ-to-BrightWeb translation records retained for release provenance.

| Brief | Area | Ledger |
| --- | --- | --- |
| 22 | Theme token inventory | [Brief 22 token inventory](./brief-22-token-inventory.md) |
| 23 | Projects primitives and shared components | [Brief 23 translation table](./brief-23-translation-table.md) |
| 26 | Aggregate dashboard | [Brief 26 dashboard translation table](./brief-26-dashboard-translation-table.md) |
| 28 | Authentication surfaces | [Brief 28 auth translation table](./brief-28-auth-translation-table.md) |
| 30 | Admin surfaces | [Brief 30 admin translation table](./brief-30-admin-translation-table.md) |
| 33 | Status pages | [Brief 33 status-pages translation](./brief-33-status-pages-translation.md) |
| 46 | Invitation and organization-write backend parity | [Brief 46 backend parity follow-through](#brief-46-backend-parity-follow-through) |

The source ledgers remain separate because they record brief-specific parity decisions and line references. Add future MQ translation records here so maintainers have one discoverable index.

## Brief 46 backend parity follow-through

The UI translations for invitation screens and Admin invitation management were already recorded in Briefs 28 and 30. The Tier 0 restoration completed their MQ-backed persistence paths and the CRM organization-save path:

| MQ capability | BrightWeb package implementation | Preview thin route/wiring | Status |
| --- | --- | --- | --- |
| Organization and admin invitation detail, invited-user registration, and signed-in organization acceptance | `packages/core-auth/src/invitations.ts` | `apps/platform-preview/app/api/invitations/[invitationId]/` | Ported |
| Admin/global invitation list, create, revoke, registration, email delivery, and activity logging | `packages/module-admin/src/invitations.ts`, `invite-email.ts`, `http.ts`, and `handlers.ts` | `apps/platform-preview/app/api/admin/users/invitations/` | Ported |
| Organization invitation list, create, revoke, registration, acceptance, email delivery, member creation, and activity logging | `packages/module-orgs/src/invitations.ts`, `invite-email.ts`, `http.ts`, and `handlers.ts` | `apps/platform-preview/app/api/organizations/[id]/invitations/` | Ported |
| Persistent organization create and update used by CRM organization sheets | `packages/module-orgs/src/data.ts`, `http.ts`, and `handlers.ts` | `apps/platform-preview/app/api/organizations/` and `[id]/route.ts` | Ported |

The preview files remain adapters: authentication/client dependencies are assembled in `apps/platform-preview/app/api/invitations/_dependencies.ts`, while business rules and database writes stay in the packages.
