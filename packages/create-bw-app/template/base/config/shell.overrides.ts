import type { ShellRegistrationOverrides } from "@brightweblabs/app-shell";

/**
 * App-owned shell customizations. This scaffolded file is never overwritten by
 * `create-bw-app update`.
 *
 * @example Rewrite a module href wherever it appears in its registration:
 * ```ts
 * import { overrideNavHref } from "@brightweblabs/app-shell";
 *
 * const overrides: ShellRegistrationOverrides = {
 *   crm: (registration) => overrideNavHref(registration, "/admin/marketing", "/crm/marketing"),
 * };
 * ```
 */
export const shellRegistrationOverrides: ShellRegistrationOverrides = {};
