# dsh-desktop-window（DeepSeek Harness 桌面客户端）

"Codex 式"桌面入口：双击启动后自动拉起 DSH 后台服务，原生 WebView2 窗口显示 Web UI，支持托盘常驻、开机自启、会话完成通知，并暴露本地配置/文件/Git/终端 API 供 Web 插件调用。

## 使用

- 双击 `D:\dsh-desktop-window\shell\DshDesktop.exe`（或桌面快捷方式）。
- 关闭按钮行为、开机自启、会话通知：在 DSH Web 界面的 **设置 → 桌面客户端** 中配置（界面文案跟随 DSH 语言切换 zh/en）。
- 皮肤切换：**设置 → 皮肤中心**（`dsh-skin-gallery` 插件）。
- 右侧面板 / 底部终端：会话头部 **◧ ◨ ▤** 按钮一键折叠展开（`dsh-desktop-framework` 插件）。
- 托盘右键 → 打开 / 退出（退出会停止本程序启动的服务）。

## 本地 API（Web 插件调用，CORS 开放，127.0.0.1:3980）

| 端点 | 说明 |
|---|---|
| `GET /api/config` | 读取配置 |
| `POST /api/config` `{key,value}` | 更新配置（closeBehavior / autoStart / notifyOnComplete / activeSkin …） |
| `GET /api/skins` | 读取皮肤清单（宿主插件扫描生成 `skins.json`） |
| `POST /api/notify` `{title,message}` | 发送真实 Windows Toast（通知中心可见，失败回退托盘气泡） |
| `GET /api/settings` / `POST /api/settings` `{key,value}` | 通用键值设置（设置框架后端，合并视图） |
| `GET /api/fs/list?dir=` | 列目录（文件/文件夹 + 大小） |
| `GET /api/fs/read?path=` | 读取文本文件（图片返回 data URL 预览） |
| `GET /serve/<url-encoded path>` | 本地网页服务：以相对路径解析方式提供 HTML 及其 css/js/图片资源 |
| `GET /api/git/branches?dir=` | 分支列表 + 当前分支 |
| `GET /api/git/log?dir=&branch=&limit=` | 提交历史（hash/父提交/作者/日期/主题） |
| `GET /api/git/status?dir=` | Porcelain 状态（分支 + 变更） |
| `POST /api/git/checkout` `{dir,branch}` | 切换分支 |
| `POST /api/git/stage\|unstage\|discard` `{dir,path}` | 暂存/撤销暂存/丢弃（`path` 为 `.` 表示全部） |
| `GET /api/shell/cwd` | 当前终端工作目录 |
| `POST /api/shell/exec` `{dir,command}` | 执行命令（cmd.exe）；`cd` 更新工作目录 |

配置持久化在 `D:\dsh-desktop-window\config.json`；开机自启通过 HKCU Run 注册表键实现。

## 目录

| 路径 | 说明 |
|---|---|
| `shell\DshDesktop.exe` | 桌面客户端（C# WinForms + WebView2，x64） |
| `shell\whale.ico` | DeepSeek 鲸鱼多尺寸图标 |
| `shell\Program.cs` | 源码（csc.exe 编译，需引用 WebView2 dll 与 System.Web.Extensions.dll） |
| `lib\index.js` | DSH 宿主插件：窗口拉起 + `turn/end` 通知 + 皮肤扫描 |
| `.wv2-profile\` | WebView2 用户数据 |
| `config.json` | 桌面客户端配置 |
| `skins.json` | 皮肤清单（宿主插件自动刷新） |

## 命令行参数

```
DshDesktop.exe [--url http://127.0.0.1:3080] [--width 1440] [--height 900] [--port 3080] [--workdir "D:\deepseek harness"] [--user-data ...]
```

## 重新编译

```
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe /platform:x64 ^
  /win32icon:D:\dsh-desktop-window\shell\whale.ico ^
  /resource:D:\dsh-desktop-window\shell\whale.ico,DshDesktop.whale.ico ^
  /out:D:\dsh-desktop-window\shell\DshDesktop.exe ^
  /r:D:\dsh-desktop-window\shell\Microsoft.Web.WebView2.Core.dll ^
  /r:D:\dsh-desktop-window\shell\Microsoft.Web.WebView2.WinForms.dll ^
  /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll ^
  D:\dsh-desktop-window\shell\Program.cs
```

许可证：客户端代码 MIT；鲸鱼图标为 DeepSeek 官方品牌图标（仅个人使用）。

## 通知功能（v0.8.0）

- **回答预览**：会话完成通知显示本轮实际回答摘要（由 `assistant/message` 文本折叠，按 `previewMaxChars` 截断），标题按结束原因映射（完成/出错/中断/阻塞/达上限/会话中断），并列出调用过的工具。
- **通知内快捷回复**：完成通知带输入框与“回复”按钮，点击后把输入内容经 dsh 官方 `POST /api/session.prompt`（queue 模式）发送到同一会话；若通知内输入不可用（COM 激活未生效），回复按钮退化为聚焦窗口。
- **权限请求通知**：沙箱权限升级（approval 流程）弹出带“允许一次 / 拒绝”按钮的通知，应答经官方 `POST /api/respond` 提交；宿主插件以只读方式订阅 `ws://<web>/api/events.mux` 获取审批帧（含应答所需的 rpcId），按 `approval/resolved` 自动清理已处理的 toast。
- **交互式 toast 激活**：开始菜单快捷方式写入 `ToastActivatorCLSID`；点击 toast 按钮时 Windows 以 `toast=<urlencoded json>` 参数启动 `DshDesktop.exe`，已有实例时转发到其 `POST /api/toast-action` 处理；输入框文本经 COM 激活器（`INotificationActivationCallback`）读取。
- **新增/变更 API**：
  - `POST /api/notify`：payload 扩展为结构化对象（`kind: basic|turn|approval`，及 `sessionId/turn/reason/tools/approvalId/rpcId/toolName/args/tag/group/quickReply/replyLabel/replyPlaceholder/approveLabel/rejectLabel`）。
  - `POST /api/toast-action`：接收 `{action: reply|approve|reject|open, sessionId, rpcId, approvalId, text}`，由 exe 调用后端 `/api/session.prompt` 或 `/api/respond`。
  - `POST /api/dismiss`：`{tag, group}` 按 tag 移除通知中心中的 toast。
- **新增配置项**（`config.json`）：`notifyPreview`（默认 true）、`quickReply`（默认 true）、`approvalNotify`（默认 true）、`previewMaxChars`（默认 300）、`approvalTimeoutSec`（默认 600）。
