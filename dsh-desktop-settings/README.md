# dsh-desktop-settings（DSH 设置菜单扩展插件）

给 DeepSeek Harness Web 设置面板新增一个 **"桌面客户端"** tab，管理桌面客户端选项与皮肤。

## 功能

- **关闭窗口按钮行为**：最小化到托盘（推荐）/ 直接退出并停止服务
- **开机自启动**：登录 Windows 自动启动桌面客户端并拉起服务（写 HKCU Run）
- **会话完成通知**：后台任务完成一轮回答时发送真实 Windows Toast（宿主插件监听 `turn/end` 事件触发，经 DshDesktop.exe 的 AUMID Toast 通道）
- **皮肤一键切换**：列出已安装皮肤（名称/预览），通过 cordis 运行时挂载/卸载皮肤 `apply()` 实现启用/停用，即时生效无需重启
- 附带"发送测试通知"按钮

## 原理

- 浏览器端（`lib/client.js`）：纯 JS + React.createElement，只 require 平台 seed 模块（`react`、`@deepseek-ai/dsh-client-ui-slots`），通过 `ctx.slots.inject("settings.section", ...)` 注册设置页。
- 数据通路：设置页 → `http://127.0.0.1:3980/api/config`（DshDesktop.exe 本地 API）→ `config.json` / 注册表。
- 皮肤清单：`dsh-desktop-window` 宿主插件扫描已装皮肤写入 `skins.json`，设置页经 `/api/skins` 读取。

## 安装

```powershell
cd /d "D:\deepseek harness"
corepack pnpm dsh plugin --profile web add D:\dsh-desktop-settings
```

重启桌面客户端即可生效。

## 说明

- 仅在通过 DshDesktop.exe 打开时可用（依赖其本地 API）；普通浏览器打开 DSH 时该 tab 会提示不可用。
- 界面文案已本地化，随 DSH 语言（zh/en）自动切换。\n- 皮肤中心为几选一：切换后写入 `activeSkin` 并刷新；启动时只保持所选皮肤挂载，其余皮肤 bundle 会被释放。