#!/usr/bin/env node

import { runCreateBrightweblabsCli } from "../src/cli.mjs";

runCreateBrightweblabsCli(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`\ncreate-brightweblabs failed: ${message}`);
  process.exitCode = 1;
});
