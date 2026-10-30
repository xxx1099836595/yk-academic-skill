export const DEFAULT_API_BASE = "https://apisass.newacademic.net";
export let DEFAULT_API_KEY = "";
export const TRADITION_SEARCH_PATH = "/gateway/research/literature/v2/tradition/search";
export const FULLTEXT_PATH = "/gateway/GenerateDownloadAddress/";
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
  console.log(`YK 学术检索

用法：
  yk-academic-search search --query <text> [自然语言检索参数]
  yk-academic-search search --conditions '<json-array>' [结构化检索参数]
  yk-academic-search fulltext --filepath <path> [全文链接参数]

环境变量：
  YK_ACADEMIC_API_KEY    Authorization: Bearer <key> 使用的 API Key（必填）
  YK_ACADEMIC_API_BASE   可选的后端地址覆盖项

参数：
  --api-base <url>     后端地址，默认使用 YK_ACADEMIC_API_BASE 或 ${DEFAULT_API_BASE}
  --query <text>       自然语言检索内容
  --conditions <json>  结构化条件节点数组
  --size <number>      自然语言检索结果数量，默认 15，范围 1-50
  --database <name>    中文语种选择器，支持 chinese 或 zh，默认 chinese
  --start-year <year>  自然语言检索的起始年份，默认当前年份 - 5
  --end-year <year>    自然语言检索的结束年份，默认当前年份
  --page-index <n>     结构化检索页码，从 1 开始，默认 1
  --page-size <n>      结构化检索每页数量，范围 1-100，默认 20
  --sort-field <name>  排序字段：score、cited_count、publish_date 或 year
  --sort-order <name>  排序方向：asc 或 desc，默认 desc
  --filepath <path>    后端文件路径，用于生成全文链接
  --file-type <type>   文件类型：local、oss、book 或 dic，默认 local
  --day <number>       全文链接有效期，单位为天，默认 3
  --domain-type <n>    后端域类型，默认 1
  --title <text>       下载地址中使用的可选论文标题
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
  const body = await postJson(FULLTEXT_PATH, {
    Type: args.file_type,
    path: args.filepath,
    day: args.day,
    title: args.title,
    domain_type: args.domain_type
  }, parsed);

  if (body?.code !== 0) {
    throw new Error(`全文地址生成失败：${JSON.stringify(body)}`);
  }
  const downloadPath = body?.data?.download_path;
  if (!downloadPath) {
    throw new Error(`全文地址响应缺少 download_path：${JSON.stringify(body)}`);
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
    throw new Error("search 必须提供 --query 或 --conditions");
  }
  if (args.query && args.conditions) {
    throw new Error("--query 和 --conditions 不能同时使用");
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
    throw new Error("fulltext 必须提供 --filepath");
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
  if (database !== "chinese" && database !== "zh") {
    throw new Error("本 Skill 仅支持中文语种，请将 --database 设置为 chinese 或 zh。");
  }

  conditions.push({ action: "operation", operator: "and" });
  conditions.push({ action: "condition", exp: { field: "language", symbol: "==", value: "zh" } });

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
  const conditions = ensureChineseConditions(args.conditions || []);
  const body = await postJson(TRADITION_SEARCH_PATH, {
    pageIndex: args.page_index,
    pageSize: args.page_size,
    sort: { field: args.sort_field, order: args.sort_order },
    conditions
  }, parsed);
  return normalizeTraditionalResponse(body);
}

function ensureChineseConditions(conditions) {
  const languageConditions = [];
  collectLanguageConditions(conditions, languageConditions);

  for (const condition of languageConditions) {
    const expression = condition.exp;
    if (expression.symbol !== "==" || String(expression.value).toLowerCase() !== "zh") {
      throw new Error("本 Skill 仅支持中文语种，language 条件必须是 language == zh。");
    }
  }

  if (conditions.some((node) =>
    node?.action === "condition" &&
    node.exp?.field === "language" &&
    node.exp?.symbol === "==" &&
    String(node.exp.value).toLowerCase() === "zh"
  )) {
    return conditions;
  }

  const languageCondition = {
    action: "condition",
    exp: { field: "language", symbol: "==", value: "zh" }
  };
  if (conditions.length === 0) {
    return [languageCondition];
  }
  return [
    ...conditions,
    { action: "operation", operator: "and" },
    languageCondition
  ];
}

function collectLanguageConditions(nodes, result) {
  for (const node of nodes) {
    if (node?.action === "condition" && node.exp?.field === "language") {
      result.push(node);
    }
    if (node?.action === "bracket" && Array.isArray(node.conditions)) {
      collectLanguageConditions(node.conditions, result);
    }
  }
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
    throw new Error("page_index 必须大于等于 1");
  }
  if (args.page_size < 1 || args.page_size > 100) {
    throw new Error("page_size 必须在 1 到 100 之间");
  }
  if (!["score", "cited_count", "publish_date", "year"].includes(args.sort_field)) {
    throw new Error("sort_field 必须是 score、cited_count、publish_date 或 year");
  }
  if (!["asc", "desc"].includes(args.sort_order)) {
    throw new Error("sort_order 必须是 asc 或 desc");
  }
  if (!Array.isArray(args.conditions)) {
    throw new Error("conditions 必须是 JSON 数组");
  }
}

function numberOrDefault(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${value} 不是有效数字`);
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
