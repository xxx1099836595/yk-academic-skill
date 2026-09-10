---
name: yk-academic-search
description: Use when the user asks to search, filter, compare, or retrieve academic literature through the YK academic search CLI, including field filters, Boolean conditions, citation limits, DOI/PMID lookup, journal constraints, or full-text download links.
---

# YK Academic Search

Use the package's Node CLI scripts for academic literature retrieval. Do not call an MCP tool for this skill. The CLI calls the YK backend directly at `http://192.168.45.252:8610` unless `YK_ACADEMIC_API_BASE` or `--api-base` overrides it.

Read the Key from `YK_ACADEMIC_API_KEY` by default. Use `--api-key` only for a one-off override. The CLI forwards the Key as `Authorization: Bearer <key>`.

## Choose the tool

| User request | CLI command | Arguments |
|---|---|---|
| Natural-language search topic | `node scripts/search.mjs` | Set `--query`; omit `--conditions`. |
| Structured fields, operators, Boolean groups, sorting, or pagination | `node scripts/search.mjs` | Set `--conditions`; omit `--query`. |
| Generate a full-text download URL from a known backend file path | `node scripts/fulltext-link.mjs` | Set `--filepath`; return `download_path`. |

Search accepts exactly one mode. Do not send both `--query` and `--conditions`.

## Search arguments

Natural-language mode:

```bash
node scripts/search.mjs --query "多模态大模型" --size 15 --database chinese --start-year 2023 --end-year 2026
```

Structured mode:

```bash
node scripts/search.mjs --page-index 1 --page-size 20 --sort-field cited_count --sort-order desc --conditions '[{"action":"condition","exp":{"field":"keyword","symbol":"==","value":"多模态大模型"}},{"action":"operation","operator":"and"},{"action":"condition","exp":{"field":"year","symbol":">=","value":2023}}]'
```

Allowed `--sort-field` values are `score`, `cited_count`, `publish_date`, and `year`. `--sort-order` is `asc` or `desc`. `--page-index` starts at 1 and `--page-size` is 1-100.

## Condition nodes

Use a `condition` node for one field expression:

```json
{"action":"condition","exp":{"field":"doi","symbol":"==","value":"10.1234/example"}}
```

Use an `operation` node between adjacent expressions:

```json
{"action":"operation","operator":"and"}
```

Use a `bracket` node for grouped Boolean logic. For example, `(LLM OR 大语言模型) AND year >= 2024` is:

```json
[
  {
    "action": "bracket",
    "conditions": [
      {"action":"condition","exp":{"field":"keyword","symbol":"==","value":"LLM"}},
      {"action":"operation","operator":"or"},
      {"action":"condition","exp":{"field":"keyword","symbol":"==","value":"大语言模型"}}
    ]
  },
  {"action":"operation","operator":"and"},
  {"action":"condition","exp":{"field":"year","symbol":">=","value":2024}}
]
```

Supported fields include `title`, `abstract`, `author`, `first_author`, `institution`, `year`, `language`, `topic`, `subject`, `keyword`, `container_title`, `publisher`, `location`, `organizer`, `issn`, `doi`, `pmid`, `pmcid`, `openalexid`, `has_abstract`, `has_fulltext`, `is_oa`, `cited_count`, `type`, `publish_date`, `platform`, `core_journal`, `article_type`, `med_platform`, `mesh`, and `chemical`.

Use numeric values for `year` and `cited_count`, Boolean values for `has_abstract`, `has_fulltext`, `is_oa`, and `core_journal`, and `YYYY-MM` or `YYYY-MM-DD` strings for `publish_date`. Do not invent unsupported fields or silently change the user's operator.

## Full-text link

Only generate a full-text link after a search result provides a usable backend file path. Pass the path as `--filepath`, set `--file-type` to `local` or `oss`, and return only the `download_path` when the user asks for a download link.

```bash
node scripts/fulltext-link.mjs --filepath "/path/to/paper.pdf" --file-type local --day 3 --domain-type 1 --title "optional title"
```

If the path is missing, explain that a full-text link cannot be generated from the current result.

## Results

Structured search responses normally contain `code`, `message`, and `data.total` / `data.list`; natural-language search returns a normalized result array. Present concise result records with title, year/date, authors, journal, citation count, identifiers, OA/full-text status, and a short reason for matching. Results omit backend-only fields such as `zhTitle`, `enAbstract`, and `zhKeywords`; do not rely on those fields.

## CLI helpers

If the package is installed as an npm CLI, use:

```bash
yk-academic-search search --query "多模态大模型"
yk-academic-search fulltext --filepath "/path/to/paper.pdf"
```

Inside the installed skill directory, prefer the local scripts:

```bash
node scripts/search.mjs --query "多模态大模型"
node scripts/fulltext-link.mjs --filepath "/path/to/paper.pdf"
```

Set `YK_ACADEMIC_API_KEY` before running the scripts. Set `YK_ACADEMIC_API_BASE` when the backend endpoint is not `http://192.168.45.252:8610`.

## Error handling

- `API Key 无效`: use the configured Bearer Key or ask the user for a valid Key.
- `今日检索次数已用完`: stop additional search calls for that Key and report that the daily search quota is exhausted.
- Backend errors or empty results: report the issue briefly, then suggest a narrower or broader condition only when useful.
