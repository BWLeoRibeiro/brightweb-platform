import { HELP_TEXT } from "./constants.mjs";
import { createBrightwebClientApp } from "./generator.mjs";
import { updateBrightwebApp } from "./update.mjs";

function toCamelCase(flagName) {
  return flagName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function parseArgv(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--") {
      continue;
    }

    if (!token.startsWith("--")) continue;
    if (token === "--help") {
      options.help = true;
      continue;
    }

    if (token === "--install") {
      options.install = true;
      continue;
    }

    if (token === "--no-install") {
      options.install = false;
      continue;
    }

    if (token === "--yes") {
      options.yes = true;
      continue;
    }

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    const key = toCamelCase(rawKey);
    const nextValue = inlineValue ?? argv[index + 1];

    if (inlineValue == null) {
      index += 1;
    }

    options[key] = nextValue;
  }

  return options;
}

export async function runCreateBwAppCli(argv = process.argv.slice(2), runtimeOptions = {}) {
  const isUpdateCommand = argv[0] === "update";
  const argvOptions = parseArgv(isUpdateCommand ? argv.slice(1) : argv);

  if (argvOptions.help) {
    process.stdout.write(`${HELP_TEXT}\n`);
    return;
  }

  try {
    if (isUpdateCommand) {
      await updateBrightwebApp(argvOptions, runtimeOptions);
      return;
    }

    await createBrightwebClientApp(argvOptions, runtimeOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("User force closed the prompt with SIGINT")) {
      console.error("\nCancelled. Use Ctrl+C to exit an interactive prompt.\n");
      process.exitCode = 1;
      return;
    }
    console.error(`\n${runtimeOptions.failurePrefix || "create-bw-app failed"}: ${message}`);
    process.exitCode = 1;
  }
}
