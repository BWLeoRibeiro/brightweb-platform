# Agent Examples

## Change site identity

- Edit `config/site.ts`.
- Adjust theme tokens in `app/globals.css` if needed.
- Run the build.

## Mount a site surface

- Export the complete surface from a package.
- Add `app/page.tsx` as a direct package re-export.
- Keep feature code and reusable components out of the app scaffold.
