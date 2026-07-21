#!/usr/bin/env node

import { runBwCli } from "../src/bw.mjs";

runBwCli(process.argv.slice(2)).catch((error) => {
  console.error(`\nbw failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exitCode = 1;
});
