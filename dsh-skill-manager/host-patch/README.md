# host-patch：dsh 宿主支撑补丁（可选）

`dsh-skill-manager` 依赖的宿主能力（skill 管理 RPC、ui-workspace 插槽/行菜单入口、
`@deepseek-ai/dsh-skill-config` 包）**不在 stock dsh（含 0.1.0-rc.7）里**，所以插件必须搭配这份宿主补丁才能工作。

本目录提供**开箱即用的宿主补丁**，是否应用由你决定：

- **`patches/0001-feat-skill-manager-host.patch`**：一个补丁文件 = 基于 dsh `0.1.0-rc.7` 的
  `feat/skill-manager` 分支的全部改动（63 个文件，+3125/-29）。已在 rc.7 上 3-way 验证**零冲突应用**。
- **`apply.ps1`**：一键应用脚本（先 `git apply --check` 再 `git apply`，工作树有未提交改动时拒绝执行，避免覆盖你的工作）。

## 使用方法

```powershell
# 1) 确保 dsh checkout 干净（git status 无未提交改动）
# 2) 应用宿主补丁
powershell -ExecutionPolicy Bypass -File .\dsh-skill-manager\host-patch\apply.ps1 -DshDir D:\deepseek-harness
# 3) 重启 dsh 并安装插件
corepack pnpm dsh web
corepack pnpm dsh plugin --profile web add <本仓库>\dsh-skill-manager
```

应用后：项目级技能配置（`.dsh/skills.json`）随**项目 git 仓库**同步；每台电脑装插件 + 打补丁即可。

## 两种路线对比

| 方案 | 做法 | 适合 |
|---|---|---|
| **A. 补丁**（本目录） | 每台电脑 `apply.ps1` 打补丁 | 少量电脑、想保持 dsh 官方仓库干净 |
| **B. fork 分支** | 把 `feat/skill-manager` 分支推到自己的 deepseek-harness fork，每台电脑 clone | 多台电脑、长期维护 |

> 提示：dsh 升级后补丁可能冲突，需重新生成。生成方式：`git format-patch origin/master..feat/skill-manager`。
