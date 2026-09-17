import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { callMcpTool, listMcpTools } from "../bin/mcp-server.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const originalApiKey = process.env.YK_ACADEMIC_API_KEY;
const originalApiBase = process.env.YK_ACADEMIC_API_BASE;
const originalFetch = globalThis.fetch;

test.afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.YK_ACADEMIC_API_KEY;
  } else {
    process.env.YK_ACADEMIC_API_KEY = originalApiKey;
  }
  if (originalApiBase === undefined) {
    delete process.env.YK_ACADEMIC_API_BASE;
  } else {
    process.env.YK_ACADEMIC_API_BASE = originalApiBase;
  }
  globalThis.fetch = originalFetch;
});

test("MCP exposes only search and full-text tools", () => {
  assert.deepEqual(
    listMcpTools().map((tool) => tool.name).sort(),
    ["download_full_text", "literature_search"]
  );
});

test("package default npx command starts the MCP binary", () => {
  const packageJson = JSON.parse(
    readFileSync(resolve(__dirname, "../package.json"), "utf8")
  );

  assert.equal(packageJson.name, "yk-academic-search-mcp");
  assert.equal(
    packageJson.bin["yk-academic-search-mcp"],
    "./bin/yk-academic-search-mcp.mjs"
  );
});

test("MCP literature_search maps structured search to the backend without Nacos", async () => {
  process.env.YK_ACADEMIC_API_KEY = "test-key";
  process.env.YK_ACADEMIC_API_BASE = "http://example.test";
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: 0, data: { total: 1, list: [{ title: "paper" }] } })
    };
  };

  const result = await callMcpTool("literature_search", {
    conditions: [
      {
        action: "condition",
        exp: { field: "keyword", symbol: "==", value: "多模态大模型" }
      }
    ],
    page_index: 2,
    page_size: 10,
    sort_field: "cited_count",
    sort_order: "desc"
  });

  assert.equal(result.isError, false);
  assert.equal(request.url, "http://example.test/literature/v2/tradition/search");
  assert.equal(request.options.headers.authorization, "Bearer test-key");
  assert.deepEqual(JSON.parse(request.options.body), {
    pageIndex: 2,
    pageSize: 10,
    sort: { field: "cited_count", order: "desc" },
    conditions: [
      {
        action: "condition",
        exp: { field: "keyword", symbol: "==", value: "多模态大模型" }
      }
    ]
  });
});

test("MCP download_full_text returns the generated download path", async () => {
  process.env.YK_ACADEMIC_API_KEY = "test-key";
  process.env.YK_ACADEMIC_API_BASE = "http://example.test";
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: 0, data: { download_path: "http://download/link.pdf" } })
    };
  };

  const result = await callMcpTool("download_full_text", {
    filepath: "reading/pdf/article.pdf",
    file_type: "local",
    day: 3,
    domain_type: 1,
    title: "论文标题"
  });

  assert.equal(result.isError, false);
  assert.match(result.content[0].text, /http:\/\/download\/link\.pdf/);
  assert.equal(request.url, "http://example.test/GenerateDownloadAddress/");
  assert.deepEqual(JSON.parse(request.options.body), {
    Type: "local",
    path: "reading/pdf/article.pdf",
    day: 3,
    title: "论文标题",
    domain_type: 1
  });
});

test("MCP tool calls stop locally when the API key is missing", async () => {
  delete process.env.YK_ACADEMIC_API_KEY;
  delete process.env.YK_ACADEMIC_API_BASE;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called without an API key");
  };

  const result = await callMcpTool("literature_search", { query: "人工智能" });

  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /请您先设置秘钥/);
  assert.equal(fetchCalls, 0);
});
