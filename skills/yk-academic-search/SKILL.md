---
name: yk-academic-search
description: 用户需要进行专业学术文献检索、筛选、比较或获取全文时使用，覆盖 OpenAlex、arXiv、PubMed、Web of Science（WoS）及中文数据库，支持字段筛选、布尔条件、被引次数、DOI/PMID、期刊约束和全文下载链接。
---

# YK 学术检索

使用本 Skill 中的 Node CLI 直接调用 YK 学术检索 API，提供面向科研人员的专业学术文献检索能力。

检索范围覆盖 OpenAlex、arXiv、PubMed、Web of Science（WoS）以及知网、万方、维普等中文数据库。Skill 支持自然语言检索、结构化字段条件、布尔组合、年份范围、被引次数排序、DOI/PMID 查询和全文链接生成。

默认 API 地址为 `https://apisass.newacademic.net`，检索接口为 `/gateway/research/literature/v2/tradition/search`。只有在部署地址不同的情况下，才通过 `YK_ACADEMIC_API_BASE` 或 `--api-base` 覆盖默认地址。

## 认证

API Key 优先从环境变量 `YK_ACADEMIC_API_KEY` 读取，因为生产环境会预先配置该变量。只有环境变量没有值时，才检查其他显式配置。CLI 使用以下请求头：

```text
Accept: */*
Accept-Encoding: gzip, deflate, br
Authorization: Bearer <key>
Content-Type: application/json
```

如果没有配置 Key，请先执行：

```text
请您先设置秘钥（YK_ACADEMIC_API_KEY）。

Windows PowerShell:
  $env:YK_ACADEMIC_API_KEY="你的秘钥"

Windows CMD:
  set YK_ACADEMIC_API_KEY=你的秘钥

Linux:
  export YK_ACADEMIC_API_KEY="你的秘钥"

macOS:
  export YK_ACADEMIC_API_KEY="你的秘钥"
```

配置完成后重新运行命令。PowerShell 或 CMD 中设置的环境变量只对当前终端及其子进程生效；Linux/macOS 可将 `export` 命令写入 `~/.bashrc` 或 `~/.zshrc`。

## 命令

直接运行已安装的命令 `yk-academic-search ...`。在 Skill 目录中调试时，可以使用 `node scripts/search.mjs ...` 或 `node scripts/fulltext-link.mjs ...`。

| 用户需求 | 命令 | 必填参数 |
|---|---|---|
| 按自然语言检索中文文献 | `yk-academic-search search` | `--query <text>` |
| 按字段、运算符、布尔条件和分页检索 | `yk-academic-search search` | `--conditions '<JSON array>'` |
| 根据后端文件路径生成全文下载地址 | `yk-academic-search fulltext` | `--filepath <path>` |

检索有两种互斥模式，不能同时提供 `--query` 和 `--conditions`。全文下载地址必须来自检索结果中的后端文件路径；用户电脑上的本地路径不会自动上传。

## 自然语言检索

示例：

```powershell
yk-academic-search search --query "近五年多模态大模型在医学影像中的应用" --size 15 --database chinese --start-year 2021 --end-year 2026
```

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---:|---|
| `--query` | 字符串 | 必填 | 自然语言检索内容。 |
| `--size` | 整数 | `15` | 返回数量，限制为 `1`-`50`。 |
| `--database` | 字符串 | `chinese` | 中文检索选择器，仅接受 `chinese` 或 `zh`，请求始终带有 `language == "zh"`。 |
| `--start-year` | 整数 | 当前年份 - 5 | 增加 `year >= start-year` 条件。 |
| `--end-year` | 整数 | 当前年份 | 增加 `year <= end-year` 条件。 |

CLI 会把自然语言查询转换为结构化条件，发送到 `/gateway/research/literature/v2/tradition/search`：

- 在 `title`、`keyword`、`abstract` 三个字段中匹配查询词，并使用括号形成 `OR` 分组：`((title == query) OR (keyword == query) OR (abstract == query))`。
- 增加发表年份范围：`year >= startYear AND year <= endYear`。
- 固定增加中文语种条件：`language == "zh"`。

请求体示例：

```json
{
  "pageIndex": 1,
  "pageSize": 15,
  "sort": { "field": "score", "order": "desc" },
  "conditions": [
    {
      "action": "bracket",
      "conditions": [
        { "action": "condition", "exp": { "field": "title", "symbol": "==", "value": "近五年多模态大模型在医学影像中的应用" } },
        { "action": "operation", "operator": "or" },
        { "action": "condition", "exp": { "field": "keyword", "symbol": "==", "value": "近五年多模态大模型在医学影像中的应用" } },
        { "action": "operation", "operator": "or" },
        { "action": "condition", "exp": { "field": "abstract", "symbol": "==", "value": "近五年多模态大模型在医学影像中的应用" } }
      ]
    },
    { "action": "operation", "operator": "and" },
    { "action": "condition", "exp": { "field": "year", "symbol": ">=", "value": 2021 } },
    { "action": "operation", "operator": "and" },
    { "action": "condition", "exp": { "field": "year", "symbol": "<=", "value": 2026 } },
    { "action": "operation", "operator": "and" },
    { "action": "condition", "exp": { "field": "language", "symbol": "==", "value": "zh" } }
  ]
}
```

自然语言检索固定使用 `pageIndex: 1` 和按相关性倒序排列。

## 结构化检索

示例：

```powershell
yk-academic-search search `
  --page-index 1 `
  --page-size 20 `
  --sort-field cited_count `
  --sort-order desc `
  --conditions '[{"action":"condition","exp":{"field":"keyword","symbol":"==","value":"多模态大模型"}},{"action":"operation","operator":"and"},{"action":"condition","exp":{"field":"year","symbol":">=","value":2023}},{"action":"operation","operator":"and"},{"action":"condition","exp":{"field":"cited_count","symbol":">=","value":5}}]'
```

后端接口：

```text
POST /gateway/research/literature/v2/tradition/search
```

```json
{
  "pageIndex": 1,
  "pageSize": 20,
  "sort": { "field": "cited_count", "order": "desc" },
  "conditions": [
    { "action": "condition", "exp": { "field": "keyword", "symbol": "==", "value": "多模态大模型" } },
    { "action": "operation", "operator": "and" },
    { "action": "condition", "exp": { "field": "year", "symbol": ">=", "value": 2023 } },
    { "action": "operation", "operator": "and" },
    { "action": "condition", "exp": { "field": "cited_count", "symbol": ">=", "value": 5 } },
    { "action": "operation", "operator": "and" },
    { "action": "condition", "exp": { "field": "language", "symbol": "==", "value": "zh" } }
  ]
}
```

| 参数 | 类型 | 默认值 | 有效值和说明 |
|---|---|---:|---|
| `--conditions` | JSON 数组 | 必填 | 条件节点数组；没有其他筛选条件时使用 `[]`。CLI 会自动追加中文条件。 |
| `--page-index` | 整数 | `1` | 页码，必须大于等于 `1`。 |
| `--page-size` | 整数 | `20` | 每页数量，限制为 `1`-`100`。 |
| `--sort-field` | 字符串 | `score` | `score`、`cited_count`、`publish_date` 或 `year`。 |
| `--sort-order` | 字符串 | `desc` | `asc` 或 `desc`。 |

结构化检索固定为中文。条件树中没有语种条件时，CLI 自动追加 `language == "zh"`；如果显式指定英文或其他语种条件，CLI 会拒绝请求。

## 条件语法

`conditions` 是 JSON 数组。单个条件节点示例：

```json
{
  "action": "condition",
  "exp": {
    "field": "keyword",
    "symbol": "==",
    "value": "多模态大模型"
  }
}
```

`operation` 只能放在两个表达式之间，运算符为 `and` 或 `or`：

```json
{ "action": "operation", "operator": "and" }
```

使用 `bracket` 表示分组。例如 `(LLM OR 大语言模型) AND year >= 2024`：

```json
[
  {
    "action": "bracket",
    "conditions": [
      { "action": "condition", "exp": { "field": "keyword", "symbol": "==", "value": "LLM" } },
      { "action": "operation", "operator": "or" },
      { "action": "condition", "exp": { "field": "keyword", "symbol": "==", "value": "大语言模型" } }
    ]
  },
  { "action": "operation", "operator": "and" },
  { "action": "condition", "exp": { "field": "year", "symbol": ">=", "value": 2024 } }
]
```

规则：

- 第一个表达式前和最后一个表达式后不能放 `operation`。
- `bracket.conditions` 使用相同的节点格式，并且支持嵌套。
- 数字字段使用数字值，布尔字段使用布尔值。
- 只能使用 [references/api.md](references/api.md) 中记录的字段和运算符。

## 全文下载链接

只有在检索结果提供后端 `filepath` 或等价文件路径后，才能生成全文下载链接：

```powershell
yk-academic-search fulltext `
  --filepath "ChineseJournal/Cnki/8b43cf569b3f9fb6a1b999d49da43447/2024/WXDG202412022.pdf" `
  --file-type local `
  --day 3 `
  --domain-type 1 `
  --title "论文标题"
```

CLI 调用：

```text
POST /gateway/GenerateDownloadAddress/
```

```json
{
  "Type": "local",
  "path": "ChineseJournal/Cnki/8b43cf569b3f9fb6a1b999d49da43447/2024/WXDG202412022.pdf",
  "day": 3,
  "title": "论文标题",
  "domain_type": 1
}
```

`--file-type` 支持 `local`、`oss`、`book` 和 `dic`。接口成功时必须返回 `data.download_path`；如果检索结果没有后端文件路径，不要自行编造路径或链接。

## 输出处理

结构化检索通常返回 `code`、`msg`、`data.total` 和 `data.list`。自然语言检索返回标准化后的结果数组。

CLI 会统一以下字段：

- `title`：从 `title`、`originalTitle`、`zhTitle` 或 `enTitle` 获取。
- `abstract`：从 `abstract`、`originalAbstract`、`zhAbstract` 或 `enAbstract` 获取。
- `keywords`：从 `keywords`、`originalKeywords`、`zhKeywords` 或 `enKeywords` 获取。
- `authors`：作者对象数组转换为作者姓名数组。
- `container_title`：从 `container.title` 获取。
- `cited_count`：从 `citedCount` 获取。
- `filepath`：从 `localAddress` 或 `pdf.downloadUrl` 获取。

输出前会删除后端原始或冗余字段：

```text
zhTitle, enAbstract, zhKeywords, citedDocs, zhAbstract, references, highLight, aiOverview, aiGuideReading, aiFixQuestion
```

自然语言检索还会将原始 `id` 复制为 `arxiv_id`，并把 `id` 替换为从 1 开始的结果序号。没有结果时返回 `[]`。

## 错误与配额

- 没有 `YK_ACADEMIC_API_KEY` 时，显示配置说明并停止请求。
- Key 无效时，提示配置有效的 `YK_ACADEMIC_API_KEY`。
- 每日检索配额耗尽时，停止继续请求并提示配额不足。
- 全文链接生成不计入检索次数，具体以服务端策略为准。
- HTTP 错误、JSON 解析错误或缺少 `download_path` 时，报告错误，不伪造结果或链接。

配额由 API 网关或后端统一控制，Skill 和 CLI 不维护本地配额计数。

完整字段和请求体说明请阅读 [references/api.md](references/api.md)。
