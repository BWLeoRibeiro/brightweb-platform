# Website-owned social media plans

Each website owns its JSON plan and passes it to `SocialMediaPage` from
`@brightweblabs/module-marketing/social-media`. The package owns layouts, styles,
icons, generic Portuguese interface labels, and viewer interactions. It contains
no default client strategy, cadence, campaigns, publications, or targets.

`SocialMediaPlan` in `types.ts` defines the content contract. The page validates
incoming JSON with `parseSocialMediaPlan` after its staff/admin access check.
The parser is also exported for import-time or build-time checks. Invalid data
throws a field-path error without including client text.

- `title`, `period`, `sections`, `types`, and `events` are required. Empty events
  are allowed. `holidays` is an optional map of ISO dates to labels.
- `sections` controls navigation. `calendario` is required. `plano`, `campanhas`,
  and `metricas` must be paired with `editorial`, `campaigns`, and `measurement`
  respectively. Omit both navigation entry and content to omit a screen.
- `positioning` may appear within the editorial screen or in a `decisao` section.
  Its optional `rhythm` is used only by the standalone `decisao` screen.
- Editorial sub-sections, campaign launch, measurement baseline and references
  are optional. Omitted content does not introduce client-specific defaults.
- Publication types define a label, `medium` (`social` or `website`), and optional
  semantic `tone` (`primary`, `success`, `warning`, `info`, or `special`). `all`
  is reserved for the filter. Each publication must use a configured type and a
  unique nonempty ID, with a real `YYYY-MM-DD` date.
- `SocialMediaCopy` contains inline `{ text, emphasis? }` runs. All other text is
  plain text. Do not supply HTML nodes, CSS classes, or arbitrary layout settings.
- Icon names are semantic hints interpreted by the package. Unknown hints use a
  generic icon; they never resolve to arbitrary assets or executable content.
- Publication references are `[label, url]` pairs. Measurement sources use
  `{ label, href }`. Links must use HTTP or HTTPS.

Keep client text, dates, publishing cadence and channel choices in the website.
A future database can supply this same structure; no database or editing workflow
is required by the viewer. The former HTML-node plan shape must be migrated to
these named content fields before using the updated page.


## Opt-in setup

After installing compatible Marketing and CLI releases, run `bw setup social-media`
from a generated platform app (or pass `--target-dir`). Use `--dry-run` to inspect
changes first. The command creates an empty client-owned plan, its thin page mount,
and enables staff navigation through the app-owned shell override.

The command does not populate client strategy or publications. Existing plan and
page files are preserved; updates do not manage these files. Edit the local JSON
to add the client's content. Setup is explicit and is not activated when installing
Marketing alone.
