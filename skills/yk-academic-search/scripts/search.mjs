#!/usr/bin/env node

import { parseArgs, printResult, searchLiterature } from "./api-client.mjs";

const parsed = parseArgs(process.argv.slice(2));

try {
  const result = await searchLiterature(parsed);
  printResult(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
