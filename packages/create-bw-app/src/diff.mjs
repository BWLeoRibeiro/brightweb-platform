import fs from "node:fs/promises";
import path from "node:path";
import { stdout as output } from "node:process";
import { findWorkspaceRoot, readAppManifest } from "./app-manifest.mjs";
import { pathExists } from "./generator.mjs";
import { findTrackedTemplate, scaffoldDrift } from "./scaffold.mjs";

const HELP = `Usage: bw diff <relpath> [options]\n       bw diff --list [options]\n\nOptions:\n  --target-dir <path>       App directory (defaults to cwd)\n  --workspace-root <path>   BrightWeb workspace root\n  --list                    Print tracked scaffold drift status\n  --help                    Show this help`;

function splitLines(content) {
  const lines = content.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

export function unifiedLineDiff(beforeContent, afterContent, beforeName, afterName) {
  const before = splitLines(beforeContent);
  const after = splitLines(afterContent);
  const table = Array.from({ length: before.length + 1 }, () => new Uint32Array(after.length + 1));
  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      table[left][right] = before[left] === after[right]
        ? table[left + 1][right + 1] + 1
        : Math.max(table[left + 1][right], table[left][right + 1]);
    }
  }
  const body = [];
  let left = 0;
  let right = 0;
  while (left < before.length || right < after.length) {
    if (left < before.length && right < after.length && before[left] === after[right]) {
      body.push(` ${before[left]}`); left += 1; right += 1;
    } else if (right < after.length && (left === before.length || table[left][right + 1] >= table[left + 1][right])) {
      body.push(`+${after[right]}`); right += 1;
    } else {
      body.push(`-${before[left]}`); left += 1;
    }
  }
  return [
    `--- a/${beforeName}`,
    `+++ b/${afterName}`,
    `@@ -1,${before.length} +1,${after.length} @@`,
    ...body,
    "",
  ].join("\n");
}

export async function diffBrightwebScaffold(relativePath, argvOptions = {}, runtimeOptions = {}) {
  if (argvOptions.help) { output.write(`${HELP}\n`); return { help: true }; }
  const targetDir = path.resolve(runtimeOptions.targetDir || argvOptions.targetDir || process.cwd());
  const manifest = await readAppManifest(targetDir);
  if (argvOptions.list) {
    const drift = await scaffoldDrift(targetDir, manifest.scaffoldFiles);
    output.write("STATUS\tSCAFFOLD FILE\n");
    for (const status of ["current", "drifted", "missing"]) {
      for (const file of drift[status]) output.write(`${status}\t${file}\n`);
    }
    return { list: true, drift };
  }
  if (!relativePath) throw new Error("bw diff requires a tracked scaffold <relpath>, or pass --list.");
  const normalized = path.normalize(relativePath).replace(/^\.\//, "");
  if (path.isAbsolute(relativePath) || normalized.startsWith(`..${path.sep}`)) throw new Error(`Scaffold path must be relative to the app: ${relativePath}`);
  const workspaceRoot = runtimeOptions.workspaceRoot || argvOptions.workspaceRoot || await findWorkspaceRoot(targetDir);
  const located = await findTrackedTemplate({ relativePath: normalized, manifest, targetDir, workspaceRoot });
  if (!located.record) throw new Error(`${normalized} is not a tracked scaffold file.`);
  if (!located.templatePath) {
    const warning = `WARN Installed-package template unavailable for ${normalized}; diff is unsupported.`;
    output.write(`${warning}\n`);
    return { supported: false, warning };
  }
  const appPath = path.join(targetDir, normalized);
  const [templateContent, appContent] = await Promise.all([
    fs.readFile(located.templatePath, "utf8"),
    pathExists(appPath) ? fs.readFile(appPath, "utf8") : Promise.resolve(""),
  ]);
  if (templateContent === appContent) {
    output.write(`${normalized}: identical\n`);
    return { supported: true, identical: true, diff: "" };
  }
  const diff = unifiedLineDiff(templateContent, appContent, `template/${normalized}`, normalized);
  output.write(diff);
  return { supported: true, identical: false, diff };
}

export { HELP as DIFF_HELP };
