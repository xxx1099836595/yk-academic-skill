const DEFAULT_API_BASE = "http://192.168.45.252:8610";
const DEFAULT_TIMEOUT_MS = 30_000;
const FIELDS_TO_REMOVE = new Set([
  "zhTitle",
  "enAbstract",
  "zhKeywords",
  "citedDocs",
  "zhAbstract",
  "references",
  "highLight"
]);

export function printHelp() {
  console.log(`yk-academic-search

Usage:
  yk-academic-search search --query <text>
  yk-academic-search search --conditions '<json-array>' [--page-index 1] [--page-size 20]
  yk-academic-search fulltext --filepath <path> [--file-type local] [--day 3]

Environment:
  YK_ACADEMIC_API_KEY    Required API key used for Authorization: Bearer <key>
  YK_ACADEMIC_API_BASE   Optional backend base URL override

Options:
  --api-base <url>     Backend base URL. Defaults to YK_ACADEMIC_API_BASE or ${DEFAULT_API_BASE}
  --api-key <key>      One-off API key override. Prefer YK_ACADEMIC_API_KEY
  --query <text>       Natural-language search text
  --conditions <json>  Structured condition node array
  --sort-field <name>  score, cited_count, publish_date, or year
  --sort-order <name>  asc or desc
  --filepath <path>    Backend local/OSS file path for full-text link generation
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
    return intentionSearch(args, parsed);
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

async function intentionSearch(args, parsed) {
  const now = new Date().getFullYear();
  const startYear = args.start_year ?? now - 5;
  const endYear = args.end_year ?? now;
  const language = args.database.trim().toLowerCase() === "chinese" ? "zh" : "en";
  const size = clamp(args.size, 1, 50);
  const intention = await recognizeIntention(args.query, parsed);
  const body = await postJson("/literature/v2/intention/search", {
    text: args.query,
    intentionWords: intention,
    pageIndex: 1,
    pageSize: size,
    withJournal: false,
    sort: { field: "score", order: "desc" },
    conditions: [
      { action: "condition", exp: { field: "year", symbol: ">=", value: startYear } },
      { action: "operation", operator: "and" },
      { action: "condition", exp: { field: "year", symbol: "<=", value: endYear } },
      { action: "operation", operator: "and" },
      { action: "condition", exp: { field: "language", symbol: "==", value: language } }
    ]
  }, parsed);

  if (body?.code !== 0) {
    return { error: String(JSON.stringify(body)) };
  }
  return normalizeListResponse(body);
}

async function recognizeIntention(query, parsed) {
  const body = await postJson("/intention/recognize", { text: query }, parsed);
  if (body?.code !== 0) {
    throw new Error(`intention/recognize failed: ${JSON.stringify(body)}`);
  }
  return body.data;
}

async function traditionalSearch(args, parsed) {
  validateTraditionalArgs(args);
  const body = await postJson("/literature/v2/tradition/search", {
    pageIndex: args.page_index,
    pageSize: args.page_size,
    sort: { field: args.sort_field, order: args.sort_order },
    conditions: args.conditions || []
  }, parsed);
  return normalizeTraditionalResponse(body);
}

async function postJson(path, payload, parsed) {
  const base = String(parsed.apiBase || process.env.YK_ACADEMIC_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
  const apiKey = String(parsed.apiKey || process.env.YK_ACADEMIC_API_KEY || "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const headers = { "content-type": "application/json" };
    if (apiKey) {
      headers.authorization = `Bearer ${apiKey}`;
    }
    const response = await fetch(`${base}${path}`, {
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

function normalizeListResponse(body) {
  const resultList = body?.data?.list || [];
  if (!Array.isArray(resultList) || resultList.length === 0) {
    return [];
  }
  resultList.forEach((item, index) => {
    if (Array.isArray(item.authors) && item.authors[0] && typeof item.authors[0] === "object") {
      item.authors = item.authors.map((author) => author.name).filter(Boolean);
    }
    item.arxiv_id = item.id;
    item.id = index + 1;
    for (const field of FIELDS_TO_REMOVE) {
      delete item[field];
    }
  });
  return resultList;
}

function normalizeTraditionalResponse(body) {
  const resultList = body?.data?.list;
  if (!Array.isArray(resultList)) {
    return body;
  }
  resultList.forEach((item) => {
    if (!item || typeof item !== "object") {
      return;
    }
    for (const field of FIELDS_TO_REMOVE) {
      delete item[field];
    }
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
