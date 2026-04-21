# Replace Starter Surfaces

Use this recipe when the generated starter routes have done their job and you are ready to replace them with app-owned product pages, handlers, and shell navigation.

## When to use it

- The generated starter already proves the BrightWeb packages are wired correctly
- You want to stop treating `/bootstrap`, `/preview/app-shell`, or `/playground/*` as long-lived product routes
- You need a clear path from starter helpers to longer-lived app-owned surfaces

## Starting point

- A working generated platform app
- Enough confidence that the current starter routes and environment are valid
- A plan for the product routes or workflows that will replace the starter experience

## Steps

1. Identify the starter surfaces you no longer want to keep:
   - `app/page.tsx`
   - `app/bootstrap/page.tsx`
   - `app/preview/app-shell/*`
   - `app/playground/*`
   - `app/api/admin/users/*` if you are moving away from the starter admin routes
   - `app/api/crm/*` if you are moving away from the starter CRM routes
2. Build the replacement pages or handlers first, while the starter routes still exist as a safety net.
3. Prefer the longer-lived public contracts from [Using BrightWeb Modules](../modules/using-modules.md) over starter-only page helpers when you design the replacement data flow.
4. Update the home page, bootstrap links, and shell navigation so the app points at your new routes instead of the starter validation paths.
5. Remove the starter routes only after the replacement pages are reachable and the app no longer depends on those links.

## Starter-to-product direction

| Starter surface | Treat it as | Better long-term direction |
| --- | --- | --- |
| `/bootstrap` and `config/bootstrap.ts` | A launch checklist for a new instance | Project-owned provisioning or admin flows once the client setup stabilizes |
| `/preview/app-shell` | A shell wiring preview | Your real app routes driven by the long-lived shell configuration |
| `/playground/auth` | Auth validation surface | Your own sign-in, callback, and account-management experience |
| `/playground/crm` with `getCrmDashboardData()` | Starter CRM page glue | App-owned CRM UI built on the stable CRM helpers, loading only the needed slices such as `listCrmContacts()`, `listCrmOrganizations()`, `getCrmContactStatusStats()`, `listCrmStatusTimeline()`, `listCrmPrimaryContacts()`, and `listCrmOwnerOptions()` |
| `/api/crm/contacts`, `/api/crm/organizations`, `/api/crm/stats`, `/api/crm/owners` | Starter CRM HTTP routes | App-owned routes or direct package mounting built on the stable CRM handlers |
| `/playground/projects` with `getProjectsPortfolioPageData()` | Starter portfolio glue | App-owned project pages built on `listProjects()`, `getProjectPortfolioStats()`, `getProjectDashboard()`, and the project mutation helpers |
| `/playground/admin` with `getAdminUsersPageData()` | Starter admin page glue | App-owned admin pages built on `listAdminUsers()` and the stable admin handlers |

## Validation checks

- The app homepage no longer points at routes you intend to retire.
- The shell navigation exposes your real product routes where appropriate.
- Any removed starter route no longer has a remaining link, redirect, or config reference.
- The replacement pages still use supported BrightWeb package contracts instead of internal-only helpers.

## What remains app-owned

- All final product UX, information architecture, and role-based flows
- The decision about which starter surfaces stay as internal-only validation routes
- The long-lived UI that sits on top of the shared schema and server helpers

## Related docs

- [Using BrightWeb Modules](../modules/using-modules.md)
- [Project Structure](../foundations/project-structure.md)
- [Add Modules After Scaffold](./add-modules-after-scaffold.md)
