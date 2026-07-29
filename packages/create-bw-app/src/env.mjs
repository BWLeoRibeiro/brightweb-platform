import fs from "node:fs/promises";
import path from "node:path";
import { pathExists } from "./generator.mjs";

function parseValue(rawValue) {
  const trimmed = rawValue.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}

export function parseDotEnv(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (!match) continue;
    values[match[1]] = parseValue(match[2]);
  }
  return values;
}

export async function loadAppEnvironment(targetDir, runtimeEnv = process.env) {
  const envPath = path.join(targetDir, ".env.local");
  const fileValues = await pathExists(envPath)
    ? parseDotEnv(await fs.readFile(envPath, "utf8"))
    : {};
  const runtimeValues = Object.fromEntries(
    Object.entries(runtimeEnv || {}).filter(([, value]) => typeof value === "string"),
  );
  return { ...fileValues, ...runtimeValues };
}

export function readFirstEnvironmentValue(environment, names) {
  for (const name of names) {
    const value = environment[name]?.trim();
    if (value) return value;
  }
  return null;
}
