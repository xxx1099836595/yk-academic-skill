#!/usr/bin/env node

import { parseArgs, printResult, searchLiterature } from "./api-client.mjs";

try {
  const parsed = parseArgs(process.argv.slice(2));
  const result = await searchLiterature(parsed);
  printResult(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
