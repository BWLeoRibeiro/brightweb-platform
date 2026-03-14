import fs from "node:fs";
import path from "node:path";
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

function ensureEmptyDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
  fs.mkdirSync(dirPath, { recursive: true });
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

  const plan = collectMaterializedFiles(clientSlug);
  const targetDir = path.resolve(outputDir ?? path.join(rootDir, "supabase", ".generated", clientSlug));
  const supabaseDir = path.join(targetDir, "supabase");
  const migrationsDir = path.join(supabaseDir, "migrations");

  ensureEmptyDir(targetDir);
  fs.mkdirSync(supabaseDir, { recursive: true });
  fs.mkdirSync(migrationsDir, { recursive: true });
  fs.writeFileSync(path.join(supabaseDir, "config.toml"), createGeneratedSupabaseConfig(clientSlug));

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
    fs.writeFileSync(destinationPath, `${header}${sourceContents}`);
    manifest.files.push({
      order: index + 1,
      module: file.step.key,
      source: file.relativePath,
      output: path.relative(targetDir, destinationPath),
    });
  }

  fs.writeFileSync(path.join(targetDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(targetDir);
}

main();
