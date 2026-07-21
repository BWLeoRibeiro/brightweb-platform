import path from "node:path";
import { stdout as output } from "node:process";
import { findWorkspaceRoot, hashFile, readAppManifest, writeAppManifest } from "./app-manifest.mjs";
import { pathExists } from "./generator.mjs";
import { findTrackedTemplate, scaffoldDrift } from "./scaffold.mjs";

const HELP = `Usage: bw scaffold <action> [paths...] [options]\n\nActions:\n  list                List tracked files, live status, and intent\n  own <path>...       Mark existing tracked files as app-owned\n  skip <path>...      Mark missing tracked files as intentionally absent\n  manage <path>...    Return tracked files to BrightWeb management\n\nOptions:\n  --target-dir <path>       App directory (defaults to cwd)\n  --workspace-root <path>   BrightWeb workspace root\n  --help                    Show this help`;

function normalizeTrackedPath(relativePath) {
  const normalized = path.normalize(String(relativePath)).replace(/^\.\//, "");
  if (path.isAbsolute(String(relativePath)) || normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    throw new Error(`Scaffold path must be relative to the app: ${relativePath}`);
  }
  return normalized;
}

export async function scaffoldBrightwebApp(action, paths = [], argvOptions = {}, runtimeOptions = {}) {
  if (argvOptions.help || !action) { output.write(`${HELP}\n`); return { help: true }; }
  if (!Array.isArray(paths)) paths = [paths];
  if (!["list", "own", "skip", "manage"].includes(action)) throw new Error(`Unknown bw scaffold action: ${action}\n\n${HELP}`);
  if (action !== "list" && paths.length === 0) throw new Error(`bw scaffold ${action} requires at least one tracked <path>.`);
  if (action === "list" && paths.length > 0) throw new Error("bw scaffold list does not accept file paths.");

  const targetDir = path.resolve(runtimeOptions.targetDir || argvOptions.targetDir || process.cwd());
  const manifest = await readAppManifest(targetDir);
  const live = await scaffoldDrift(targetDir, manifest.scaffoldFiles);
  if (action === "list") {
    output.write("PATH\tMODULE\tSTATUS\tINTENT\n");
    for (const entry of live.entries) output.write(`${entry.relativePath}\t${entry.module}\t${entry.status}\t${entry.intent}\n`);
    return { action, entries: live.entries };
  }

  const normalizedPaths = Array.from(new Set(paths.map(normalizeTrackedPath)));
  for (const relativePath of normalizedPaths) {
    if (!manifest.scaffoldFiles?.[relativePath]) throw new Error(`${relativePath} is not a tracked scaffold file.`);
  }
  const liveByPath = new Map(live.entries.map((entry) => [entry.relativePath, entry]));
  for (const relativePath of normalizedPaths) {
    const status = liveByPath.get(relativePath)?.status;
    if (action === "own" && status === "missing") throw new Error(`Cannot own missing scaffold file: ${relativePath}`);
    if (action === "skip" && status !== "missing") throw new Error(`Cannot skip existing scaffold file: ${relativePath}`);
  }

  const workspaceRoot = runtimeOptions.workspaceRoot || argvOptions.workspaceRoot || await findWorkspaceRoot(targetDir);
  const changes = [];
  for (const relativePath of normalizedPaths) {
    const record = manifest.scaffoldFiles[relativePath];
    const previousIntent = record.intent || "managed";
    const nextIntent = action === "manage" ? "managed" : action === "own" ? "owned" : "skipped";
    const appPath = path.join(targetDir, relativePath);
    const exists = await pathExists(appPath);
    if (action === "manage") {
      const located = await findTrackedTemplate({ relativePath, manifest, targetDir, workspaceRoot });
      if (!located.templatePath) throw new Error(`Installed-package template unavailable for ${relativePath}; cannot manage it safely.`);
      const templateHash = await hashFile(located.templatePath);
      if (exists) {
        record.hash = await hashFile(appPath);
        record.status = record.hash === templateHash ? "current" : "drifted";
      } else {
        record.status = "missing";
      }
    } else {
      record.status = liveByPath.get(relativePath).status;
    }
    if (nextIntent === "managed") delete record.intent;
    else record.intent = nextIntent;
    changes.push({ relativePath, previousIntent, intent: nextIntent, status: record.status });
  }
  await writeAppManifest(targetDir, manifest);
  for (const change of changes) output.write(`${change.relativePath}: intent ${change.previousIntent} -> ${change.intent} (${change.status})\n`);
  return { action, changes, manifest };
}

export { HELP as SCAFFOLD_HELP };
