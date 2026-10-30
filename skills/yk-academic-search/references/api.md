# YK Academic Search API Reference

This reference describes the direct HTTP calls made by the Node CLI and the exact CLI-to-API parameter mapping. The Skill does not call MCP, Nacos, or service discovery.

## Connection and Authentication

Default API base:

```text
https://apisass.newacademic.net
```

The CLI chooses the base URL in this order:

1. `--api-base <url>`
2. `YK_ACADEMIC_API_BASE`
3. `https://apisass.newacademic.net`

The API key is supplied through the `YK_ACADEMIC_API_KEY` environment variable. The repository does not embed a production key.

The CLI sends HTTP requests with the following standard headers:

```text
Accept: */*
Accept-Encoding: gzip, deflate, br
Authorization: Bearer <key>
Content-Type: application/json
```

If you wish to configure a custom key:

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

There is intentionally no `--api-key` option. If the variable is missing, the CLI prints the setup tutorial and does not call the network.

## CLI Overview

```text
yk-academic-search search --query <text> [--size 15] [--database chinese] [--start-year 2021] [--end-year 2026]
yk-academic-search search --conditions '<JSON array>' [--page-index 1] [--page-size 20] [--sort-field score] [--sort-order desc]
yk-academic-search fulltext --filepath <path> [--file-type local] [--day 3] [--domain-type 1] [--title <text>]
```

The search modes are mutually exclusive. Use `--query` for natural-language intent recognition or `--conditions` for an explicit condition tree.

## Natural-Language Search

### CLI request

```powershell
yk-academic-search search `
  --query "近五年多模态大模型在医学影像中的应用" `
  --size 15 `
  --database chinese `
  --start-year 2021 `
  --end-year 2026
```

| CLI option | Type | Default | Validation / mapping |
|---|---|---:|---|
| `--query` | string | required | Sent as the search text. |
| `--size` | integer | `15` | Clamped to `1`-`50`; sent as `pageSize`. |
| `--database` | string | `chinese` | Chinese-only selector. `chinese` and `zh` map to `language == "zh"`; other values are rejected. |
| `--start-year` | integer | current year - 5 | Adds `year >=` to the generated conditions. |
| `--end-year` | integer | current year | Adds `year <=` to the generated conditions. |

The CLI maps natural-language queries into structured field conditions and sends them directly to:

```text
POST /gateway/research/literature/v2/tradition/search
Content-Type: application/json
Accept: */*
Accept-Encoding: gzip, deflate, br
Authorization: Bearer <key>
```

Query mapping:
- Matches `query` across `title`, `keyword`, and `abstract` using a bracketed `OR` group:
  `((title == query) OR (keyword == query) OR (abstract == query))`
- Adds year boundaries: `year >= startYear AND year <= endYear`
- Adds the fixed language restriction: `language == "zh"`

Request body:

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

The CLI always uses `pageIndex: 1` and relevance-descending sort in natural-language mode.

## Structured Search

### CLI request

```powershell
yk-academic-search search `
  --page-index 1 `
  --page-size 20 `
  --sort-field cited_count `
  --sort-order desc `
  --conditions '[{"action":"condition","exp":{"field":"keyword","symbol":"==","value":"多模态大模型"}},{"action":"operation","operator":"and"},{"action":"condition","exp":{"field":"year","symbol":">=","value":2023}},{"action":"operation","operator":"and"},{"action":"condition","exp":{"field":"cited_count","symbol":">=","value":5}}]'
```

Backend endpoint:

```text
POST /gateway/research/literature/v2/tradition/search
Content-Type: application/json
```

CLI options map to this body:

| CLI option | JSON field | Type | Default / validation |
|---|---|---|---|
| `--page-index` | `pageIndex` | integer | `1`; must be >= 1. |
| `--page-size` | `pageSize` | integer | `20`; must be 1-100. |
| `--sort-field` | `sort.field` | string | `score`; `score`, `cited_count`, `publish_date`, or `year`. |
| `--sort-order` | `sort.order` | string | `desc`; `asc` or `desc`. |
| `--conditions` | `conditions` | array | required; `[]` means no filter. Passed through as parsed JSON. |

Structured search is Chinese-only. If the condition tree does not contain a language condition, the CLI appends `language == "zh"`. A language condition with any other value or operator is rejected.

Request body:

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
    { "action": "condition", "exp": { "field": "cited_count", "symbol": ">=", "value": 5 } }
  ]
}
```

## Condition Nodes

The API uses an ordered node array rather than a flat map. The CLI parses the JSON array and puts it in the request body without changing its nodes.

Single expression:

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

Logical connector:

```json
{ "action": "operation", "operator": "and" }
```

Grouped expression:

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

For `(A OR B) AND C`, use `[bracket(A, or, B), and, C]`. An `operation` belongs only between expressions. A bracket can contain another bracket and uses the same node rules.

The field and symbol must be compatible. The following matrix is the supported contract:

| Field | JSON value type | Supported symbols | Description / accepted values |
|---|---|---|---|
| `title` | string | `==`, `!=` | Title. |
| `abstract` | string | `==`, `!=` | Abstract. |
| `author` | string | `==`, `!=` | Any author. |
| `first_author` | string | `==`, `!=` | First author. |
| `institution` | string | `==`, `!=` | Institution/affiliation. |
| `year` | number | `==`, `!=`, `>`, `<`, `>=`, `<=` | Publication year. |
| `language` | string | `==`, `!=` | Typically `zh` or `en`. |
| `topic` | string | `==`, `!=` | Topic. |
| `subject` | string | `==`, `!=` | Subject. |
| `keyword` | string | `==`, `!=` | Keyword. |
| `container_title` | string | `==`, `!=` | Journal or conference name. |
| `publisher` | string | `==`, `!=` | Publisher. |
| `location` | string | `==`, `!=` | Conference location. |
| `organizer` | string | `==`, `!=` | Conference organizer. |
| `issn` | string | `==`, `!=` | ISSN. |
| `doi` | string | `==` | DOI. |
| `pmid` | string | `==` | PMID. |
| `pmcid` | string | `==` | PMCID. |
| `openalexid` | string | `==` | OpenAlex ID. |
| `has_abstract` | boolean | `==` | Whether an abstract exists. |
| `has_fulltext` | boolean | `==` | Whether full text exists. |
| `is_oa` | boolean | `==` | Whether the resource is open access. |
| `cited_count` | number | `>`, `<`, `>=`, `<=` | Citation count. |
| `type` | string | `==` | `journal` or conference. |
| `publish_date` | string | `==`, `!=` | `YYYY-MM` or `YYYY-MM-DD`. |
| `platform` | string | `==` | 知网, 万方, 维普, Scopus, Wos, or OpenAlex. |
| `core_journal` | boolean | `==` | Whether it is a core journal. |
| `article_type` | string | `==`, `!=` | PubMed article type. |
| `med_platform` | number or string | `==`, `!=` | `1` PubMed, `2` domestic medicine, `3` preprint. |
| `mesh` | string | `==`, `!=` | MeSH term. |
| `chemical` | string | `==`, `!=` | Chemical substance. |

The source contract lists exact operators above. Do not assume `like` is available for every field. If a particular backend deployment documents an extra operator, pass it exactly as documented; the CLI does not silently translate operators.

## Full-Text Link Generation

The endpoint creates a download URL from a backend file path. It does not upload a local file.

```text
POST /gateway/GenerateDownloadAddress/
Content-Type: application/json
```

CLI example:

```powershell
yk-academic-search fulltext `
  --filepath "reading/pdf/article.pdf" `
  --file-type local `
  --day 3 `
  --domain-type 1 `
  --title "论文标题"
```

CLI-to-body mapping:

| CLI option | Backend field | Type | Default | Meaning |
|---|---|---|---:|---|
| `--filepath` | `path` | string | required | Backend local/OSS file path. |
| `--file-type` | `Type` | string | `local` | `local`, `oss`, `book`, or `dic`. |
| `--day` | `day` | integer | `3` | URL validity period in days. |
| `--domain-type` | `domain_type` | integer | `1` | Backend domain type. |
| `--title` | `title` | string | empty | Optional title. |

Request example:

```json
{
  "Type": "local",
  "path": "reading/pdf/article.pdf",
  "day": 3,
  "title": "论文标题",
  "domain_type": 1
}
```

`Type` meanings:

| Type | Meaning |
|---|---|
| `local` | Local-file path understood by the backend. |
| `oss` | OSS download path. |
| `book` | Book/edown path. |
| `dic` | `oss.dic.cool` path. |

The CLI requires `data.download_path` in a successful response and returns it as `download_path`. Full-text generation uses the API key for authentication but does not consume the search quota. If the search result has no backend file path, do not invent one or pass the user's unrelated local path.

## Responses and Normalization

Traditional search commonly returns:

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

The CLI normalizes fields across heterogeneous backend response variants:
- `title`: normalized from `originalTitle`, `zhTitle`, or `enTitle`
- `abstract`: normalized from `originalAbstract`, `zhAbstract`, or `enAbstract`
- `keywords`: normalized from `originalKeywords`, `zhKeywords`, or `enKeywords`
- `container_title`: normalized from `container.title`
- `cited_count`: normalized from `citedCount`
- `filepath`: normalized from `localAddress` or `pdf.downloadUrl`
- `authors`: normalized from author object array to string array of author names

Before output, the CLI deletes raw, bulky, or redundant fields:

```text
zhTitle, enAbstract, zhKeywords, citedDocs, zhAbstract, references, highLight, aiOverview, aiGuideReading, aiFixQuestion
```

Natural-language output additionally:

- converts author objects to an array of author names when possible;
- copies the original `id` to `arxiv_id`;
- replaces `id` with a one-based result index;
- returns `[]` for an empty or missing result list.

The CLI preserves the backend response envelope for structured search and returns the normalized list for natural-language search. It returns `download_path` for full-text link generation.

## Errors, Quotas, and Operational Rules

- Missing `YK_ACADEMIC_API_KEY`: show setup commands for PowerShell, CMD, Linux, and macOS; do not call the API.
- Invalid key: report authentication failure and ask for a valid environment variable value.
- Search quota exhausted: stop search retries and report that the daily quota is exhausted.
- Full-text link generation is detail/link generation and does not consume search quota under the service contract.
- HTTP failures, malformed JSON, and missing `download_path` are errors; never fabricate a result or link.
- A five-key allocation with 5,000 searches per key per day is a backend/gateway provisioning rule, not a Skill setting. The CLI has no local quota counter.

Backend deployment documentation: <https://claude.newacademic.net/docs/>.
