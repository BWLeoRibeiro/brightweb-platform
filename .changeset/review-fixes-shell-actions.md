---
"@brightweblabs/app-shell": minor
"@brightweblabs/module-crm": patch
"@brightweblabs/module-projects": patch
"@brightweblabs/module-admin": patch
---

Toolbar actions now flow through a shell action registry (ShellActionsProvider / useShellAction) instead of fire-and-forget window events: header, breadcrumb, search, filter, and create controls stay disabled until the routed page has registered every handler they dispatch, so an interaction can never be silently swallowed (#84). Module action listeners migrated to the registry with a window-event compatibility bridge for shells without a provider; page-to-toolbar state sync events are unchanged. The CRM organization sheet also blocks re-submits while a save is in flight.
