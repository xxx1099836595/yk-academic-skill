---
name: yk-academic-search
description: Use when the user asks to search, filter, compare, or retrieve academic literature through the YK academic search CLI, including field filters, Boolean conditions, citation limits, DOI/PMID lookup, journal constraints, or full-text download links.
---

# YK Academic Search

Use the Node CLI in this package to call the YK academic API directly. The default API base is `https://apisass.newacademic.net`, and the search endpoint is `/gateway/research/literature/v2/tradition/search`. Override the base with `YK_ACADEMIC_API_BASE` or `--api-base` only when the deployment uses another address.

## Authentication

The API key must be provided through the `YK_ACADEMIC_API_KEY` environment variable. The CLI sends it as `Authorization: Bearer <key>` along with `Accept: */*`, `Accept-Encoding: gzip, deflate, br`, and `Content-Type: application/json`.

If no key is configured, configure it as follows:

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
| `--database` | string | `chinese` | Chinese-only selector. Accepted values are `chinese` and `zh`; requests always send `language == "zh"`. |
| `--start-year` | integer | current year - 5 | Adds `year >= start-year`. |
| `--end-year` | integer | current year | Adds `year <= end-year`. |

The CLI maps natural language queries into structured field conditions targeting `/gateway/research/literature/v2/tradition/search`:
- Matches `query` across `title`, `keyword`, and `abstract` with bracketed `OR` grouping:
  `((title == query) OR (keyword == query) OR (abstract == query))`
- Adds publication year bounds: `year >= startYear AND year <= endYear`
- Adds the fixed language restriction: `language == "zh"`

The generated request body has this shape:

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

Backend endpoint:

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

Structured searches are also restricted to Chinese literature. The CLI appends `language == "zh"` when absent and rejects `language == "en"` or other non-Chinese language conditions.

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
- Use only the documented field/operator combinations in [references/api.md](references/api.md). Do not invent fields or silently replace an operator.

## Full-Text Download Link

Use this only after a search result supplies a backend `filepath` or equivalent file path:

```powershell
yk-academic-search fulltext `
  --filepath "ChineseJournal/Cnki/8b43cf569b3f9fb6a1b999d49da43447/2024/WXDG202412022.pdf" `
  --file-type local `
  --day 3 `
  --domain-type 1 `
  --title "论文标题"
```

The CLI sends:

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

Options:

| Option | Type | Default | Backend field | Meaning |
|---|---|---:|---|---|
| `--filepath` | string | required | `path` | Backend local/OSS file path. |
| `--file-type` | string | `local` | `Type` | `local`, `oss`, `book`, or `dic`. |
| `--day` | integer | `3` | `day` | Download URL validity period in days. |
| `--domain-type` | integer | `1` | `domain_type` | Backend domain type. |
| `--title` | string | empty | `title` | Optional title embedded in the generated URL. |

File type meanings are `local` for a local-file path, `oss` for an OSS path, `book` for a book/edown path, and `dic` for an `oss.dic.cool` path. Note: Search results also directly include online URLs (`linkUrl`, `pdf.onlineUrl`, DOI link).

## Output Handling

Structured search normally returns `code`, `msg`, `data.total`, and `data.list`. Natural-language search returns a normalized result array. The CLI normalizes fields:
- `title`: normalized from `originalTitle` or `zhTitle` or `enTitle`
- `abstract`: normalized from `originalAbstract` or `zhAbstract` or `enAbstract`
- `keywords`: normalized from `originalKeywords` or `zhKeywords` or `enKeywords`
- `authors`: normalized from author object array to string array of author names
- `container_title`: normalized from `container.title`
- `cited_count`: normalized from `citedCount`
- `filepath`: normalized from `localAddress` or `pdf.downloadUrl`

The CLI removes backend-only, raw or bulky fields from list items:
```text
zhTitle, enAbstract, zhKeywords, citedDocs, zhAbstract, references, highLight, aiOverview, aiGuideReading, aiFixQuestion
```

Natural-language results also add `arxiv_id` from the original `id`, and replace the local `id` with a one-based result sequence. Empty result lists are returned as `[]`. Present useful fields such as title, year/date, authors, journal, citation count, DOI/PMID, OA/full-text status, and file path.

## Errors and Quotas

- Missing Key: show the configuration block above and do not retry automatically.
- Invalid Key: ask the user to configure a valid `YK_ACADEMIC_API_KEY`.
- Daily search quota exhausted: stop additional search calls and report that the Key has no remaining search quota.
- Full-text detail/link requests do not count as search requests according to the service contract.
- HTTP, JSON, or backend errors: report the endpoint and concise error; do not fabricate results or links.

The package contains no local quota counter. Any limit must be provisioned and enforced by the API gateway/backend.

For the complete field matrix and payload mapping, read [references/api.md](references/api.md). For backend deployment details, see <https://claude.newacademic.net/docs/>.
