import test from "node:test";
import assert from "node:assert/strict";

import { generateFullTextLink, parseArgs, searchLiterature } from "../skills/yk-academic-search/scripts/api-client.mjs";

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
