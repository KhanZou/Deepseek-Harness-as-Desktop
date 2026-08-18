# dsh-skill-manager（按工作区管理启用 Skill / 工具）

把 dsh monorepo 里的 `@deepseek-ai/dsh-client-ui-skill-manager` 改造成**外部插件**：
以 dsh workspace 的**已发布包**（`@deepseek-ai/dsh-client-ui-workspace`、`@deepseek-ai/dsh-api-remotes` 等）作为 peer 依赖，
可安装到任意一台装了 dsh 的电脑；每个工作区（项目）的技能启用配置随项目仓库同步。

## 功能

- 在工作区列表每个项目行的 `⋯` 菜单里出现 **“技能设置… / Skills…”** 入口（依赖 ui-workspace 的
  `sidebar.workspaces.skillManager` 插槽，仅本插件挂载时显示）。
- 弹窗列出**项目技能**（`.dsh/skills`、`.agents/skills`）与**全局技能**（`~/.dsh/skills`、`~/.agents/skills`），
  每个技能带启用/禁用开关、来源徽标、调用方式提示（模型+用户 / 仅用户）。
- **复制配置 / 应用配置**：把一个项目的 `.dsh/skills.json` 复制到剪贴板，再应用到另一个项目。

## ⚠️ 为什么不能是“纯插件”（重要）

调研结论：**纯插件不可行**。stock dsh（含 0.1.0-rc.7）里：
1. 技能按**目录存在**发现（`.dsh/skills` 等），**没有**逐技能启用/禁用机制，也**不读** `.dsh/skills.json` 清单——写了也没用；
2. 浏览器插件可用的 RPC 里**没有**通用文件读写（只有 `skill.list`、`host.listDirectory/createDirectory` 等）；
3. ui-workspace **没有** `sidebar.workspaces.skillManager` 插槽或行菜单孔。

所以启用/禁用、跨项目复制配置这些能力必须由**宿主**提供。本插件以两种方式配合宿主，由你选择。

## 安装（二选一）

### 方案 A：应用随包提供的宿主补丁（推荐，本仓库自包含）

插件目录里已经打包了基于 dsh `0.1.0-rc.7` 的宿主补丁：

```powershell
# 1) 先确保 dsh checkout 干净
# 2) 应用宿主补丁（自动 git apply + pnpm install）
powershell -ExecutionPolicy Bypass -File .\dsh-skill-manager\host-patch\apply.ps1 -DshDir D:\deepseek-harness
# 3) 重启 dsh 并安装插件
corepack pnpm dsh web
corepack pnpm dsh plugin --profile web add <本仓库>\dsh-skill-manager
```

详见 [`host-patch/README.md`](host-patch/README.md)。

### 方案 B：使用你的 deepseek-harness fork 分支

把 `D:\deepseek-harness` 里的 `feat/skill-manager` 分支推到你的私有 fork，每台电脑 clone 该分支再装插件。
详见 [`docs/skill-manager-host-support.md`](../docs/skill-manager-host-support.md)。

## 多台电脑同步配置

- **项目级技能配置**（`.dsh/skills.json`）：存在项目里，随**项目 git 仓库**自动同步。
- **全局技能**（`~/.dsh/skills` / `~/.agents/skills`）：机器级。
- **宿主 + 插件**：每台电脑按方案 A 或 B 配置一次。

## 结构

| 路径 | 说明 |
|---|---|
| `lib/index.js` | 宿主入口（空 apply，纯 UI 插件） |
| `lib/client.js` | 预构建浏览器 bundle（`window.__ModuleLoader__.load`） |
| `src/` | TS/TSX 源码（维护用） |
| `host-patch/` | 可选宿主补丁 + 一键应用脚本 |
| `cordis.patch.yml` | 把 client bundle 插入 web-app 组合 |
| `tests/` | 浏览器半区单测 |

## 重新构建

`lib/client.js` 是预构建产物。要重新构建，需要在一个 dsh workspace（能解析 `@deepseek-ai/*` 包）里对 `src/` 运行 `tsdown`。
