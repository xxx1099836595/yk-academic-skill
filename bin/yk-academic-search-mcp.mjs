#!/usr/bin/env node

import { startMcpServer } from "./mcp-server.mjs";

startMcpServer().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
