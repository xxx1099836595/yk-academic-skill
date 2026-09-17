import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

import {
  generateFullTextLink,
  searchLiterature
} from "../skills/yk-academic-search/scripts/api-client.mjs";

const SERVER_NAME = "yk-academic-search-mcp";
const SERVER_VERSION = "1.0.0";

const TOOL_DEFINITIONS = [
  {
    name: "literature_search",
    description:
      "Search academic literature. Use query for natural-language search, or conditions for structured field filters. Do not provide both.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural-language literature search text."
        },
        conditions: {
          type: "array",
          description:
            "Structured condition-node array. Use condition, operation, and bracket nodes.",
          items: { type: "object" }
        },
        size: {
          type: "integer",
          description: "Natural-language result count, 1-50. Default 15."
        },
        database: {
          type: "string",
          description: "Use chinese for Chinese results; other values use English."
        },
        start_year: {
          type: "integer",
          description: "Natural-language lower publication-year bound."
        },
        end_year: {
          type: "integer",
          description: "Natural-language upper publication-year bound."
        },
        page_index: {
          type: "integer",
          description: "Structured-search page number starting at 1. Default 1."
        },
        page_size: {
          type: "integer",
          description: "Structured-search page size, 1-100. Default 20."
        },
        sort_field: {
          type: "string",
          enum: ["score", "cited_count", "publish_date", "year"],
          description: "Structured-search sort field."
        },
        sort_order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "Structured-search sort order."
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "download_full_text",
    description:
      "Generate a full-text download URL from a backend file path returned by literature search.",
    inputSchema: {
      type: "object",
      properties: {
        filepath: {
          type: "string",
          description: "Backend local, OSS, book, or dic file path."
        },
        file_type: {
          type: "string",
          enum: ["local", "oss", "book", "dic"],
          description: "Backend file path type. Default local."
        },
        day: {
          type: "integer",
          description: "Download URL validity in days. Default 3."
        },
        domain_type: {
          type: "integer",
          description: "Backend domain type. Default 1."
        },
        title: {
          type: "string",
          description: "Optional paper title."
        }
      },
      required: ["filepath"],
      additionalProperties: false
    }
  }
];

export function listMcpTools() {
  return TOOL_DEFINITIONS;
}

export async function callMcpTool(name, argumentsObject = {}) {
  try {
    if (name === "literature_search") {
      const result = await searchLiterature(toSearchArgs(argumentsObject));
      return textResult(result);
    }
    if (name === "download_full_text") {
      const result = await generateFullTextLink(toFullTextArgs(argumentsObject));
      return textResult(result);
    }
    return errorResult(`Unknown tool: ${name}`);
  } catch (error) {
    return errorResult(error instanceof Error ? error.message : String(error));
  }
}

export async function startMcpServer() {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: { tools: {} },
      instructions:
        "提供学术文献检索和全文下载链接工具。服务通过 stdio 启动，不使用 Nacos；API Key 从 YK_ACADEMIC_API_KEY 环境变量读取。"
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: listMcpTools()
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return callMcpTool(request.params.name, request.params.arguments || {});
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function toSearchArgs(input) {
  return {
    query: input.query,
    conditions: input.conditions === undefined ? undefined : JSON.stringify(input.conditions),
    size: input.size,
    database: input.database,
    startYear: input.start_year,
    endYear: input.end_year,
    pageIndex: input.page_index,
    pageSize: input.page_size,
    sortField: input.sort_field,
    sortOrder: input.sort_order
  };
}

function toFullTextArgs(input) {
  return {
    filepath: input.filepath,
    fileType: input.file_type,
    day: input.day,
    domainType: input.domain_type,
    title: input.title
  };
}

function textResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ],
    isError: false
  };
}

function errorResult(message) {
  return {
    content: [{ type: "text", text: message }],
    isError: true
  };
}

if (process.argv[1] && process.argv[1].endsWith("mcp-server.mjs")) {
  startMcpServer().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
