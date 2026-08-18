# dsh-skill-manager（按工作区管理启用 Skill / 工具）

> 把当年 dsh monorepo 里的 `@deepseek-ai/dsh-client-ui-skill-manager` 改造成**外部插件**：
> 以 dsh workspace 的**已发布包**（`@deepseek-ai/dsh-client-ui-workspace`、`@deepseek-ai/dsh-api-remotes` 等）作为 peer 依赖，
> 可安装到任意一台装了 dsh 的电脑；每个工作区（项目）的技能启用配置随项目仓库同步。

## 功能

- 在工作区列表每个项目行的 `⋯` 菜单里出现 **“技能设置… / Skills…”** 入口（依赖 ui-workspace 提供的
  `sidebar.workspaces.skillManager` 插槽，且该插槽只在本插件挂载时才显示）。
- 弹窗列出**项目技能**（`.dsh/skills`、`.agents/skills`）与**全局技能**（`~/.dsh/skills`、`~/.agents/skills`），
  每个技能带启用/禁用开关、来源徽标、调用方式提示（模型+用户 / 仅用户）。
- **复制配置 / 应用配置**：把一个项目的 `.dsh/skills.json` 复制到剪贴板，再应用到另一个项目。

## 安装

```powershell
cd /d "D:\deepseek harness"   # 或你的 dsh 工作目录
corepack pnpm dsh plugin --profile web add <本插件目录路径>
```

> ⚠️ **前提：宿主支撑**。这些 skill 管理 RPC（`skill.inspect` / `skill.setEnabled` / `skill.exportConfig` /
> `skill.applyConfig`）、ui-workspace 的 `sidebar.workspaces.skillManager` 插槽与行菜单入口、以及
> `@deepseek-ai/dsh-skill-config` 宿主包，**在 stock dsh（含 0.1.0-rc.7）里都还没有**。
> 必须先应用宿主补丁，插件才能工作。详见 [`docs/skill-manager-host-support.md`](../docs/skill-manager-host-support.md)。

## 多台电脑同步配置

- **插件**：把本仓库 clone 到每台电脑，按上面命令 `dsh plugin add` 安装（或放进你统一的插件部署目录）。
- **项目级技能配置**：存在项目里（`.dsh/skills.json`），随**项目 git 仓库**自动同步。
- **全局技能**：每台电脑各自 `~/.dsh/skills` / `~/.agents/skills`，属于机器级。
- **宿主**：每台电脑的 dsh 都必须带宿主补丁（推荐用你私有的 deepseek-harness fork 分支，见上文档）。

## 结构

| 路径 | 说明 |
|---|---|
| `lib/index.js` | 宿主入口（空 apply，纯 UI 插件） |
| `lib/client.js` | 预构建浏览器 bundle（`window.__ModuleLoader__.load`，可直接被 dsh 加载） |
| `src/` | TS/TSX 源码（维护用；`src/client/` 为浏览器半区） |
| `cordis.patch.yml` | 把 client bundle 插入 web-app 组合 |
| `tests/` | 浏览器半区单测 |

## 重新构建

`lib/client.js` 是预构建产物。要重新构建，需要在一个 dsh workspace（能解析 `@deepseek-ai/*` 包）里对 `src/` 运行 `tsdown`。
