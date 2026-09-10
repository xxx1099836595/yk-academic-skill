# YK Academic Search CLI API Reference

The CLI calls the backend directly. Default URL:

```text
http://192.168.45.252:8610
```

Override with `YK_ACADEMIC_API_BASE` or `--api-base`.
Set `YK_ACADEMIC_API_KEY` for authentication; use `--api-key` only when overriding it for one command.

## CLI commands

### search

Natural-language mode:

```bash
yk-academic-search search --query "癌症治疗" --size 15 --database chinese --start-year 2021 --end-year 2026
```

Structured mode:

```bash
yk-academic-search search --page-index 1 --page-size 20 --sort-field cited_count --sort-order desc --conditions '[]'
```

Backend structured search maps to:

```text
POST /literature/v2/tradition/search
```

### fulltext

Generates a download link from a known backend file path:

```bash
yk-academic-search fulltext --filepath "/path/to/paper.pdf" --file-type local --day 3 --domain-type 1 --title ""
```

Backend download link generation maps to:

```text
POST /GenerateDownloadAddress/
```

Return `download_path` to the user.
