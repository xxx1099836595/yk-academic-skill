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
      "检索中文学术文献。自然语言检索使用 query，字段条件检索使用 conditions，不能同时提供两者。",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "自然语言学术文献检索内容。"
        },
        conditions: {
          type: "array",
          description:
            "结构化条件节点数组，使用 condition、operation 和 bracket 节点。",
          items: { type: "object" }
        },
        size: {
          type: "integer",
          description: "自然语言检索结果数量，范围 1-50，默认 15。"
        },
        database: {
          type: "string",
          enum: ["chinese", "zh"],
          description: "中文语种检索选择器，默认 chinese。"
        },
        start_year: {
          type: "integer",
          description: "自然语言检索的起始发表年份。"
        },
        end_year: {
          type: "integer",
          description: "自然语言检索的结束发表年份。"
        },
        page_index: {
          type: "integer",
          description: "结构化检索页码，从 1 开始，默认 1。"
        },
        page_size: {
          type: "integer",
          description: "结构化检索每页数量，范围 1-100，默认 20。"
        },
        sort_field: {
          type: "string",
          enum: ["score", "cited_count", "publish_date", "year"],
          description: "结构化检索排序字段。"
        },
        sort_order: {
          type: "string",
          enum: ["asc", "desc"],
          description: "结构化检索排序方向。"
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "download_full_text",
    description:
      "根据学术检索结果中的后端文件路径生成全文下载地址。",
    inputSchema: {
      type: "object",
      properties: {
        filepath: {
          type: "string",
          description: "后端本地、OSS、图书或词典文件路径。"
        },
        file_type: {
          type: "string",
          enum: ["local", "oss", "book", "dic"],
          description: "后端文件路径类型，默认 local。"
        },
        day: {
          type: "integer",
          description: "下载地址有效期，单位为天，默认 3。"
        },
        domain_type: {
          type: "integer",
          description: "后端域类型，默认 1。"
        },
        title: {
          type: "string",
          description: "可选论文标题。"
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
    return errorResult(`未知工具：${name}`);
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
