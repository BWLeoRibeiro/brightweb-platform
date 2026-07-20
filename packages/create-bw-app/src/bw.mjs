import { addBrightwebModule } from "./add.mjs";
import { doctorBrightwebApp } from "./doctor.mjs";
import { updateBrightwebApp } from "./update.mjs";
import { upgradeBrightwebApp } from "./upgrade.mjs";

const HELP = `Usage: bw <command> [options]\n\nCommands:\n  add <moduleKey>       Install a module and its requirements\n  upgrade [moduleKey]   Upgrade packages, managed files, and migrations\n  update                Alias for the legacy create-bw-app update flow\n  doctor                Validate app health and manifest consistency\n\nRun bw <command> --help for command-specific options.`;

function parseOptions(argv) {
  const options = {};
  const positionals = [];
  const booleanFlags = new Set(["help", "dry-run", "strict", "report", "install", "refresh-starters", "allow-stale-fallback"]);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) { positionals.push(token); continue; }
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (booleanFlags.has(rawKey)) options[key] = true;
    else {
      const value = inlineValue ?? argv[index + 1];
      if (inlineValue == null) index += 1;
      options[key] = value;
    }
  }
  return { options, positionals };
}

export async function runBwCli(argv = process.argv.slice(2), runtimeOptions = {}) {
  const command = argv[0];
  if (!command || command === "--help" || command === "help") { process.stdout.write(`${HELP}\n`); return; }
  const { options, positionals } = parseOptions(argv.slice(1));
  try {
    if (command === "add") await addBrightwebModule(positionals[0], options, runtimeOptions);
    else if (command === "upgrade") await upgradeBrightwebApp(positionals[0], options, runtimeOptions);
    else if (command === "update") await updateBrightwebApp(options, runtimeOptions);
    else if (command === "doctor") {
      const result = await doctorBrightwebApp(options, runtimeOptions);
      if (!result.ok) process.exitCode = 1;
    } else throw new Error(`Unknown command: ${command}\n\n${HELP}`);
  } catch (error) {
    console.error(`\nbw failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exitCode = 1;
  }
}

export { HELP as BW_HELP };
