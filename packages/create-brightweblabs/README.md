# create-brightweblabs

Create a new BrightWeb app from either the platform or site starter.

## Local workspace usage

From the BrightWeb platform repo root:

```bash
pnpm create:client
pnpm create:client -- --template site
```

## Future published usage

Once this package is published to npm:

```bash
pnpm dlx create-brightweblabs
npm create brightweblabs@latest
```

## Template behavior

- prompts for app type: `platform` or `site`
- prompts for project name
- prompts for optional modules with a checkbox list when using the platform template
- prompts to install dependencies immediately
- copies a clean Next.js starter template
- platform apps include BrightWeb auth, shell, and optional business modules
- site apps include Next.js, Tailwind CSS, and local shadcn-style component primitives
- writes `package.json`, `next.config.ts`, `.gitignore`, and `README.md` for both templates
- platform apps also write `.env.example` and `.env.local`
- supports repo-local `workspace:*` wiring and future published dependency wiring
