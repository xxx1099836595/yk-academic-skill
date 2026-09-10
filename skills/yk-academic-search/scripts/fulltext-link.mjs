#!/usr/bin/env node

import { generateFullTextLink, parseArgs, printResult } from "./api-client.mjs";

const parsed = parseArgs(process.argv.slice(2));

try {
  const result = await generateFullTextLink(parsed);
  printResult(result);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
