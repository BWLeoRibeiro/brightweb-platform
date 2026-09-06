# Customization boundaries

Keep application customizations in the existing app-owned files, and let generated integration consume them through supported package interfaces. Central ownership rules should protect those boundaries across CLI operations; moving every customization into one file is unnecessary.

## Where changes belong

| Customization | Application location | Platform integration |
| --- | --- | --- |
| Branding and logos | `config/brand.ts`, `public/brand/` | Generated shell and layout consume the brand configuration |
| Theme tokens and custom CSS | `app/theme.css` | Generated `app/globals.css` retains the app-theme import |
| Existing module navigation | `shellRegistrationOverrides` in `config/shell.overrides.ts` | Transforms package registrations |
| Additional application surfaces | `additionalShellModules` in the same overrides file, plus app routes | Adds navigation, toolbar metadata and dashboard contributions |
| Social Media content | `config/social-media-plan.json` | The app-owned page passes the plan to the package viewer |
| Social Media page composition | `app/(shell)/marketing/social-media/page.tsx` | Setup creates it once; existing content is preserved |
| Larger React composition changes | An explicitly owned tracked layout or mount | Continue consuming public package components and types |
| Client-only database behavior | Client forward migrations, outside shared module history | Shared SQL is authored once and checked against the CLI bundle |
| Customized invitation contact integration | Client migration defining `public.client_organization_invitation_contact_hook(uuid, uuid)` | Runs inside acceptance and direct membership transactions; the package never creates or replaces this client hook |

Generated files such as `config/shell.ts`, `config/modules.ts`, `config/module-toolbar-controls.tsx`, `next.config.ts`, `app/globals.css` and `docs/ai/app-context.json` are not general customization stores. Module selection belongs to the CLI lifecycle; styling belongs in the app theme. Custom toolbar React rendering currently has no separate renderer-map extension point, so do not assume editing its generated file survives updates.

## Tracked file ownership

Use `bw scaffold list` to inspect tracked files. For a deliberate fork of an existing tracked file, record `bw scaffold own <path>`. For an intentionally absent tracked file, use `bw scaffold skip <path>`. These decisions refer to exact paths, regardless of whether a command renders the path as configuration or a starter.

Returning a path with `bw scaffold manage <path>` compares it against the available template. It does not make customized bytes canonical or authorize their deletion. A recorded drift remains meaningful even if a historical command stored the same hash as the current file.

Historical manifests whose original baseline and drift information were already erased cannot always be reconstructed from their current hash. Review such files and mark deliberate forks owned before destructive lifecycle operations; do not assume a new CLI can recover missing history.

## Compatibility and remaining boundaries

Preserving a file is only one part of preserving a customization. Public package exports, component props, registration types, content validation and CSS precedence also need compatible behavior. Private package file paths are not stable extension points. Breaking extension contracts need an explicit migration path.

Removal scans surviving source files for literal imports of the package being removed and refuses before writing when it finds dependents. Reconcile those imports explicitly; owned content is never deleted to make removal succeed. This is a conservative static diagnostic, not a complete bundler or proof that computed imports and all application behavior remain compatible.

The CLI shares exact generated, app-owned seed and scaffold path declarations across its managed inventory and generated orientation JSON. Unknown paths default to app ownership; broad page/config globs do not grant generation authority. Explicit intent and live drift protect tracked files. Generated configuration remains generated unless an existing tracked ownership decision protects it. Keep app content out of the manifest and retain native TypeScript, React, CSS and JSON extension formats.

Lifecycle commands resolve the explicitly selected app root to its canonical directory, so a root alias is supported. Writable targets and their ancestors inside that root must be real files/directories, never symlinks. Preflight rejects linked, dangling and incorrectly typed targets before writes; migration outputs outside the selected app root are refused. This assumes no concurrent filesystem modification and is not an operating-system sandbox or race-proof guarantee.

See [CLI ownership commands](./bw-cli.md) and [CSS layer order](./css-layer-order.md) for the operational contracts.

Invitation acceptance and direct membership assignment have an explicit migration step for customized callbacks. Move that behavior into the client-owned transactional hook and opt in through the adapter; an unrecognized callback is rejected before mutation. See [invitation transactions](../modules/invitation-transactions.md) for the signature, privileges, upgrade order, and retry behavior.
