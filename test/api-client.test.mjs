import test from "node:test";
import assert from "node:assert/strict";

import {
  generateFullTextLink,
  parseArgs,
  printHelp,
  searchLiterature
} from "../skills/yk-academic-search/scripts/api-client.mjs";

const originalApiKey = process.env.YK_ACADEMIC_API_KEY;
const originalFetch = globalThis.fetch;

test.after(() => {
  if (originalApiKey === undefined) {
    delete process.env.YK_ACADEMIC_API_KEY;
  } else {
    process.env.YK_ACADEMIC_API_KEY = originalApiKey;
  }
  globalThis.fetch = originalFetch;
});

test("search stops locally with setup instructions when the API key is missing", async () => {
  delete process.env.YK_ACADEMIC_API_KEY;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called without an API key");
  };

  await assert.rejects(
    searchLiterature({ query: "人工智能" }),
    (error) => {
      assert.match(error.message, /请您先设置秘钥/);
      assert.match(error.message, /YK_ACADEMIC_API_KEY/);
      assert.match(error.message, /Windows PowerShell/);
      assert.match(error.message, /Linux/);
      assert.match(error.message, /macOS/);
      return true;
    }
  );
  assert.equal(fetchCalls, 0);
});

test("full-text link generation also requires the environment API key", async () => {
  delete process.env.YK_ACADEMIC_API_KEY;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called without an API key");
  };

  await assert.rejects(
    generateFullTextLink({ filepath: "paper.pdf" }),
    /请您先设置秘钥/
  );
  assert.equal(fetchCalls, 0);
});

test("command-line API keys are rejected", () => {
  assert.throws(
    () => parseArgs(["search", "--query", "人工智能", "--api-key", "11223344"]),
    /只能通过环境变量 YK_ACADEMIC_API_KEY 设置/
  );
});

test("all documented structured-search options are mapped to the backend payload", async () => {
  process.env.YK_ACADEMIC_API_KEY = "test-key";
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: 0, data: { total: 0, list: [] } })
    };
  };

  const parsed = parseArgs([
    "search",
    "--conditions",
    "[{\"action\":\"condition\",\"exp\":{\"field\":\"year\",\"symbol\":\">=\",\"value\":2024}}]",
    "--page-index",
    "2",
    "--page-size",
    "50",
    "--sort-field",
    "cited_count",
    "--sort-order",
    "asc",
    "--api-base",
    "http://example.test/"
  ]);

  await searchLiterature(parsed);

  assert.equal(request.url, "http://example.test/literature/v2/tradition/search");
  assert.equal(request.options.headers.authorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(request.options.body), {
    pageIndex: 2,
    pageSize: 50,
    sort: { field: "cited_count", order: "asc" },
    conditions: [
      {
        action: "condition",
        exp: { field: "year", symbol: ">=", value: 2024 }
      }
    ]
  });
});

test("help documents every CLI parameter group", () => {
  const output = [];
  const originalLog = console.log;
  console.log = (message) => output.push(message);
  try {
    printHelp();
  } finally {
    console.log = originalLog;
  }

  const help = output.join("\n");
  for (const option of [
    "--api-base",
    "--query",
    "--conditions",
    "--size",
    "--database",
    "--start-year",
    "--end-year",
    "--page-index",
    "--page-size",
    "--sort-field",
    "--sort-order",
    "--filepath",
    "--file-type",
    "--day",
    "--domain-type",
    "--title"
  ]) {
    assert.match(help, new RegExp(option.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
