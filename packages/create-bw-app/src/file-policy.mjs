import { MODULE_STARTER_FILES, PLATFORM_STARTER_FILES } from "./constants.mjs";

export const MODULE_SELECTED_FILES = [
  "app/api/invitations/_dependencies.ts",
  "app/api/organizations/route.ts",
  "app/api/organizations/[id]/route.ts",
  "app/api/organizations/[id]/invitations/route.ts",
  "app/api/organizations/[id]/invitations/[invitationId]/route.ts",
  "app/api/organizations/[id]/members/[profileId]/route.ts",
];
export const MANAGED_PLATFORM_FILES = [
  "next.config.ts", "app/globals.css", "config/module-toolbar-controls.tsx",
  "config/modules.ts", "config/shell.ts", ...MODULE_SELECTED_FILES,
  "docs/ai/app-context.json",
];
export const MANAGED_SITE_FILES = ["docs/ai/app-context.json"];
export const APP_OWNED_FILES = [
  "config/brand.ts", "config/shell.overrides.ts", "app/theme.css", "app/fonts.ts",
  "config/social-media-plan.json", "app/(shell)/marketing/social-media/page.tsx",
  "public/brand/logo-mark.svg", "public/brand/logo-light.svg", "public/brand/logo-dark.svg",
  "docs/ai/README.md", "docs/ai/examples.md", "AGENTS.md", "README.md",
];
export function fileOwnership({ template = "platform", modules = [] } = {}) {
  const generated = template === "platform" ? MANAGED_PLATFORM_FILES : MANAGED_SITE_FILES;
  const appOwned = template === "platform" ? APP_OWNED_FILES : ["config/site.ts", "app/fonts.ts", "app/globals.css", "app/layout.tsx", "next.config.ts", "postcss.config.mjs", "tsconfig.json", "docs/ai/README.md", "docs/ai/examples.md", "AGENTS.md", "README.md"];
  const scaffold = template === "platform" ? [...new Set([...PLATFORM_STARTER_FILES, ...modules.flatMap((key) => MODULE_STARTER_FILES[key] || [])])].filter((p) => !generated.includes(p) && !appOwned.includes(p)) : [];
  return { default: "app-owned", appOwned: [...appOwned], scaffoldManaged: scaffold, generated: [...generated], precedence: ["explicit-intent-or-drift", "exact-path-policy", "recorded-scaffold", "app-owned-default"] };
}
export function isAppOwnedSeed(relativePath) { return APP_OWNED_FILES.includes(relativePath); }

/** Fail before writing when a renderer and its ownership policy disagree. */
export function assertGeneratedFileInventory(files, expectedPaths, label) {
  const actualPaths = Object.keys(files);
  const missing = expectedPaths.filter((relativePath) => !Object.hasOwn(files, relativePath));
  const unexpected = actualPaths.filter((relativePath) => !expectedPaths.includes(relativePath));
  if (missing.length || unexpected.length) {
    throw new Error(`${label} inventory mismatch: missing ${missing.join(", ") || "none"}; unexpected ${unexpected.join(", ") || "none"}.`);
  }
  return files;
}
