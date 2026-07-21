# Site First Customization

The site template is a thin shell with no generated landing page or local UI library.

1. Set identity defaults in `config/site.ts`.
2. Adjust theme tokens in `app/globals.css`.
3. Implement the reusable site surface in an owning package.
4. Mount it from `app/page.tsx` with a direct package re-export.
5. Run the build and template thinness check.

Keep page sections, components, state, and helper libraries out of the scaffold layer.
