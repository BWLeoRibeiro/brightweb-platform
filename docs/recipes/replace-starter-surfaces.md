# Extend Thin Package Mounts

Generated routes are package mounts, not starter pages to grow into product code.

## Add or replace a surface

1. Choose the package that owns the domain.
2. Implement the complete reusable page or handler there.
3. Export it from the package's public entrypoint and record the contract when required.
4. Keep the app route to a direct re-export, for example:

   ```tsx
   export { AdminUsersPage as default } from "@brightweblabs/module-admin";
   ```

5. Update module and shell settings, then run the template thinness test and app build.

Client-specific identity, enabled modules, shell overrides, theme tokens, environment values, brand assets, and migrations remain in the app. Feature UI, state, data access, and reusable helpers remain package-owned.

## Related docs

- [Using BrightWeb Modules](../modules/using-modules.md)
- [Project Structure](../foundations/project-structure.md)
- [Add Modules After Scaffold](./add-modules-after-scaffold.md)
