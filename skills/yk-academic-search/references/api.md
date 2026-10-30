# YK 学术检索 API 参考

本文档说明 Node CLI 直接调用的 HTTP 接口，以及 CLI 参数到 API 请求体的完整映射。Skill 不调用 MCP、Nacos 或服务发现。

## 连接与认证

默认 API 地址：

```text
https://apisass.newacademic.net
```

CLI 按以下优先级选择 API 地址：

1. `--api-base <url>`
2. `YK_ACADEMIC_API_BASE`
3. `https://apisass.newacademic.net`

API Key 通过 `YK_ACADEMIC_API_KEY` 环境变量提供，仓库不内置生产 Key。

CLI 发送以下请求头：

```text
Accept: */*
Accept-Encoding: gzip, deflate, br
Authorization: Bearer <key>
Content-Type: application/json
```

配置 Key：

```powershell
# Windows PowerShell
$env:YK_ACADEMIC_API_KEY="你的秘钥"
```

```cmd
:: Windows CMD
set YK_ACADEMIC_API_KEY=你的秘钥
```

```bash
# Linux
export YK_ACADEMIC_API_KEY="你的秘钥"

# macOS
export YK_ACADEMIC_API_KEY="你的秘钥"
```

CLI 没有 `--api-key` 参数。缺少 Key 时，CLI 显示配置说明并停止网络请求。

## CLI 概览

```text
yk-academic-search search --query <text> [--size 15] [--database chinese] [--start-year 2021] [--end-year 2026]
yk-academic-search search --conditions '<JSON array>' [--page-index 1] [--page-size 20] [--sort-field score] [--sort-order desc]
yk-academic-search fulltext --filepath <path> [--file-type local] [--day 3] [--domain-type 1] [--title <text>]
```

检索模式互斥：`--query` 用于自然语言检索，`--conditions` 用于显式条件树。整个 Skill 固定检索中文文献。

## 自然语言检索

### CLI 调用

```powershell
yk-academic-search search `
  --query "近五年多模态大模型在医学影像中的应用" `
  --size 15 `
  --database chinese `
  --start-year 2021 `
  --end-year 2026
```

| CLI 参数 | 类型 | 默认值 | 校验和映射 |
|---|---|---:|---|
| `--query` | 字符串 | 必填 | 作为检索词生成字段条件。 |
| `--size` | 整数 | `15` | 限制在 `1`-`50`，映射为 `pageSize`。 |
| `--database` | 字符串 | `chinese` | 只接受 `chinese` 或 `zh`，固定映射为 `language == "zh"`。 |
| `--start-year` | 整数 | 当前年份 - 5 | 增加 `year >= start-year`。 |
| `--end-year` | 整数 | 当前年份 | 增加 `year <= end-year`。 |

后端接口：

```text
POST /gateway/research/literature/v2/tradition/search
```

请求头：

```text
Accept: */*
Accept-Encoding: gzip, deflate, br
Authorization: Bearer <key>
Content-Type: application/json
```

查询映射规则：

- 在 `title`、`keyword`、`abstract` 中匹配 `query`，使用括号形成 `OR` 分组：`((title == query) OR (keyword == query) OR (abstract == query))`。
- 增加年份条件：`year >= startYear AND year <= endYear`。
- 固定增加语种条件：`language == "zh"`。

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

自然语言检索固定使用 `pageIndex: 1` 和 `score desc` 排序。

## 结构化检索

### CLI 调用

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

CLI 参数到请求体的映射：

| CLI 参数 | JSON 字段 | 类型 | 默认值和校验 |
|---|---|---|---|
| `--page-index` | `pageIndex` | 整数 | `1`，必须大于等于 `1`。 |
| `--page-size` | `pageSize` | 整数 | `20`，限制为 `1`-`100`。 |
| `--sort-field` | `sort.field` | 字符串 | `score`；支持 `score`、`cited_count`、`publish_date`、`year`。 |
| `--sort-order` | `sort.order` | 字符串 | `desc`；支持 `asc`、`desc`。 |
| `--conditions` | `conditions` | 数组 | 必填；`[]` 表示没有其他筛选条件。CLI 会自动追加中文条件。 |

结构化检索固定为中文。如果条件树中没有语种条件，CLI 追加 `language == "zh"`；如果指定 `language == "en"` 或其他非中文条件，CLI 拒绝请求。

请求体示例：

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

## 条件节点

API 使用有序节点数组，而不是扁平键值表。

单个表达式：

```json
{
  "action": "condition",
  "exp": {
    "field": "keyword",
    "symbol": "==",
    "value": "深度学习"
  }
}
```

逻辑连接符：

```json
{ "action": "operation", "operator": "and" }
```

分组表达式：

```json
{
  "action": "bracket",
  "conditions": [
    { "action": "condition", "exp": { "field": "keyword", "symbol": "==", "value": "LLM" } },
    { "action": "operation", "operator": "or" },
    { "action": "condition", "exp": { "field": "keyword", "symbol": "==", "value": "大语言模型" } }
  ]
}
```

规则：

- `operation` 只能放在相邻表达式之间。
- `bracket.conditions` 使用相同的节点格式，并支持嵌套。
- 数字字段使用数字值，布尔字段使用布尔值。
- 只能使用下方字段矩阵中的字段和运算符。

## 字段和运算符矩阵

| 字段 | JSON 值类型 | 支持的运算符 | 说明或取值 |
|---|---|---|---|
| `title` | 字符串 | `==`, `!=` | 标题。 |
| `abstract` | 字符串 | `==`, `!=` | 摘要。 |
| `author` | 字符串 | `==`, `!=` | 任意作者。 |
| `first_author` | 字符串 | `==`, `!=` | 第一作者。 |
| `institution` | 字符串 | `==`, `!=` | 机构或作者单位。 |
| `year` | 数字 | `==`, `!=`, `>`, `<`, `>=`, `<=` | 发表年份。 |
| `language` | 字符串 | `==`, `!=` | 本 Skill 固定为 `zh`。 |
| `topic` | 字符串 | `==`, `!=` | 主题。 |
| `subject` | 字符串 | `==`, `!=` | 学科。 |
| `keyword` | 字符串 | `==`, `!=` | 关键词。 |
| `container_title` | 字符串 | `==`, `!=` | 期刊或会议名称。 |
| `publisher` | 字符串 | `==`, `!=` | 出版者。 |
| `location` | 字符串 | `==`, `!=` | 会议地点。 |
| `organizer` | 字符串 | `==`, `!=` | 会议组织者。 |
| `issn` | 字符串 | `==`, `!=` | ISSN。 |
| `doi` | 字符串 | `==` | DOI。 |
| `pmid` | 字符串 | `==` | PMID。 |
| `pmcid` | 字符串 | `==` | PMCID。 |
| `openalexid` | 字符串 | `==` | OpenAlex ID。 |
| `has_abstract` | 布尔值 | `==` | 是否有摘要。 |
| `has_fulltext` | 布尔值 | `==` | 是否有全文。 |
| `is_oa` | 布尔值 | `==` | 是否开放获取。 |
| `cited_count` | 数字 | `>`, `<`, `>=`, `<=` | 被引次数。 |
| `type` | 字符串 | `==` | `journal` 或 `conference`。 |
| `publish_date` | 字符串 | `==`, `!=` | `YYYY-MM` 或 `YYYY-MM-DD`。 |
| `platform` | 字符串 | `==` | 知网、万方、维普、Scopus、Wos 或 OpenAlex。 |
| `core_journal` | 布尔值 | `==` | 是否核心期刊。 |
| `article_type` | 字符串 | `==`, `!=` | PubMed 文章类型。 |
| `med_platform` | 数字或字符串 | `==`, `!=` | `1` PubMed，`2` 国内医学，`3` 预印本。 |
| `mesh` | 字符串 | `==`, `!=` | MeSH 术语。 |
| `chemical` | 字符串 | `==`, `!=` | 化学物质。 |

不要假设所有字段都支持 `like`。CLI 不会自动替换未记录的运算符。

## 全文链接生成

该接口根据后端文件路径生成下载地址，不会上传用户本地文件。

```text
POST /gateway/GenerateDownloadAddress/
Content-Type: application/json
```

CLI 示例：

```powershell
yk-academic-search fulltext `
  --filepath "reading/pdf/article.pdf" `
  --file-type local `
  --day 3 `
  --domain-type 1 `
  --title "论文标题"
```

请求体：

```json
{
  "Type": "local",
  "path": "reading/pdf/article.pdf",
  "day": 3,
  "title": "论文标题",
  "domain_type": 1
}
```

| 参数 | 后端字段 | 类型 | 默认值 | 说明 |
|---|---|---|---:|---|
| `--filepath` | `path` | 字符串 | 必填 | 后端本地、OSS、图书或词典文件路径。 |
| `--file-type` | `Type` | 字符串 | `local` | `local`、`oss`、`book` 或 `dic`。 |
| `--day` | `day` | 整数 | `3` | 下载地址有效期，单位为天。 |
| `--domain-type` | `domain_type` | 整数 | `1` | 后端域类型。 |
| `--title` | `title` | 字符串 | 空 | 嵌入下载地址的可选标题。 |

成功响应必须包含 `data.download_path`，CLI 将其返回为 `download_path`。如果检索结果没有后端文件路径，不要使用用户无关的本地路径代替。

## 响应与标准化

传统检索通常返回以下结构：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 100,
    "list": [
      {
        "title": "...",
        "abstract": "...",
        "author": "...",
        "year": 2024,
        "container_title": "...",
        "cited_count": 45,
        "doi": "10.1234/example",
        "is_oa": true,
        "filepath": "reading/pdf/article.pdf"
      }
    ]
  }
}
```

CLI 会统一以下字段：

- `title`：从 `title`、`originalTitle`、`zhTitle` 或 `enTitle` 获取。
- `abstract`：从 `abstract`、`originalAbstract`、`zhAbstract` 或 `enAbstract` 获取。
- `keywords`：从 `keywords`、`originalKeywords`、`zhKeywords` 或 `enKeywords` 获取。
- `authors`：作者对象数组转换为作者姓名数组。
- `container_title`：从 `container.title` 获取。
- `cited_count`：从 `citedCount` 获取。
- `filepath`：从 `localAddress` 或 `pdf.downloadUrl` 获取。

输出前删除以下原始或冗余字段：

```text
zhTitle, enAbstract, zhKeywords, citedDocs, zhAbstract, references, highLight, aiOverview, aiGuideReading, aiFixQuestion
```

自然语言检索会将原始 `id` 复制为 `arxiv_id`，并把 `id` 替换为从 1 开始的结果序号。空结果返回 `[]`。结构化检索保留后端响应封装，自然语言检索返回标准化结果数组。

## 错误、配额和运行规则

- 缺少 `YK_ACADEMIC_API_KEY` 时，显示 PowerShell、CMD、Linux 和 macOS 配置说明，不发起网络请求。
- Key 无效时，提示配置有效的环境变量。
- 每日检索配额耗尽时，停止继续请求并提示配额不足。
- 全文链接生成是否计入配额由服务端策略决定，CLI 不维护本地配额计数。
- HTTP 错误、JSON 格式错误或响应缺少 `download_path` 时，报告错误，不伪造结果或链接。

后端部署文档：<https://claude.newacademic.net/docs/>。
