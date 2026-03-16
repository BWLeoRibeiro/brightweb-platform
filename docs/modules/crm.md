# CRM Module

The CRM module extends the platform with organizations, org membership, CRM contact data, status tracking, and invitation flows. It depends on the Admin layer because the current policies and staff and admin workflows assume RBAC is present.

## What schema it installs

- `organizations` for company-level records and primary contact linkage.
- `organization_members` for org membership and org-admin/member role control.
- `crm_contacts` for contact records linked to organizations and optionally profiles.
- `crm_status_log` for contact status history.
- `organization_invitations` for invitation flows, with later acceptance linkage.
- Later schema refinements such as address support, contact/profile linking, and generalized tax identifier fields on organizations.

## What package and domain logic it provides

- `@brightweblabs/module-crm` exports shell registration for CRM nav groups and toolbar routes.
- It also exports server-side CRM data helpers such as `getCrmDashboardData()`.
- The package reads from shared platform tables such as `profiles` and `user_role_assignments` in addition to CRM-owned tables.

## Whether it adds starter routes and wiring

| Area | Current behavior |
| --- | --- |
| Scaffold wiring | Selecting CRM adds the package dependency and enables CRM-related shell/config wiring in generated platform apps. |
| Starter routes | The current module template contributes the `/playground/crm` starter surface in the scaffold. |
| Shell behavior | The module registration adds CRM navigation groups and toolbar route definitions. |

> The CRM module does **not** install a full ready-made CRM frontend into a client app. It provides shared schema, policies, helper functions, and a light starter surface. Real client UI remains app-owned.

## Related docs

- [Modules](./README.md)
- [Projects](./projects.md)
- [UI vs Domain Modules](../ui-vs-domain-modules.md)

## Repo sources

- `supabase/modules/crm/migrations`
- `packages/module-crm/src/index.ts`
- `packages/module-crm/src/registration.ts`
- `packages/create-bw-app/template/modules/crm`
- `supabase/module-registry.json`
