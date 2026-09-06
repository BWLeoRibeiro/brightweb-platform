---
"@brightweblabs/theme": patch
"@brightweblabs/core-auth": patch
"@brightweblabs/app-shell": patch
"@brightweblabs/module-admin": patch
"@brightweblabs/module-projects": patch
"@brightweblabs/module-marketing": patch
"create-bw-app": patch
---

Establish the same theme, base, components, utilities cascade order before every shared layered stylesheet and starter reset entry point. Independently emitted production CSS chunks can now load in any order without allowing the reset to erase authentication padding, heading typography, or calendar spacing. Existing component layers and client customization remain intact.
