---
"@brightweblabs/app-shell": patch
"@brightweblabs/module-marketing": patch
"@brightweblabs/module-crm": patch
"@brightweblabs/module-projects": patch
"@brightweblabs/ui": patch
---

Preserve newer campaign and workflow drafts when detail or save requests complete, serialize editor commands, and detach pending editor work when the client changes. Reload dashboard sections after a client replacement and reject old requests. Deduplicate pending notification dismissals so repeated callbacks do not send duplicate mutations. Keep clipboard feedback tied to the Social Media text actually copied. Remove unused private UI imports and bindings while retaining public props.
