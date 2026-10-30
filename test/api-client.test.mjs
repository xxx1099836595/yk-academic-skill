import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_API_KEY,
  generateFullTextLink,
  parseArgs,
  printHelp,
  searchLiterature,
  setDefaultApiKey
} from "../skills/yk-academic-search/scripts/api-client.mjs";

const originalApiKey = process.env.YK_ACADEMIC_API_KEY;
const originalFetch = globalThis.fetch;
const originalDefaultApiKey = DEFAULT_API_KEY;

test.afterEach(() => {
  setDefaultApiKey(originalDefaultApiKey);
  if (originalApiKey === undefined) {
    delete process.env.YK_ACADEMIC_API_KEY;
  } else {
    process.env.YK_ACADEMIC_API_KEY = originalApiKey;
  }
  globalThis.fetch = originalFetch;
});

test("search stops locally with setup instructions when no API key is available", async () => {
  delete process.env.YK_ACADEMIC_API_KEY;
  setDefaultApiKey("");
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

test("search uses the configured fallback API key when YK_ACADEMIC_API_KEY is not set", async () => {
  delete process.env.YK_ACADEMIC_API_KEY;
  setDefaultApiKey("fallback-key");
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: 0, data: { total: 0, list: [] } })
    };
  };

  await searchLiterature({ conditions: "[]" });
  assert.equal(request.options.headers.authorization, "Bearer fallback-key");
  assert.equal(request.options.headers["accept"], "*/*");
  assert.equal(request.options.headers["accept-encoding"], "gzip, deflate, br");
});

test("full-text link generation requires an API key when default is not available", async () => {
  delete process.env.YK_ACADEMIC_API_KEY;
  setDefaultApiKey("");
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

  assert.equal(request.url, "http://example.test/gateway/research/literature/v2/tradition/search");
  assert.equal(request.options.headers.authorization, "Bearer test-key");
  assert.equal(request.options.headers["content-type"], "application/json");
  assert.equal(request.options.headers["accept"], "*/*");
  assert.equal(request.options.headers["accept-encoding"], "gzip, deflate, br");
  assert.deepEqual(JSON.parse(request.options.body), {
    pageIndex: 2,
    pageSize: 50,
    sort: { field: "cited_count", order: "asc" },
    conditions: [
      {
        action: "condition",
        exp: { field: "year", symbol: ">=", value: 2024 }
      },
      { action: "operation", operator: "and" },
      {
        action: "condition",
        exp: { field: "language", symbol: "==", value: "zh" }
      }
    ]
  });
});

test("natural language query is mapped to traditional search conditions", async () => {
  process.env.YK_ACADEMIC_API_KEY = "test-key";
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        code: 0,
        data: {
          total: 1,
          list: [
            {
              originalTitle: "测试标题",
              originalAbstract: "测试摘要",
              originalKeywords: ["测试"],
              authors: [{ name: "作者" }],
              container: { title: "期刊" }
            }
          ]
        }
      })
    };
  };

  const parsed = parseArgs([
    "search",
    "--query",
    "多模态大模型",
    "--size",
    "10",
    "--database",
    "chinese",
    "--start-year",
    "2022",
    "--end-year",
    "2025"
  ]);

  const result = await searchLiterature(parsed);
  assert.equal(request.url, "https://apisass.newacademic.net/gateway/research/literature/v2/tradition/search");
  assert.equal(Array.isArray(result), true);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "测试标题");
  assert.equal(result[0].abstract, "测试摘要");
  assert.deepEqual(result[0].keywords, ["测试"]);
  assert.deepEqual(result[0].authors, ["作者"]);
  assert.equal(result[0].container_title, "期刊");

  const body = JSON.parse(request.options.body);
  assert.equal(body.pageIndex, 1);
  assert.equal(body.pageSize, 10);
  assert.equal(body.sort.field, "score");
  assert.equal(body.sort.order, "desc");
  assert.equal(body.conditions.length, 7);
  assert.deepEqual(body.conditions.at(-1), {
    action: "condition",
    exp: { field: "language", symbol: "==", value: "zh" }
  });
});

test("structured search always adds the Chinese language condition", async () => {
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

  await searchLiterature({
    conditions: "[]",
    apiBase: "https://apisass.newacademic.net"
  });

  assert.equal(request.url, "https://apisass.newacademic.net/gateway/research/literature/v2/tradition/search");
  assert.deepEqual(JSON.parse(request.options.body).conditions, [
    {
      action: "condition",
      exp: { field: "language", symbol: "==", value: "zh" }
    }
  ]);
});

test("structured search rejects an English language condition", async () => {
  process.env.YK_ACADEMIC_API_KEY = "test-key";
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called for English-only search");
  };

  await assert.rejects(
    searchLiterature({
      conditions: JSON.stringify([
        {
          action: "condition",
          exp: { field: "language", symbol: "==", value: "en" }
        }
      ])
    }),
    /中文语种/
  );
  assert.equal(fetchCalls, 0);
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
