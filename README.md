# yk-academic-search

YK 学术文献检索 Skill 包，包含：

- Codex Skill：`skills/yk-academic-search/SKILL.md`
- Node CLI：`yk-academic-search`

## 安装

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
npx yk-academic-search search --query "多模态大模型"
npx yk-academic-search fulltext --filepath "/path/to/paper.pdf"
```

默认后端地址是 `http://192.168.45.252:8610`。也可以覆盖：

```bash
set YK_ACADEMIC_API_BASE=http://192.168.45.252:8610
```

Key 会作为 `Authorization: Bearer <key>` 请求头发送给后端。检索限额应由后端或网关统一控制；Skill 和 CLI 不再通过 MCP 做本地计数。

API 文档：<https://claude.newacademic.net/docs/>
