---
"@brightweblabs/app-shell": minor
"create-bw-app": minor
---

Render every module-provided navigation group in the desktop sidebar, in registration order. Modules that own their own group, including Marketing, now appear in scaffolded apps instead of only the hardcoded CRM group being reachable.

The `DesktopSidebar` direct-call API is updated from CRM-specific props to `navGroups`, `isNavGroupExpanded`, `isNavGroupActive`, and `onToggleNavGroup`.
