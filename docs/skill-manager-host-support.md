# dsh-skill-manager：宿主支撑说明

`dsh-skill-manager`（原 dsh monorepo 内 `@deepseek-ai/dsh-client-ui-skill-manager`）**不是纯外部插件**：
它依赖一批 **dsh 宿主侧改动**，这些改动在 stock dsh（含 0.1.0-rc.7）中不存在。要让插件可用，dsh 本身必须带上这些改动。

## 缺失的宿主能力（rc.7 里没有）

1. **skill 管理 RPC**（`packages/host/apiproxy`）：
   - `skill.inspect({ cwd })` → 项目 + 用户技能条目及启用状态
   - `skill.setEnabled({ cwd, name, enabled, scope })`
   - `skill.exportConfig({ cwd })` / `skill.applyConfig({ cwd, json })`
   - 涉及 `api/skills.ts`、`api/skills.schema.ts`、`api-proxy.ts`、`api/rpc-map.ts`、`fetch/client.ts`、`fetch/handler.ts`、`api/remotes` client 类型、`client/connection` client API。
2. **ui-workspace 插槽与触发器**（`packages/client/ui-workspace`）：
   - 新增 `sidebar.workspaces.skillManager` 插槽孔；
   - 项目行 `⋯` 菜单新增“技能设置… / Skills…”入口（occupancy-gated，仅插件挂载时显示）；
   - 涉及 `contract/slots.ts`、`WorkspaceBrowser.tsx`、`rows/Rows.tsx`、`index.ts`、`locales.ts`。
3. **新宿主包 `@deepseek-ai/dsh-skill-config`**（`packages/skill/skill-config`）：manifest 读写、扫描、service。
4. **skill-filesystem / skill 增强**：项目级技能发现与配置支持。
5. **web-app 组合挂载**：`packages/bundle/web-app` 的 `cordis.patch.yml` + `package.json`（把该插件挂进 web 组合）。

## 这套改动的现状

- 完整改动（37 个文件 + 19 个未跟踪文件）目前保存在 `D:\deepseek-harness` 的 git stash `stash@{0}`
  （消息：`WIP: local dsh mods (auto-preserved before pulling latest dsh)`）。
- 从未提交、从未推送（既没推到你的插件仓库，也没推到 deepseek-ai 上游）。

## 推荐的多电脑方案：私有 fork 分支

1. 在 GitHub 上 fork `deepseek-ai/deepseek-harness`（或直接在你的私人仓库）。
2. 把 `D:\deepseek-harness` 的 stash 恢复成一个分支并推送到 fork：
   ```powershell
   cd /d D:\deepseek-harness
   git stash branch feat/skill-manager "stash@{0}"   # 基于旧基提交，之后 rebase 到最新
   # 把 rebase 到最新 rc.7 的冲突处理掉（改动集中在 apiproxy/skills、ui-workspace、skill-filesystem）
   git push -u <你的fork> feat/skill-manager
   ```
3. 每台电脑：
   ```powershell
   git clone <你的fork> D:\deepseek-harness
   git checkout feat/skill-manager
   corepack pnpm install
   corepack pnpm dsh web
   corepack pnpm dsh plugin --profile web add <本仓库>/dsh-skill-manager
   ```
4. 项目技能配置（`.dsh/skills.json`）随**项目 git 仓库**同步；全局技能（`~/.dsh/skills`）属机器级。

> 备选：不 fork，而是把上述宿主改动做成 `.patch` 文件，在每台电脑的 dsh 上手动 `git apply`。
> 缺点是随 dsh 升级会频繁冲突，仅适合短期。推荐 fork 分支方案。

## 与上游的关系

`@deepseek-ai/dsh-skill-config` 与相关 RPC 目前是未发布的 WIP。如果之后想贡献给上游，需要走
deepseek-ai/deepseek-harness 的 PR 流程（本仓库不包含任何 dsh 本体代码）。
