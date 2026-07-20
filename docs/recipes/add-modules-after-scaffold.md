# Add Modules After Scaffold

Use this recipe when you already have a generated `platform` app and need to add BrightWeb module wiring after the original scaffold step. `bw add` is the primary path for apps with `.brightweb/app-manifest.json`; keep the manual path below as a fallback for older apps.

## When to use it

- You already have a working platform app
- You now need CRM, Projects, or Admin starter wiring
- You want the public-safe way to port the scaffold differences without relying on private workspace runbooks

## Starting point

- An existing generated `platform` app
- A clear target module set such as `crm`, `projects`, or `admin`
- Willingness to compare the current app against a fresh scaffold reference

## Primary path

Preview and apply the module plan from the app root:

```bash
bw add projects --dry-run
bw add projects
pnpm install
```

The command resolves transitive requirements, pins dependencies, copies the module starter overlay, regenerates managed module and shell config, appends unapplied Supabase migrations, and updates the app manifest. Review the summary and apply the new Supabase migrations before using module-backed routes.

Pre-manifest apps are not changed automatically. Use the fallback below until the adoption workflow is available.

## Manual fallback

1. Generate a temporary reference app with the module set you want.

   ```bash
   pnpm dlx create-bw-app --name brightweb-reference --modules crm --no-install
   ```

2. Compare these files between your real app and the temporary reference app:
   - `package.json`
   - `next.config.ts`
   - `config/modules.ts`
   - `config/shell.ts`
3. Port the relevant dependency wiring, `transpilePackages`, module config, and shell registrations into your real app.
4. Copy or recreate the starter route files you actually want:
   - CRM: `app/playground/crm/page.tsx`
   - Projects: `app/playground/projects/page.tsx`
   - Admin: `app/playground/admin/page.tsx` and the admin API routes under `app/api/admin/users/`
5. Install the added dependencies and run the app locally.
6. Confirm the target client database includes the schema required by the enabled module set.
7. Validate the new starter routes, then delete the temporary reference app.

## Validation checks

- The new module package appears in `package.json`.
- The module package is added to `transpilePackages` in `next.config.ts`.
- The matching entry in `config/modules.ts` is enabled.
- The app shell exposes the expected module registration in `config/shell.ts`.
- The new starter route renders and matches the current connected or configuration-required behavior of a freshly scaffolded app.

## Dependency notes

- CRM builds on the `Core + Admin` platform baseline.
- Projects build on the CRM-backed database baseline even if you do not expose the CRM starter route in your app.
- Admin starter UI is optional, but the platform database baseline already includes the Admin layer.

<Callout title="Workspace mode note">
  <p>
    If you use a private BrightWeb workspace wrapper, you may also need to update your client stack planning flow.
    Keep that follow-up in your internal maintainer process; this public recipe stays focused on the generated app code.
  </p>
</Callout>

## What remains app-owned

- Product-specific page composition after the starter route proves the package wiring
- Client-specific workflows, forms, filters, and domain UX
- Any private database planning or deployment flow your team runs outside the public scaffold

## Related docs

- [The `bw` CLI](../foundations/bw-cli.md)
- [Modules](../modules/README.md)
- [Using BrightWeb Modules](../modules/using-modules.md)
- [Validate Your Starter](../foundations/validate-your-starter.md)
