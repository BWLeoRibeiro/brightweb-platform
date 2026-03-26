import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createBrightwebClientApp } from "../packages/create-bw-app/src/generator.mjs";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const templateRoot = path.join(repoRoot, "packages", "create-bw-app", "template");
const blockedTokenPattern = /\bprimaryHex\b/;

const textFileExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

async function collectFiles(directoryPath) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(absolutePath);
    }
    return [absolutePath];
  }));
  return files.flat();
}

function isTextTemplate(filePath) {
  return textFileExtensions.has(path.extname(filePath));
}

async function main() {
  const staticTemplateMatches = await scanDirectoryForBlockedToken(templateRoot, repoRoot);
  const generatedTemplateMatches = await scanGeneratedAppsForBlockedToken();
  const allMatches = [...staticTemplateMatches, ...generatedTemplateMatches];

  if (allMatches.length > 0) {
    throw new Error([
      "Found blocked token `primaryHex` in scaffold outputs.",
      "Move color/theme ownership to app/globals.css tokens.",
      ...allMatches.map((filePath) => `- ${filePath}`),
    ].join("\n"));
  }

  console.log("Template color ownership check passed.");
}

async function scanDirectoryForBlockedToken(rootPath, relativeToPath, labelPrefix = "") {
  const allFiles = await collectFiles(rootPath);
  const matchedFiles = [];

  for (const filePath of allFiles) {
    if (!isTextTemplate(filePath)) continue;
    const fileContents = await fs.readFile(filePath, "utf8");
    if (!blockedTokenPattern.test(fileContents)) continue;
    const relativePath = path.relative(relativeToPath, filePath);
    matchedFiles.push(labelPrefix ? `${labelPrefix}/${relativePath}` : relativePath);
  }

  return matchedFiles;
}

async function scanGeneratedAppsForBlockedToken() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bw-create-bw-app-template-check-"));
  const platformTarget = path.join(tempRoot, "generated-platform");
  const siteTarget = path.join(tempRoot, "generated-site");

  try {
    await createBrightwebClientApp(
      {
        name: "generated-platform",
        template: "platform",
        install: false,
        yes: true,
      },
      {
        banner: "Template contract check",
        dependencyMode: "published",
        targetDir: platformTarget,
      },
    );

    await createBrightwebClientApp(
      {
        name: "generated-site",
        template: "site",
        install: false,
        yes: true,
      },
      {
        banner: "Template contract check",
        dependencyMode: "published",
        targetDir: siteTarget,
      },
    );

    const platformMatches = await scanDirectoryForBlockedToken(platformTarget, platformTarget, "generated-platform");
    const siteMatches = await scanDirectoryForBlockedToken(siteTarget, siteTarget, "generated-site");
    return [...platformMatches, ...siteMatches];
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
