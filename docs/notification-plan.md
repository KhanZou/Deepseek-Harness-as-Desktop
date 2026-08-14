# DSH Windows 通知优化 — 调研与修改计划（v2：严格限定插件仓库）

> 状态：进一步调研完成。**改动范围只限三个自有插件仓库**：
> `dsh-desktop-framework`、`dsh-desktop-settings`、`dsh-desktop-window`（含其 `shell/` 下自有的 C# 源码 `Program.cs`、`toast.ps1`、`ShortcutAppId.cs`、`config.json`）。
> **deepseek-harness（dsh 本体，`D:\deepseek-harness`）零改动**：仅作只读参考；运行时只调用 dsh 已经公开给浏览器的官方接口（`/api/session.prompt`、`/api/respond`、`/api/events.mux`），这些接口本就无鉴权、面向本地浏览器，我们不修改 dsh 任何文件。

## 0. 范围边界与代码位置

| 归属 | 路径（仓库内） | 角色 |
|---|---|---|
| ✅ 改 | `dsh-desktop-window/lib/index.js` | 宿主插件：通知编排（预览 fold、mux 订阅、调 exe API） |
| ✅ 改 | `dsh-desktop-window/shell/Program.cs` | C# 外壳：HTTP API 3980、交互 toast、激活处理、调 dsh 官方 /api |
| ✅ 改 | `dsh-desktop-window/shell/toast.ps1` | WinRT Toast：按 kind 生成交互式 XML |
| ✅ 改 | `dsh-desktop-window/shell/ShortcutAppId.cs` | 快捷方式 AUMID + 新增 ToastActivatorCLSID |
| ✅ 改 | `dsh-desktop-window/config.json` + ConfigStore | 新配置项持久化（notifyPreview / quickReply / approvalNotify 等） |
| ✅ 改 | `dsh-desktop-settings/lib/client.js` | 设置 UI：Desktop tab 新增开关与测试按钮 |
| ✅ 改（可选） | `dsh-desktop-framework/lib/client.js` | 右侧面板新增“通知中心”tab（历史/测试），复用 __DSH_PANELS__ |
| ✅ 改（可选） | `dsh-desktop-framework/cli.js` | 测试 CLI：notify / notify-approval 命令 |
| ❌ 只读 | `D:\deepseek-harness\packages\...` | 仅调研参考，不修改、不打包进插件 |

## 1. 三个插件内部结构（进一步调研结论）

### 1.1 dsh-desktop-window（宿主插件 + 原生外壳）——通知功能的主战场
- `lib/index.js`（ESM 宿主插件，纯 node 内置模块，**零 dsh 依赖**）：
  - 现有：`ctx.on('session/event')` 监听 `turn/end` → `notifyWindows()` → `POST http://127.0.0.1:3980/api/notify {title,message}`；`readConfig()` 直接读 `config.json`；皮肤扫描写 `skins.json`；拉窗。
  - 能力：宿主上下文可访问 `session` 对象（`session.events` 完整日志）、`ctx.agents`/`ctx.sessions`（如需进程内 followup），node v24 自带 `fetch` 与全局 `WebSocket`。
- `shell/Program.cs`（C# WinForms + WebView2）：
  - 单实例 `Mutex`；本地 HTTP API（`TcpListener` 绑 127.0.0.1:3980，CORS 开放）；`/api/notify` → `ShowToast` → `.toast.json` → `toast.ps1` → 失败回退 `ShowBalloon`；配置 `ConfigStore`（config.json）；`/api/settings`、`/api/config`、fs/git/shell 等 API。
  - 编译：csc.exe（.NET Framework 4.0，无 NuGet）——COM 激活器用 `System.Runtime.InteropServices`（mscorlib 自带）可行。
- `shell/toast.ps1`：WinRT `ToastNotificationManager`，AUMID `DeepSeekHarness.Desktop`，**当前纯文本、无按钮/输入/回调**。
- `shell/ShortcutAppId.cs`：给开始菜单快捷方式写 AUMID。

### 1.2 dsh-desktop-settings（浏览器客户端插件）
- `lib/client.js`：通过 `window.__DSH_SETTINGS__.registerTab({id:'desktop',...})` + `registerItem`（type: toggle/select/action/custom）注册“桌面客户端”tab；数据经 `http://127.0.0.1:3980/api/settings` 读写（后端 ConfigStore 持久化到 config.json）。已有 `notifyOnComplete`、`testNotify`。
- `lib/index.js`：空宿主入口（行为全在浏览器侧）。

### 1.3 dsh-desktop-framework（浏览器客户端框架）
- `lib/client.js`：
  - 设置框架 `window.__DSH_SETTINGS__`：`registerTab/registerItem/ready/get/set`（tab 经 `ctx.slots.inject("settings.section", ...)` 挂到原生设置面板之下）。
  - 面板框架 `window.__DSH_PANELS__`：`registerPanel/addTab/removeTab/open/close/toggle/setTab/setSize/getState/subscribe/notify` —— 支持新增右侧面板 tab。
  - Files / Changes / Terminal tab 与会话头折叠按钮。
- `cli.js`：测试 CLI（`check`、`raw`、`open`、`open-url`、`settings`、`type`、`samples`）。
- `lib/index.js`：空宿主入口。

### 1.4 能力边界（决定代码放哪）
- **宿主级能力只在宿主插件可用**：`session/event`、`agent.followup`、approval 相关事件、以及访问 dsh 后端 3080 的 `/api/*` 与 `ws://.../api/events.mux` —— 全部放进 `dsh-desktop-window/lib/index.js`（宿主）。
- **浏览器客户端插件**（framework/settings）只能：注入 slots（设置 tab、面板 tab）+ 调 exe 3980 API。→ 设置开关 UI 放 `dsh-desktop-settings`，可选“通知中心”tab 放 `dsh-desktop-framework`。
- **原生动作**（toast 渲染、激活、调后端 /api）放 `dsh-desktop-window/shell`。

## 2. 需求 → 文件映射（改动清单）

| 需求 | 插件 / 文件 | 改动内容 |
|---|---|---|
| 回答预览 | `dsh-desktop-window/lib/index.js` | 新增纯 fold（turn/start、assistant/message 文本块、tool/call、turn/end → {turn, reason, body, tools}）；`/api/notify` payload 扩展 `{kind:'turn', sessionId, turn, reason, tools, message:预览}` |
| | `dsh-desktop-window/shell/Program.cs` | `/api/notify` 解析扩展字段；`ShowToast` 传结构化 payload 给 `.toast.json` |
| | `dsh-desktop-window/shell/toast.ps1` | kind=turn：标题按 reason 映射（完成/出错/中断/阻塞/达上限/会话中断），正文=预览（截断，默认 300 字符），可附工具列表行 |
| 快捷回复 | `toast.ps1` | `<input id="reply" type="text"/>` + `<action content="回复" arguments="action=reply&session=<id>" activationType="foreground"/>` |
| | `Program.cs` | 激活解析：reply → `POST http://127.0.0.1:3080/api/session.prompt`（mode=queue）→ 聚焦窗口；`/api/toast-action` 单实例转发 |
| | `ShortcutAppId.cs` | 增加 `System.AppUserModel.ToastActivatorCLSID`（固定 GUID） |
| | `Program.cs`（Phase 2） | COM 激活器 `INotificationActivationCallback`（`[ComImport]` + `RegistrationServices.RegisterTypeForComClients`），读取输入框文本 |
| 权限通知 | `dsh-desktop-window/lib/index.js` | 订阅 `ws://127.0.0.1:3080/api/events.mux`；`approval/requested` → 按 callId 从 `session.events` 取 `tool/call` 参数摘要 → `/api/notify {kind:'approval', sessionId, approvalId, rpcId, toolName, reason, args摘要}`；`approval/resolved` → `/api/dismiss` 清理 |
| | `Program.cs` | `/api/dismiss`（toast.ps1 按 tag 移除）；approve/reject → `POST http://127.0.0.1:3080/api/respond` |
| | `toast.ps1` | kind=approval：标题“DeepSeek Harness 请求权限”，正文=工具/原因/参数，按钮 批准一次 / 拒绝 |
| 设置长期化 | `dsh-desktop-settings/lib/client.js` | Desktop tab 新增 `notifyPreview`、`quickReply`、`approvalNotify`（toggle）+“发送带按钮测试通知”（action） |
| | `Program.cs` ConfigStore / `config.json` | 新字段读写与默认值 |
| 通知中心（可选） | `dsh-desktop-framework/lib/client.js` | `__DSH_PANELS__.registerPanel` + `addTab` 加“通知”tab：最近通知历史（经 exe `GET /api/notify-log`，可选） |
| 测试 CLI（可选） | `dsh-desktop-framework/cli.js` | `notify`（发送带预览/按钮的测试 toast）、`notify-approval` 等命令 |

## 3. 实现细节（按插件拆分）

### 3.1 dsh-desktop-window —— 主体
1. `lib/index.js` 新增：
   - `foldTurnPreview(state, event, maxChars)`：参考 `omdsh-dev/dsh-notification/src/projection.ts` 的纯 fold（已 clone 到 `work/research-notification/`），只读消费 `session/event`，不写任何 dsh 状态。
   - `connectMux(webUrl)`：node 全局 `WebSocket('ws://127.0.0.1:3080/api/events.mux')`，断线重连；解析 `ServerRequest` 信封，匹配 `payload.type === 'approval/requested'` / `'approval/resolved'`；用 `session.events` 反查 `tool/call` 的 `arguments`。
   - `notifyWindows` 扩展 payload；新增 `dismissToast(tag)` 调 exe `/api/dismiss`。
   - 全部行为受 `readConfig()` 开关控制（`notifyPreview/quickReply/approvalNotify`），与现有 `notifyOnComplete` 同机制。
2. `shell/Program.cs`：
   - `/api/notify` 接收结构化 payload 并存进 `.toast.json`（新增 kind/sessionId/turn/reason/tools/rpcId/approvalId/args 等字段）。
   - `ShowToast` 改为向 toast.ps1 传 JSON；`ShowBalloon` 保持回退。
   - 新增 `/api/toast-action`（POST）：解析 action → reply/approve/reject → 调 dsh 后端。
   - 新增 `/api/dismiss`（POST {tag}）→ toast.ps1 `-dismiss` 模式 → `ToastNotificationManager.history.remove(tag, group, AppId)`。
   - 新增 `PostJson(url, obj)`（`HttpWebRequest`，.NET Framework 自带）用于调 3080 的 `/api/session.prompt`、`/api/respond`。
   - `Program.Main`：解析 toast 激活参数（`--toast=<urlencoded json>` 或 `-ToastActivated` + COM）；`createdNew=false` 时转发到运行中实例的 `/api/toast-action`（重试若干次）后退出；冷启动则入队由 `MainForm` 处理。
3. `shell/toast.ps1`：按 `kind` 组装 XML（turn：预览 + input + 回复；approval：权限内容 + 批准/拒绝）；参数经 `.toast.json` 传入；保留 AUMID 快捷方式逻辑。
4. `shell/ShortcutAppId.cs`：写 AUMID 的同时写 `ToastActivatorCLSID`。
5. `config.json` 新增：`notifyPreview:true`、`quickReply:true`、`approvalNotify:true`、`previewMaxChars:300`、`approvalTimeoutSec:600`。

### 3.2 dsh-desktop-settings —— 设置 UI
- `lib/client.js` 的 Desktop tab `registerItem` 追加：
  - `notifyPreview`（toggle，默认 true）
  - `quickReply`（toggle，默认 true）
  - `approvalNotify`（toggle，默认 true）
  - `previewMaxChars`（select：200/300/500，默认 300）
  - `testNotifyAdvanced`（action：发送“带预览 + 回复输入框 + 按钮”的测试 toast）
- 复用现有 `fetchJson(API + "/api/settings", ...)` 持久化链路（ConfigStore → config.json）。

### 3.3 dsh-desktop-framework —— 通知中心 tab（可选）+ CLI
- `lib/client.js`：`whenPanels(P => P.registerPanel({...}) + P.addTab({side:'right', id:'notifications', label:'通知', render}))`；数据源用 exe 新增的 `GET /api/notify-log`（内存环形缓冲，最近 N 条），支持“发送测试通知”。
- `cli.js`：`notify`、`notify-approval` 子命令，方便无 GUI 验证（符合用户“加 CLI 方便测试”的既有要求）。

## 4. 关键协议（已在 dsh 只读源码核实，运行时不改 dsh）

- **回答预览数据**：`session/event` 的 `assistant/message`（`event.data.message.content[]` 的 `{type:'text',text}` 块）、`turn/end`（`event.data.turn`、`event.data.reason.kind` ∈ completed/aborted/blocked/error/max-tokens/interrupted）、`tool/call`（`{turn,step,callId,name,arguments}`）。
- **快捷回复**：`POST http://127.0.0.1:3080/api/session.prompt`，body=`{"type":"client-request","rpcId":"<uuid>","method":"session.prompt","payload":{"sessionId":"…","mode":"queue","content":[{"type":"text","text":"…"}]}}` → `{"type":"server-response","rpcId":"…","result":{"ok":true,"value":{"accepted":true}}}`。loopback Host + 无 Origin 即通过 trust fence（`api-request-trust.ts`），无鉴权。
- **权限审批**：sandbox 工具升级 → `ctx.approval.request({agent, toolName, callId, reason, signal})` → 会话事件 `approval/asked` → waterfall `approval/request` → api-proxy 广播 mux 帧 `approval/requested`（envelope 的 `rpcId` 即应答键）→ 应答 `POST http://127.0.0.1:3080/api/respond`，body=`{"type":"client-response","rpcId":<帧 rpcId>,"result":{"ok":true,"value":{"sessionId":"…","approvalId":"…","outcome":"allowed-once"|"rejected"}}}`。
- **事件流**：`ws://127.0.0.1:3080/api/events.mux`，帧为 `ServerRequest` 信封 `{"type":"server-request","rpcId","method","payload"}`。

## 5. 相关插件调研结论（压缩）

| 插件 | 做法 | 与本需求差距 |
|---|---|---|
| omdsh-dev/dsh-notification | 宿主 projection + 浏览器 Notification API；按 outcome 控制 + 关键词规则 | 无原生 toast、无预览、无交互 |
| qing3a/dsh-tray | 托盘 exe 宿主 + 气泡 | 无完成通知内容 |
| myYangyunfan/dsh_desktop v0.2.0 | 会话完成系统 toast，点击聚焦窗口 | 无预览、无快捷回复、无权限审批 |

结论：生态无同类实现；本方案在自有插件内走原生交互式 Windows Toast，属首创。可借鉴 dsh-notification 的预览 fold 写法（纯函数，MIT 许可）。

## 6. 风险与分级实施

1. **交互式 toast 激活（COM）** 是最大风险：unpackaged 应用在 Win10/11 不同构建行为有差异；输入框文本只能经 COM 激活器回调（命令行只带按钮 arguments，不带输入值）。→ **Phase 1**：按钮级激活（AUMID + ToastActivatorCLSID + 命令行转发 + /api/toast-action），批准/拒绝完整可用，回复按钮先聚焦窗口；**Phase 2**：COM 激活器（`[ComImport] INotificationActivationCallback` + `RegistrationServices`），实现通知内输入回复。实施时必须在目标机实测两种路径。
2. **mux 订阅**：需断线重连；`approval/requested` 的 rpcId 是应答关键，必须完整透传 exe。
3. **双提示**（浏览器卡片 + toast）：先到先得（api-proxy pending 命中即 resolve），`approval/resolved` 清理 toast，可接受。
4. **兼容性**：只读消费 dsh 事件与 /api，宽容解析未知字段，避免与 dsh 版本演进耦合。
5. 解释性说明：本计划将“deepseek 请求权限”实现为 **sandbox 权限升级审批（approval/asked → approval/requested → respond）**；侧边栏 PermissionSelect（permission/preset 模式切换）属另一机制，不在本次范围。

## 7. 测试、验证、文档与发布

- 纯函数单测：预览 fold（移植 dsh-notification 测试思路到 `dsh-desktop-window` 或 `dsh-desktop-framework/cli.js` 自检）。
- 端到端（Playwright headless + exe 进程 + 手工点 toast）：
  - 一轮回答完成 → toast 带预览；回复 → `session.prompt` accepted → 会话出现新 user 消息。
  - 触发 sandbox 升级（模型请求 `sandbox_permissions`）→ toast 带权限内容 → 点批准/拒绝 → `approval/decided` 落库、工具放行/拒绝。
  - 冷启动与运行中两种 toast 激活路径。
- 全量 UI 回归（面板、皮肤、设置长期化不回归）。
- 同步 `D:\dsh-desktop`；更新 `README.md` / `README.zh.md` / `CHANGELOG.md`；`git push` 到 GitHub（KhanZou/Deepseek-Harness-as-Desktop）。
