# Shared CSS layer order

BrightWeb styles establish this order before any named layer or imported reset:

```css
@layer theme, base, components, utilities;
```

The browser fixes named layer precedence when it first encounters those layers.
A declaration in an application's global stylesheet cannot correct an order
already established by a component stylesheet loaded earlier. Production builds
can split styles across files, and direct loads, refreshes, and client navigation
can expose different stylesheet orders.

Every shared stylesheet that creates a named layer therefore carries the same
declaration at its beginning, including CSS Modules. The shared theme entry point
and generated application global styles also declare it before their imports.
The repetition is intentional and idempotent: whichever stylesheet arrives first
establishes the same precedence. Keeping the statement directly in each file avoids
depending on a separate import that a bundler could deduplicate or extract.

Reset rules remain in `base`; Social Media and other existing component rules
remain in `components`. Utilities retain higher normal-declaration precedence.
Existing additional layers, including marketing's `tokens` layer, remain intact.
No reset removal, `!important` override, or duplicated client component rules are
needed.

This contract controls precedence, not design values. Clients retain their theme
tokens and intentional component or utility overrides for spacing, typography,
and other styling. A client override must use its intended layer and specificity;
the reset should never accidentally erase shared component defaults.

`tests/css-layer-contract.test.ts` checks the source contract for package CSS and
starter entry points. Rendered production regression checks must additionally
verify heading size and weight, spacing, and calendar geometry through direct
loads, refreshes, and navigation; source checks alone cannot prove the bundled
styles behave correctly in a browser.
