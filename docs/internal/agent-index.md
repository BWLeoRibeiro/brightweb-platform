# Internal Agent Index

This page is a fast routing map for agents working inside the BrightWeb repository. It includes both the public docs surface and the internal-only docs subtree.

## Routing rules

- Start at [`../README.md`](../README.md) for the public docs overview.
- Start at [`./README.md`](./README.md) for internal-only documentation.
- Use this page when working on repo maintenance, internal release workflows, or security-adjacent operational tasks.
- Prefer editing the canonical target file, not this index, when changing guidance.

## Public docs shortcuts

| Path | Purpose | Tags | Audience | Visibility |
| --- | --- | --- | --- | --- |
| `docs/README.md` | Root docs index and docs-system policy. | docs-system, overview, policy | human, agent | public |
| `docs/foundations/installation.md` | App scaffolding commands and current entrypoints. | scaffolding, cli, onboarding | human, agent | public |
| `docs/modules/README.md` | Shared module overview and boundaries. | modules, ownership, crm, projects | human, agent | public |
| `docs/recipes/README.md` | Practical workflows and step-by-step examples. | recipes, workflows, examples | human, agent | public |

## Internal docs map

| Path | Purpose | Tags | Audience | Visibility |
| --- | --- | --- | --- | --- |
| `docs/internal/README.md` | Entry point for internal-only docs. | internal, overview, policy | maintainer, agent | internal |
| `docs/internal/architecture/README.md` | Entry point for architecture decisions and internal platform reference notes. | internal, architecture, reference | maintainer, agent | internal |
| `docs/internal/architecture/database-flow.md` | Client stack planning and materialization flow. | internal, database, migrations, materialization | maintainer, agent | internal |
| `docs/internal/architecture/dependency-resolution.md` | Module dependency graph and install order. | internal, dependencies, install-order, modules | maintainer, agent | internal |
| `docs/internal/create-an-app-workspace-mode.md` | Workspace-specific scaffold behavior and database alignment flow. | internal, scaffolding, workspace, database | maintainer, agent | internal |
| `docs/internal/project-structure-maintainer-notes.md` | Repo-internal implementation references behind the public project structure guide. | internal, scaffolding, templates, generator | maintainer, agent | internal |
| `docs/internal/operations/README.md` | Internal operations index. | internal, operations, index | maintainer, agent | internal |
| `docs/internal/operations/create-bw-app-cli.md` | Maintainer-facing CLI packaging and scaffold behavior reference. | internal, cli, packaging, scaffolding | maintainer, agent | internal |
| `docs/internal/operations/npm-publishing.md` | Maintainer-only npm publishing runbook. | internal, publishing, release | maintainer, agent | internal |

## Common retrieval hints

- If the task is public product/platform guidance, use the public docs tree first.
- If the task is release, publishing, or maintainer workflow, check `docs/internal/`.
- If the task requires a public answer, do not cite `docs/internal/` unless you intentionally want internal-only guidance.
