import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCreateBwAppCli } from "../packages/create-bw-app/src/cli.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

runCreateBwAppCli(process.argv.slice(2), {
  banner: "BrightWeb app installer",
  failurePrefix: "Installer failed",
  workspaceRoot: repoRoot,
  outputDir: path.join(repoRoot, "apps"),
  dependencyMode: "workspace",
}).catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`\nInstaller failed: ${message}`);
  process.exitCode = 1;
});
