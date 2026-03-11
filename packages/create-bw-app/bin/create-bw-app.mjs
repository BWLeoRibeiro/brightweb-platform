#!/usr/bin/env node

import { runCreateBwAppCli } from "../src/cli.mjs";

runCreateBwAppCli(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`\ncreate-bw-app failed: ${message}`);
  process.exitCode = 1;
});
