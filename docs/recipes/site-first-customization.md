# Site First Customization

Use this recipe when you scaffold the standalone `site` template and want to make the first visible content and visual changes without overthinking the starter structure.

## When to use it

- You chose the `site` template
- You want to change the starter brand, copy, and CTAs immediately
- You want to adjust the visual language before adding your own sections or components

## Starting point

- A newly generated site app
- The generated `config/site.ts`, `app/page.tsx`, and `app/globals.css`

## Steps

1. Scaffold the site starter.

   ```bash
   pnpm dlx create-bw-app --template site
   ```

2. Install dependencies if you skipped install during scaffold time.
3. Run the app locally and open `/`.
4. Edit `config/site.ts` to change the site name, description, eyebrow, and CTA links.
5. Edit `app/page.tsx` to change the homepage sections, headlines, and supporting copy.
6. Edit `app/globals.css` to tune the starter colors, tokens, and typography.

## Validation checks

- The homepage renders locally without any environment setup.
- Changes in `config/site.ts` appear in the header, hero, and CTA surfaces.
- Changes in `app/page.tsx` change the actual page structure, not just the copy.
- Changes in `app/globals.css` update the visual system consistently across the page.

## What remains app-owned

- Additional sections and long-form landing page structure
- Form integrations, analytics, CMS connections, and deployment-specific wiring
- Any design system growth beyond the local starter primitives

## Related docs

- [Prerequisites](../foundations/prerequisites.md)
- [Project Structure](../foundations/project-structure.md)
- [Validate Your Starter](../foundations/validate-your-starter.md)
