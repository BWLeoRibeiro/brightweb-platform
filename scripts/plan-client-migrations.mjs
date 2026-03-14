import { collectMaterializedFiles } from "./_db-modules.mjs";

function main() {
  const clientSlug = process.argv[2];

  if (!clientSlug) {
    console.error("Usage: node scripts/plan-client-migrations.mjs <client-slug>");
    process.exit(1);
  }

  const plan = collectMaterializedFiles(clientSlug);
  const output = {
    client: plan.stack.client,
    moduleOrder: plan.moduleOrder,
    steps: [...plan.steps],
    files: plan.files.map((file) => ({
      module: file.step.key,
      path: file.relativePath,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
