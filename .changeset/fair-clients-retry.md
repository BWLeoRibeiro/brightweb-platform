---
"create-bw-app": patch
---

Retry explicit installation after a failed or incomplete update/upgrade even when package requirements are unchanged. Reuse a completed install only while package, lock, configuration/patch inputs and installed shared versions still match.

Validate monorepo migration writes under their Supabase owner directory while retaining symlink and traversal protection. Respect the npm registry environment when resolving upgrade versions, aligning metadata with the installation registry.

Use migration sources matching the requested package release when existing installed modules still contain the previous SQL bundle; refuse unavailable source versions before writing.

Order fresh SQL assemblies by authored timestamps, preserving dependency order on equal timestamps, so later Core indexes run after the Admin baseline they reference. Existing numbered SQL files are never reordered.

Recover interrupted migration appends only when the existing file matches the pending module/source and exact SQL hash. Conflicting or duplicate source files reject before further writes; appends refuse to overwrite a concurrently created file.

Refuse recovery across missing or reordered SQL sources and confine ancestor migration writes to the declared workspace. Preserve leading blank lines during exact-source recovery.


Preflight app-owned pnpm patch selectors against target shared package versions before any package, scaffold, manifest or SQL writes. Preserve incompatible patches and partial prior state; require a reviewed compatible app patch before installed retry.
