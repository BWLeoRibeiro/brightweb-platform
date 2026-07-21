---
"@brightweblabs/module-crm": patch
"@brightweblabs/theme": patch
"create-bw-app": patch
---

Remove the CRM package's unused theme build dependency, trim unused theme CSS subpath exports while preserving the app-level CSS runtime contract, and retire the redundant CRM playground alias from new app scaffolds.
