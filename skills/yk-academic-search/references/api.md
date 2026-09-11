# YK Academic Search CLI API Reference

The CLI calls the backend directly. Default URL:

```text
http://192.168.45.252:8610
```

Override with `YK_ACADEMIC_API_BASE` or `--api-base`.
Set `YK_ACADEMIC_API_KEY` for authentication. The API Key is environment-only; there is no `--api-key` command-line option.

If the variable is missing, stop locally and ask the user to configure it:

```powershell
# Windows PowerShell
$env:YK_ACADEMIC_API_KEY="你的秘钥"
```

```cmd
:: Windows CMD
set YK_ACADEMIC_API_KEY=你的秘钥
```

```bash
# Linux or macOS
export YK_ACADEMIC_API_KEY="你的秘钥"
```

API 文档：<https://claude.newacademic.net/docs/>.

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
