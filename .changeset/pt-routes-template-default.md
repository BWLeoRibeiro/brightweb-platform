---
"create-bw-app": minor
---

Scaffold Portuguese project routes by default.

Portuguese is the ratified default locale and `module-projects` already
defaults to `/projetos`, but the template emitted the English preview variant:
`/projects/[id]/{board,tasks}` wired to `projectsPreviewModuleRegistration`.
Any pt-PT client had to rename the routes and swap the registration by hand —
in `config/shell.ts` and `config/modules.ts`, both of which
`create-bw-app update` regenerates, so the customization was lost on update.

Routes are now `/projetos/[projectId]/{quadro,tarefas}` with
`projectsModuleRegistration`, matching the package default and the toolbar
route matchers it already ships (which look for `/tarefas` and `/quadro`).

BREAKING for existing scaffolded apps: an app on the old English routes should
either keep them — `createProjectsModuleRegistration("/projects")` still
accepts a custom base href — or rename its route folders to match. Nothing in
the packages changed; this only affects newly scaffolded apps.
