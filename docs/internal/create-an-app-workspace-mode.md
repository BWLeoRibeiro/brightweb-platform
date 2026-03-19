# Workspace Mode and Database Alignment

This page covers BrightWeb workspace-specific scaffold behavior that should stay out of the public onboarding docs.

## What workspace mode changes

- The target workspace can add `apps/<slug>` instead of writing to `./<slug>`.
- Internal BrightWeb dependencies are written as `workspace:*`.
- The generator can create matching client stack files under `supabase/clients/<slug>`.
- It can also create a client-only migrations folder so the selected modules and database plan stay aligned.

## Database follow-up

Workspace mode still writes stack metadata, but database assembly belongs to each generated project. Use the generated Supabase files directly.

Legacy compatibility commands that may still appear in older workspace notes:

```bash
pnpm db:plan <slug>
pnpm db:materialize <slug>
```

`db:materialize` is deprecated and should not be treated as the normal flow for new projects.

## When to use this flow

- Use it when you are creating a client app inside the BrightWeb workspace.
- Use it when the selected app modules also need a matching client stack plan.
- Skip it for standalone published usage of `create-bw-app`.

## Related docs

- [Installation](../foundations/installation.md)
- [Project Structure](../foundations/project-structure.md)
- [Create BrightWebLabs CLI](./operations/create-bw-app-cli.md)
- [Database Flow](./architecture/database-flow.md)
- [Dependency Resolution](./architecture/dependency-resolution.md)

## Implementation references

- `packages/create-bw-app/src/generator.mjs`
- `supabase/README.md`
- `scripts/_db-modules.mjs`
