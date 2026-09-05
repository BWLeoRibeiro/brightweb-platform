import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { readAppManifest, readConfiguredModuleFlags } from "./app-manifest.mjs";

const HELP = `Usage: bw setup social-media [options]

Create an app-owned empty social media plan, page, and navigation.
Existing plan and page files are preserved. Requires installed marketing support.

Options:
  --target-dir <path>  App directory (defaults to cwd)
  --dry-run            Show changes without writing
  --help               Show this help`;
const PLAN_PATH = "config/social-media-plan.json";
const PAGE_PATH = "app/(shell)/marketing/social-media/page.tsx";
const SHELL_PATH = "config/shell.overrides.ts";
const ASSIGNMENT = "shellRegistrationOverrides.marketing = withSocialMediaNavigation(shellRegistrationOverrides.marketing);";
const IMPORT = 'import { withSocialMediaNavigation } from "@brightweblabs/module-marketing/registration";';
const PLAN = { title: "Social media", period: "", sections: [{ id: "calendario", title: "Calendário" }], types: {}, events: [] };
const PAGE = `import { SocialMediaPage } from "@brightweblabs/module-marketing/social-media";
import plan from "../../../../config/social-media-plan.json";

export default function Page() {
  return <SocialMediaPage plan={plan} />;
}
`;

// Generated paths must remain real directories/files inside the app, even when
// an intermediate directory or an existing target is a symlink.
async function inspectTarget(root, relativePath) {
  let current = root;
  const parts = relativePath.split("/");
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    let stat;
    try { stat = await fs.lstat(current); } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    if (stat.isSymbolicLink()) throw new Error(`Setup does not follow symlinks: ${relativePath}`);
    if (index < parts.length - 1 && !stat.isDirectory()) throw new Error(`Expected a directory at ${current}`);
    if (index === parts.length - 1 && !stat.isFile()) throw new Error(`Expected a file at ${relativePath}`);
  }
  return fs.readFile(current, "utf8");
}

function navigationSource(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  if (!/^export const shellRegistrationOverrides\s*:\s*ShellRegistrationOverrides\s*=\s*\{/m.test(code)) {
    throw new Error(`Cannot safely identify the standard exported const shellRegistrationOverrides: ShellRegistrationOverrides in ${SHELL_PATH}. Wire withSocialMediaNavigation manually before rerunning setup.`);
  }
  if (code.includes(ASSIGNMENT) && code.includes(IMPORT)) return source;
  if (/\bwithSocialMediaNavigation\b/.test(code)) {
    throw new Error(`Existing custom withSocialMediaNavigation wiring in ${SHELL_PATH}; use the documented import and assignment before rerunning setup.`);
  }
  return `${source}${source.endsWith("\n") ? "" : "\n"}\n${IMPORT}\n${ASSIGNMENT}\n`;
}

export async function setupBrightwebFeature(feature, options = {}, runtimeOptions = {}) {
  if (options.help) { process.stdout.write(`${HELP}\n`); return; }
  if (feature !== "social-media") throw new Error(`Unknown setup feature: ${feature || "(missing)"}\n${HELP}`);
  const targetDir = await fs.realpath(path.resolve(runtimeOptions.targetDir || options.targetDir || process.cwd()));
  const manifest = await readAppManifest(targetDir);
  const flags = await readConfiguredModuleFlags(targetDir);
  if (manifest.app.template !== "platform" || !manifest.modules.marketing || flags.marketing !== true) {
    throw new Error("Social media setup requires a platform app with marketing installed and enabled. Run bw add marketing first.");
  }
  try {
    const require = createRequire(path.join(targetDir, "package.json"));
    require.resolve("@brightweblabs/module-marketing/social-media");
    const registration = await fs.readFile(require.resolve("@brightweblabs/module-marketing/registration"), "utf8");
    if (!/export\s+(?:function|const)\s+withSocialMediaNavigation\b/.test(registration)) throw new Error("Missing navigation helper");
  } catch {
    throw new Error("Install or upgrade @brightweblabs/module-marketing to a release with social-media and withSocialMediaNavigation support, then rerun setup.");
  }
  const plan = await inspectTarget(targetDir, PLAN_PATH);
  const page = await inspectTarget(targetDir, PAGE_PATH);
  const shell = await inspectTarget(targetDir, SHELL_PATH);
  if (shell === null) throw new Error(`Missing ${SHELL_PATH}; restore the app-owned shell overrides file before setup.`);
  const nextShell = navigationSource(shell);
  const changes = [
    ...(plan === null ? [{ path: PLAN_PATH, content: `${JSON.stringify(PLAN, null, 2)}\n`, create: true }] : []),
    ...(page === null ? [{ path: PAGE_PATH, content: PAGE, create: true }] : []),
    ...(nextShell !== shell ? [{ path: SHELL_PATH, content: nextShell, create: false }] : []),
  ];
  for (const change of changes) {
    process.stdout.write(`${options.dryRun ? "Would " : ""}${change.create ? "Create" : "Update"} ${change.path}\n`);
  }
  if (!options.dryRun) for (const change of changes) {
    await fs.mkdir(path.dirname(path.join(targetDir, change.path)), { recursive: true });
    await fs.writeFile(path.join(targetDir, change.path), change.content, { flag: change.create ? "wx" : "w" });
  }
  process.stdout.write(changes.length ? "Social media setup ready. Content belongs to this app.\n" : "Social media is already configured; existing files preserved.\n");
  return { changes: changes.map(({ path: relativePath }) => relativePath), dryRun: !!options.dryRun };
}
