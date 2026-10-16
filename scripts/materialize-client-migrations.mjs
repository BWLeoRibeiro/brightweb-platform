import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectMaterializedFiles, rootDir } from "./_db-modules.mjs";

function parseArgs(argv) {
  const args = {
    clientSlug: argv[2] ?? null,
    outputDir: null,
  };

  for (let index = 3; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--output-dir") {
      args.outputDir = argv[index + 1] ?? null;
      index += 1;
    }
  }

  return args;
}

export function prepareMaterializationDirectory(dirPath, expectedFiles) {
  const absolute = path.resolve(dirPath);
  let current = path.parse(absolute).root;
  for (const part of absolute.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) {
      if (error.code === "ENOENT") break;
      throw error;
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`Materialization output must use real directories: ${current}`);
    }
  }
  if (fs.existsSync(absolute) && fs.readdirSync(absolute).length > 0) {
    const unchanged = expectedFiles && Object.entries(expectedFiles).every(([relative, expected]) => {
      let file = absolute;
      for (const part of relative.split("/")) {
        file = path.join(file, part);
        try { if (fs.lstatSync(file).isSymbolicLink()) return false; } catch { return false; }
      }
      try {
        const actual = fs.readFileSync(file, "utf8");
        if (relative !== "manifest.json") return actual === expected;
        const oldManifest = JSON.parse(actual), newManifest = JSON.parse(expected);
        delete oldManifest.generatedAt;
        delete newManifest.generatedAt;
        return JSON.stringify(oldManifest) === JSON.stringify(newManifest);
      } catch { return false; }
    });
    if (unchanged) return false;
    throw new Error("Materialization output differs or is not generated; choose a new output directory. Existing files are never removed.");
  }
  fs.mkdirSync(absolute, { recursive: true });
  return true;
}

function createGeneratedSupabaseConfig(clientSlug) {
  return [
    `project_id = "${clientSlug}"`,
    "",
    "[db]",
    "major_version = 17",
    "",
    "[db.migrations]",
    "enabled = true",
    'schema_paths = []',
    "",
    "[db.seed]",
    "enabled = false",
    'sql_paths = []',
    "",
  ].join("\n");
}

function main() {
  const { clientSlug, outputDir } = parseArgs(process.argv);

  if (!clientSlug) {
    console.error("Usage: node scripts/materialize-client-migrations.mjs <client-slug> [--output-dir <path>]");
    process.exit(1);
  }

  console.warn(
    "[deprecated] db:materialize is a legacy Brightweb workspace compatibility step. " +
      "Generated projects now own database assembly and should use their scaffolded Supabase files directly.",
  );

  const plan = collectMaterializedFiles(clientSlug);
  const targetDir = path.resolve(outputDir ?? path.join(rootDir, "supabase", ".generated", clientSlug));
  const supabaseDir = path.join(targetDir, "supabase");
  const migrationsDir = path.join(supabaseDir, "migrations");

  const outputFiles = { "supabase/config.toml": createGeneratedSupabaseConfig(clientSlug) };

  const manifest = {
    client: plan.stack.client,
    moduleOrder: plan.moduleOrder,
    generatedAt: new Date().toISOString(),
    outputDir: targetDir,
    files: [],
  };

  for (const [index, file] of plan.files.entries()) {
    const sequence = String(index + 1).padStart(4, "0");
    const targetName = `${sequence}_${file.step.key}__${file.fileName}`;
    const destinationPath = path.join(migrationsDir, targetName);
    const sourceContents = fs.readFileSync(file.path, "utf8");
    const header = `-- source: ${file.relativePath}\n-- owner: ${file.step.type}:${file.step.key}\n\n`;
    outputFiles[path.relative(targetDir, destinationPath)] = `${header}${sourceContents}`;
    manifest.files.push({
      order: index + 1,
      module: file.step.key,
      source: file.relativePath,
      output: path.relative(targetDir, destinationPath),
    });
  }

  outputFiles["manifest.json"] = `${JSON.stringify(manifest, null, 2)}\n`;
  if (prepareMaterializationDirectory(targetDir, outputFiles)) {
    for (const [relative, content] of Object.entries(outputFiles)) {
      const destination = path.join(targetDir, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, content, { flag: "wx" });
    }
  }
  console.log(targetDir);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
