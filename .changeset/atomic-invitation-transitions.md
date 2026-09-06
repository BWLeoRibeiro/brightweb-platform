---
"@brightweblabs/module-admin": patch
"@brightweblabs/module-orgs": patch
"@brightweblabs/module-crm": patch
"create-bw-app": patch
---

Accept invitations through service-only, row-locked database transactions so access, CRM linkage, audit and invitation status commit together. Reuse acceptance during registration and retain identities after uncertain responses for safe retries. Report retained invitations accurately when delivery cleanup fails. New applications include the mirrored migrations; existing applications must apply the Admin/Orgs acceptance migrations and the CRM contact integration migration before using these acceptance handlers. Stock CRM callbacks are recognized through the shared integration contract; custom callbacks fail before mutation until deliberately migrated to a client-owned transactional hook and acknowledged with contactIntegration. Already accepted registration links never create identities or synchronize profile metadata.
