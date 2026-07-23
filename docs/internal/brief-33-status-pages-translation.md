# Brief 33 — status-page translation

The MQ repository was read only during this translation.

| MQ source | BrightWeb package target | Translation |
| --- | --- | --- |
| `apps/portal/app/not-found.tsx` | `packages/app-shell/src/status-pages/not-found-page.tsx` | Literal 404 label, heading with accent dot, description, spacing, and home action; the app-owned `MarketingPageShell` is replaced by a neutral package frame with an optional logo slot. |
| `apps/portal/app/(app)/error.tsx` | `packages/app-shell/src/status-pages/error-page.tsx` | Literal error label, heading with accent dot, description, retry reset callback, outline home action, and error logging effect. |

All Portuguese copy is owned by
`defaultAppShellStatusPagesDictionary` in
`packages/app-shell/src/status-pages/dictionary.ts`.

The MQ global typography classes `.heading-2`, `.paragraph`, and `.label` and
their missing `--type-*` tokens were added to
`packages/theme/themes/mq-aliases.css` and `packages/theme/src/tokens.css`.
Platform Preview mounts the package through thin `app/not-found.tsx` and
`app/error.tsx` re-exports.
