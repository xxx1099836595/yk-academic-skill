---
name: yk-academic-search
description: Use when the user asks to search, filter, compare, or retrieve academic literature through the YK academic search CLI, including field filters, Boolean conditions, citation limits, DOI/PMID lookup, journal constraints, or full-text download links.
---

# YK Academic Search

Use the Node CLI in this package to call the YK academic API directly. This Skill does not call MCP, Nacos, or service discovery. The default API base is `http://192.168.45.252:8610`; override it with `YK_ACADEMIC_API_BASE` or `--api-base` when the deployment uses another address.

## Authentication

The API key must come from the `YK_ACADEMIC_API_KEY` environment variable. Never put a key in a Skill file, source file, prompt, or command argument. The CLI sends it as `Authorization: Bearer <key>`.

Before either command, check that the variable is non-empty. If it is missing, do not make a network request. Show:

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

After the user configures it, ask them to run the command again. The environment variable set with PowerShell or `set` applies to the current terminal and its child processes. For persistent Linux/macOS configuration, add the `export` line to `~/.bashrc` or `~/.zshrc` and open a new terminal.

## Commands

Run the installed command as `yk-academic-search ...`. When running from the Skill directory, use `node scripts/search.mjs ...` or `node scripts/fulltext-link.mjs ...`.

| User intent | Command | Required input |
|---|---|---|
| Natural-language literature search | `yk-academic-search search` | `--query <text>` |
| Exact fields, operators, Boolean groups, sorting, or pagination | `yk-academic-search search` | `--conditions '<JSON array>'` |
| Generate a download URL from a known backend file path | `yk-academic-search fulltext` | `--filepath <path>` |

Search has two mutually exclusive modes. Never send both `--query` and `--conditions`. A full-text URL can only be generated when a result contains a usable backend file path; a local path on the user's computer is not automatically uploaded.

## Natural-Language Search

Example:

```powershell
yk-academic-search search --query "近五年多模态大模型在医学影像中的应用" --size 15 --database chinese --start-year 2021 --end-year 2026
```

Options:

| Option | Type | Default | Meaning |
|---|---|---:|---|
| `--query` | string | required | Natural-language search text. |
| `--size` | integer | `15` | Number of results; the CLI clamps it to `1`-`50`. |
| `--database` | string | `chinese` | `chinese` sends language `zh`; any other value sends language `en`. |
| `--start-year` | integer | current year - 5 | Adds `year >= start-year`. |
| `--end-year` | integer | current year | Adds `year <= end-year`. |

The CLI makes two backend requests:

1. `POST /intention/recognize` with `{"text":"<query>"}`.
2. `POST /literature/v2/intention/search` with the recognized intention, page size, score-descending sort, and year/language conditions.

The generated intention-search body has this shape:

```json
{
  "text": "近五年多模态大模型在医学影像中的应用",
  "intentionWords": "<recognition result>",
  "pageIndex": 1,
  "pageSize": 15,
  "withJournal": false,
  "sort": { "field": "score", "order": "desc" },
  "conditions": [
    { "action": "condition", "exp": { "field": "year", "symbol": ">=", "value": 2021 } },
    { "action": "operation", "operator": "and" },
    { "action": "condition", "exp": { "field": "year", "symbol": "<=", "value": 2026 } },
    { "action": "operation", "operator": "and" },
    { "action": "condition", "exp": { "field": "language", "symbol": "==", "value": "zh" } }
  ]
}
```

## Structured Search

Example:

```powershell
yk-academic-search search `
  --page-index 1 `
  --page-size 20 `
  --sort-field cited_count `
  --sort-order desc `
  --conditions '[{"action":"condition","exp":{"field":"keyword","symbol":"==","value":"多模态大模型"}},{"action":"operation","operator":"and"},{"action":"condition","exp":{"field":"year","symbol":">=","value":2023}},{"action":"operation","operator":"and"},{"action":"condition","exp":{"field":"cited_count","symbol":">=","value":5}}]'
```

The CLI sends this request unchanged apart from the option-name mapping:

```text
POST /literature/v2/tradition/search
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
    { "action": "condition", "exp": { "field": "cited_count", "symbol": ">=", "value": 5 } }
  ]
}
```

Options:

| Option | Type | Default | Valid values / meaning |
|---|---|---:|---|
| `--conditions` | JSON array | required | Condition-node array; use `[]` for no filters. |
| `--page-index` | integer | `1` | Page number; must be at least `1`. |
| `--page-size` | integer | `20` | Page size; must be `1`-`100`. |
| `--sort-field` | string | `score` | `score`, `cited_count`, `publish_date`, or `year`. |
| `--sort-order` | string | `desc` | `asc` or `desc`. |

## Condition Syntax

`conditions` is a JSON array. A `condition` is one expression:

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

Put an `operation` only between adjacent expressions. Its operator is `and` or `or`:

```json
{ "action": "operation", "operator": "and" }
```

Use `bracket` to group nested expressions. For `(LLM OR 大语言模型) AND year >= 2024`:

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

Rules:

- Do not put an `operation` before the first expression or after the last expression.
- `bracket.conditions` uses the same node format and may be nested.
- Keep values as numbers for numeric fields and booleans for Boolean fields.
- Use only the documented field/operator combinations in [references/api.md](references/api.md). Do not invent fields or silently replace an operator. The backend may support additional operators in a particular deployment; use them only when that deployment documents them.

## Full-Text Download Link

Use this only after a search result supplies a backend `filepath` or equivalent file path:

```powershell
yk-academic-search fulltext `
  --filepath "reading/pdf/article.pdf" `
  --file-type local `
  --day 3 `
  --domain-type 1 `
  --title "论文标题"
```

The CLI sends:

```text
POST /GenerateDownloadAddress/
```

```json
{
  "Type": "local",
  "path": "reading/pdf/article.pdf",
  "day": 3,
  "title": "论文标题",
  "domain_type": 1
}
```

Options:

| Option | Type | Default | Backend field | Meaning |
|---|---|---:|---|---|
| `--filepath` | string | required | `path` | Backend local/OSS file path. |
| `--file-type` | string | `local` | `Type` | `local`, `oss`, `book`, or `dic`. |
| `--day` | integer | `3` | `day` | Download URL validity period in days. |
| `--domain-type` | integer | `1` | `domain_type` | Backend domain type. |
| `--title` | string | empty | `title` | Optional title embedded in the generated URL. |

File type meanings are `local` for a local-file path, `oss` for an OSS path, `book` for a book/edown path, and `dic` for an `oss.dic.cool` path. The endpoint returns `data.download_path`; return that value as the download link when the user asks for a link. Full-text link generation authenticates with the Key but does not consume the search quota.

## Output Handling

Structured search normally returns `code`, `message`, `data.total`, and `data.list`. Natural-language search returns a normalized result array. The CLI removes these backend-only or bulky fields from list items:

```text
zhTitle, enAbstract, zhKeywords, citedDocs, zhAbstract, references, highLight
```

Natural-language results also normalize author objects to author-name arrays, add `arxiv_id` from the original `id`, and replace the local `id` with a one-based result sequence. Empty result lists are returned as `[]`. Present useful fields such as title, year/date, authors, journal, citation count, DOI/PMID, OA/full-text status, and file path. If the user asks for a download link, return only the generated `download_path` rather than the complete search record.

## Errors and Quotas

- Missing Key: show the configuration block above and do not retry automatically.
- Invalid Key: ask the user to configure a valid `YK_ACADEMIC_API_KEY`.
- Daily search quota exhausted: stop additional search calls and report that the Key has no remaining search quota.
- Full-text detail/link requests do not count as search requests according to the service contract.
- HTTP, JSON, or backend errors: report the endpoint and concise error; do not fabricate results or links.

The package contains no local quota counter. Any limit, including five Keys with 5,000 searches per Key per day, must be provisioned and enforced by the API gateway/backend.

For the complete field matrix and payload mapping, read [references/api.md](references/api.md). For backend deployment details, see <https://claude.newacademic.net/docs/>.
