export const DEFAULT_API_BASE = "http://192.168.30.155:8099";
export let DEFAULT_API_KEY = "7RTKfyq9aScTNXPB0aoaBQbBFkLneZXkg2ZFPFIZ4KU";
export const TRADITION_SEARCH_PATH = "/research/literature/v2/tradition/search";
const DEFAULT_TIMEOUT_MS = 30_000;

export function setDefaultApiKey(key) {
  DEFAULT_API_KEY = key;
}

const OLD_INVALID_KEYS = new Set([
  "vydFzvTgorlp3irQY6vILh36koS2zbu8"
]);

const FIELDS_TO_REMOVE = new Set([
  "zhTitle",
  "enAbstract",
  "zhKeywords",
  "citedDocs",
  "zhAbstract",
  "references",
  "highLight",
  "aiOverview",
  "aiGuideReading",
  "aiFixQuestion"
]);

export function printHelp() {
  console.log(`yk-academic-search

Usage:
  yk-academic-search search --query <text> [query options]
  yk-academic-search search --conditions '<json-array>' [structured options]
  yk-academic-search fulltext --filepath <path> [full-text options]

Environment:
  YK_ACADEMIC_API_KEY    API key used for Authorization: Bearer <key> (default provided)
  YK_ACADEMIC_API_BASE   Optional backend base URL override

Options:
  --api-base <url>     Backend base URL. Defaults to YK_ACADEMIC_API_BASE or ${DEFAULT_API_BASE}
  --query <text>       Natural-language search text
  --conditions <json>  Structured condition node array
  --size <number>      Natural-language result count, default 15, range 1-50
  --database <name>    Natural-language database, chinese or english; default chinese
  --start-year <year>  Natural-language lower year bound; default current year - 5
  --end-year <year>    Natural-language upper year bound; default current year
  --page-index <n>     Structured page number starting at 1; default 1
  --page-size <n>      Structured page size, range 1-100; default 20
  --sort-field <name>  score, cited_count, publish_date, or year
  --sort-order <name>  asc or desc; default desc
  --filepath <path>    Backend local/OSS file path for full-text link generation
  --file-type <type>   local, oss, book, or dic; default local
  --day <number>       Full-text URL validity in days; default 3
  --domain-type <n>    Backend domain type; default 1
  --title <text>       Optional title embedded in the download URL
`);
}

export function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      result._.push(token);
      continue;
    }
    const key = toCamelCase(token.slice(2));
    if (key === "apiKey") {
      throw new Error("API Key 只能通过环境变量 YK_ACADEMIC_API_KEY 设置，请勿通过命令行参数传入。");
    }
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }
    result[key] = next;
    index += 1;
  }
  return result;
}

export async function searchLiterature(parsed) {
  const args = buildSearchArgs(parsed);
  if (args.query) {
    return querySearch(args, parsed);
  }
  return traditionalSearch(args, parsed);
}

export async function generateFullTextLink(parsed) {
  const args = buildFullTextArgs(parsed);
  const body = await postJson("/GenerateDownloadAddress/", {
    Type: args.file_type,
    path: args.filepath,
    day: args.day,
    title: args.title,
    domain_type: args.domain_type
  }, parsed);

  if (body?.code !== 0) {
    throw new Error(`GenerateDownloadAddress failed: ${JSON.stringify(body)}`);
  }
  const downloadPath = body?.data?.download_path;
  if (!downloadPath) {
    throw new Error(`GenerateDownloadAddress response missing download_path: ${JSON.stringify(body)}`);
  }
  return {
    success: true,
    download_path: downloadPath,
    filepath: args.filepath,
    file_type: args.file_type,
    day: args.day,
    domain_type: args.domain_type,
    title: args.title,
    expires_in_days: args.day
  };
}

export function printResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

export function buildSearchArgs(parsed) {
  const args = {};
  if (parsed.query) {
    args.query = String(parsed.query);
  }
  if (parsed.conditions) {
    args.conditions = JSON.parse(parsed.conditions);
  }
  if (!args.query && !args.conditions) {
    throw new Error("search requires --query or --conditions");
  }
  if (args.query && args.conditions) {
    throw new Error("--query and --conditions cannot be used together");
  }
  args.size = numberOrDefault(parsed.size, 15);
  args.database = String(parsed.database || "chinese");
  args.start_year = optionalNumber(parsed.startYear);
  args.end_year = optionalNumber(parsed.endYear);
  args.page_index = numberOrDefault(parsed.pageIndex, 1);
  args.page_size = numberOrDefault(parsed.pageSize, 20);
  args.sort_field = String(parsed.sortField || "score");
  args.sort_order = String(parsed.sortOrder || "desc");
  return args;
}

export function buildFullTextArgs(parsed) {
  if (!parsed.filepath) {
    throw new Error("fulltext requires --filepath");
  }
  return {
    filepath: String(parsed.filepath),
    file_type: String(parsed.fileType || "local"),
    day: numberOrDefault(parsed.day, 3),
    domain_type: numberOrDefault(parsed.domainType, 1),
    title: String(parsed.title || "")
  };
}

export function buildQueryConditions(args) {
  const conditions = [
    {
      action: "bracket",
      conditions: [
        { action: "condition", exp: { field: "title", symbol: "==", value: args.query } },
        { action: "operation", operator: "or" },
        { action: "condition", exp: { field: "keyword", symbol: "==", value: args.query } },
        { action: "operation", operator: "or" },
        { action: "condition", exp: { field: "abstract", symbol: "==", value: args.query } }
      ]
    }
  ];

  const now = new Date().getFullYear();
  const startYear = args.start_year ?? (now - 5);
  const endYear = args.end_year ?? now;

  if (startYear !== undefined) {
    conditions.push({ action: "operation", operator: "and" });
    conditions.push({ action: "condition", exp: { field: "year", symbol: ">=", value: startYear } });
  }

  if (endYear !== undefined) {
    conditions.push({ action: "operation", operator: "and" });
    conditions.push({ action: "condition", exp: { field: "year", symbol: "<=", value: endYear } });
  }

  const database = (args.database || "chinese").trim().toLowerCase();
  if (database === "chinese" || database === "zh") {
    conditions.push({ action: "operation", operator: "and" });
    conditions.push({ action: "condition", exp: { field: "language", symbol: "==", value: "zh" } });
  } else if (database === "english" || database === "en") {
    conditions.push({ action: "operation", operator: "and" });
    conditions.push({ action: "condition", exp: { field: "language", symbol: "==", value: "en" } });
  }

  return conditions;
}

async function querySearch(args, parsed) {
  const size = clamp(args.size, 1, 50);
  const conditions = buildQueryConditions(args);
  const body = await postJson(TRADITION_SEARCH_PATH, {
    pageIndex: args.page_index || 1,
    pageSize: size,
    sort: { field: args.sort_field || "score", order: args.sort_order || "desc" },
    conditions
  }, parsed);

  if (body?.code !== 0) {
    return { error: String(JSON.stringify(body)) };
  }
  return normalizeListResponse(body);
}

async function traditionalSearch(args, parsed) {
  validateTraditionalArgs(args);
  const body = await postJson(TRADITION_SEARCH_PATH, {
    pageIndex: args.page_index,
    pageSize: args.page_size,
    sort: { field: args.sort_field, order: args.sort_order },
    conditions: args.conditions || []
  }, parsed);
  return normalizeTraditionalResponse(body);
}

export function resolveUrl(base, path) {
  const normalizedBase = String(base).replace(/\/+$/, "");
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (normalizedBase.endsWith("/research") && normalizedPath.startsWith("/research/")) {
    normalizedPath = normalizedPath.slice("/research".length);
  }
  return `${normalizedBase}${normalizedPath}`;
}

async function postJson(path, payload, parsed = {}) {
  const base = String(parsed.apiBase || process.env.YK_ACADEMIC_API_BASE || DEFAULT_API_BASE);
  const url = resolveUrl(base, path);
  const apiKey = requireApiKey();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const headers = {
      "content-type": "application/json",
      "accept": "*/*",
      "accept-encoding": "gzip, deflate, br",
      "authorization": `Bearer ${apiKey}`
    };
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text}`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

export function requireApiKey(options = {}) {
  const envKey = process.env.YK_ACADEMIC_API_KEY;
  if (envKey !== undefined) {
    const trimmed = String(envKey).trim();
    if (trimmed && !OLD_INVALID_KEYS.has(trimmed)) {
      return trimmed;
    }
  }
  const fallback = options.defaultKey !== undefined ? options.defaultKey : DEFAULT_API_KEY;
  if (fallback) {
    return fallback;
  }
  throw new Error(`请您先设置秘钥（YK_ACADEMIC_API_KEY）。

Windows PowerShell:
  $env:YK_ACADEMIC_API_KEY="你的秘钥"

Windows CMD:
  set YK_ACADEMIC_API_KEY=你的秘钥

Linux:
  export YK_ACADEMIC_API_KEY="你的秘钥"

macOS:
  export YK_ACADEMIC_API_KEY="你的秘钥"

设置完成后，请重新打开终端或重新运行命令。`);
}

function normalizeItem(item) {
  if (!item || typeof item !== "object") {
    return;
  }
  item.title = item.title || item.originalTitle || item.zhTitle || item.enTitle || "";
  item.abstract = item.abstract || item.originalAbstract || item.zhAbstract || item.enAbstract || "";
  if (!item.keywords || (Array.isArray(item.keywords) && item.keywords.length === 0)) {
    item.keywords = item.originalKeywords || item.zhKeywords || item.enKeywords || [];
  }
  item.container_title = item.container_title || item.container?.title || "";
  item.cited_count = item.cited_count ?? item.citedCount ?? 0;
  item.filepath = item.filepath || item.localAddress || item.pdf?.downloadUrl || "";

  if (Array.isArray(item.authors) && item.authors[0] && typeof item.authors[0] === "object") {
    item.authors = item.authors.map((author) => author.name || author).filter(Boolean);
  }

  for (const field of FIELDS_TO_REMOVE) {
    delete item[field];
  }
}

function normalizeListResponse(body) {
  const resultList = body?.data?.list || [];
  if (!Array.isArray(resultList) || resultList.length === 0) {
    return [];
  }
  resultList.forEach((item, index) => {
    normalizeItem(item);
    item.arxiv_id = item.id;
    item.id = index + 1;
  });
  return resultList;
}

function normalizeTraditionalResponse(body) {
  const resultList = body?.data?.list;
  if (!Array.isArray(resultList)) {
    return body;
  }
  resultList.forEach((item) => {
    normalizeItem(item);
  });
  return body;
}

function validateTraditionalArgs(args) {
  if (args.page_index < 1) {
    throw new Error("page_index must be >= 1");
  }
  if (args.page_size < 1 || args.page_size > 100) {
    throw new Error("page_size must be between 1 and 100");
  }
  if (!["score", "cited_count", "publish_date", "year"].includes(args.sort_field)) {
    throw new Error("sort_field must be score, cited_count, publish_date, or year");
  }
  if (!["asc", "desc"].includes(args.sort_order)) {
    throw new Error("sort_order must be asc or desc");
  }
  if (!Array.isArray(args.conditions)) {
    throw new Error("conditions must be a JSON array");
  }
}

function numberOrDefault(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${value} is not a valid number`);
  }
  return parsed;
}

function optionalNumber(value) {
  if (value === undefined) {
    return undefined;
  }
  return numberOrDefault(value, undefined);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
