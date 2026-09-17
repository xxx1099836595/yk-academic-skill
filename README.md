# yk-academic-search-mcp

YK 学术文献检索 Skill 包，包含：

- Codex Skill：`skills/yk-academic-search/SKILL.md`
- Node CLI：`yk-academic-search`
- MCP stdio 包：`yk-academic-search-mcp`

## 安装

### 本地 MCP 安装

这是本地 `stdio` MCP 服务，不监听 IP 和端口，也不需要配置 MCP URL。未发布 npm 时，直接让 `npx` 使用本地包目录：

```json
{
  "mcpServers": {
    "ykAcademicSearch": {
      "command": "npx",
      "args": [
        "--yes",
        "--package",
        "D:\\py\\deepagent-services\\mcp-servers\\yk-academic-search",
        "yk-academic-search-mcp"
      ],
      "env": {
        "YK_ACADEMIC_API_KEY": "你的Key"
      }
    }
  }
}
```

如果以后发布到 npm，配置才使用包名：

```json
{
  "mcpServers": {
    "ykAcademicSearch": {
      "command": "npx",
      "args": ["-y", "yk-academic-search-mcp"],
      "env": {
        "YK_ACADEMIC_API_KEY": "你的Key"
      }
    }
  }
}
```

服务只暴露两个工具：

- `literature_search`
- `download_full_text`

MCP 服务本身不使用 Nacos。默认后端地址由包内部使用
`http://192.168.45.252:8610`；如确实需要切换后端，可额外设置
`YK_ACADEMIC_API_BASE`，但它不是 MCP 服务地址。

在本地仓库测试 npx 启动，不需要发布到 npm：

```powershell
cd D:\py\deepagent-services\mcp-servers\yk-academic-search
npm install
npx --yes --package . yk-academic-search-mcp
```

也可以先打包，再用本地 tarball 测试：

```powershell
npm pack
npx --yes --package .\yk-academic-search-mcp-1.0.0.tgz yk-academic-search-mcp
```

发布到 GitHub 后，可按 Skill CLI 的 GitHub 安装方式安装：

```bash
npx skills add https://github.com/xxx1099836595/yk-academic-skill/tree/main/skills/yk-academic-search
```

也可以从仓库根目录识别：

```bash
npx skills add https://github.com/xxx1099836595/yk-academic-skill --skill yk-academic-search -y --full-depth
```

不要把这个仓库用作 Codex marketplace root。Marketplace 安装需要单独的 `marketplace.json` 目录结构；本仓库是 Skill/Plugin 包。

如果按 Codex plugin 方式安装，插件入口在 `.codex-plugin/plugin.json`，会声明 Skill 和命令行脚本用法。

## 本地测试安装

在当前包目录执行：

```bash
npx skills add . --list
```

看到 `yk-academic-search` 说明 Skill 包能被识别。

开发联调推荐用符号链接安装，改文件后不用重复安装：

```bash
npx skills add . --skill yk-academic-search -y
```

模拟用户安装推荐复制安装：

```bash
npx skills add . --skill yk-academic-search -y --copy
```

查看安装结果：

```bash
npx skills list --json
```

卸载：

```bash
npx skills remove yk-academic-search -y
```

## CLI 调用

Skill 使用命令行脚本直接调用后端接口，不调用 MCP。秘钥只从环境变量
`YK_ACADEMIC_API_KEY` 读取，不会把秘钥写入 Skill 文件、命令历史或命令行参数。

### 配置秘钥

Windows PowerShell：

```powershell
$env:YK_ACADEMIC_API_KEY="你的秘钥"
```

Windows CMD：

```cmd
set YK_ACADEMIC_API_KEY=你的秘钥
```

Linux：

```bash
export YK_ACADEMIC_API_KEY="你的秘钥"
```

macOS：

```bash
export YK_ACADEMIC_API_KEY="你的秘钥"
```

也可以把 `export` 命令写入 Linux/macOS 的 shell 配置文件（例如 `~/.bashrc` 或
`~/.zshrc`），然后重新打开终端。PowerShell 使用 `$env:` 设置的值只对当前终端窗口及其子进程生效。

未设置秘钥时，CLI 会在本地提示配置方法，并且不会请求后端。

```bash
node bin/yk-academic-search.mjs search --query "多模态大模型"
node bin/yk-academic-search.mjs fulltext --filepath "/path/to/paper.pdf"
```

默认后端地址是 `http://192.168.45.252:8610`。也可以覆盖：

```bash
set YK_ACADEMIC_API_BASE=http://192.168.45.252:8610
```

Key 会作为 `Authorization: Bearer <key>` 请求头发送给后端。检索限额应由后端或网关统一控制；Skill 和 CLI 不再通过 MCP 做本地计数。

参数与请求体完整说明：[`skills/yk-academic-search/references/api.md`](skills/yk-academic-search/references/api.md)

API 文档：<https://claude.newacademic.net/docs/>
