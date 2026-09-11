#!/usr/bin/env node

import {
  generateFullTextLink,
  parseArgs,
  printHelp,
  printResult,
  searchLiterature
} from "../skills/yk-academic-search/scripts/api-client.mjs";

try {
  const parsed = parseArgs(process.argv.slice(2));
  const command = parsed._[0];

  if (!command || parsed.help || parsed.h) {
    printHelp();
    process.exit(0);
  }

  if (command === "search") {
    const result = await searchLiterature(parsed);
    printResult(result);
  } else if (command === "fulltext") {
    const result = await generateFullTextLink(parsed);
    printResult(result);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
