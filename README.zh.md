# DeepSeek Harness as Desktop（桌面客户端）

> 把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 变成 Codex 式桌面应用：原生 WebView2 窗口、系统托盘常驻、开机自启、真实 Windows Toast，并在 DSH Web 界面里新增一个 **桌面客户端** 设置页（含几选一皮肤中心）。

[English README](README.md)

## 功能

- 🖥️ **原生 WebView2 壳**（`DshDesktop.exe`，C# WinForms + WebView2，x64）——独立应用窗口内嵌 DSH Web UI。
- 🚀 **一键启动**——exe 检测后端（`127.0.0.1:3080`）；未运行时自动后台启动 `corepack pnpm dsh web`。
- 🧭 **托盘常驻**——最小化/关闭隐藏到系统托盘后台运行；托盘菜单"打开 / 退出"。仅当 exe 自己启动了服务时，退出才会一并停止服务。
- 🔁 **开机自启动**——可选 HKCU `Run` 注册。
- 🔔 **真实 Windows Toast**——任务完成通知进入操作中心（AUMID 注册的无包 Toast），失败回退托盘气泡。
- ⚙️ **DSH Web 设置里的"桌面客户端"tab**——管理关闭按钮行为、开机自启、会话通知、皮肤中心；已本地化（zh/en），跟随 DSH 语言切换。
- 🧩 **通用设置框架**——任意插件可用 `registerTab`/`registerItem`/`get`/`set`/`subscribe` 声明式添加设置 tab/条目，带持久化与跨插件同步（见 [docs/settings-framework.md](docs/settings-framework.md)）。
- 🎨 **几选一皮肤中心**——显示 DSH 内置默认 + 所有已装皮肤；选中后界面自动刷新，选择持久化保存。
- 🔌 **纯插件架构**——全部以 DSH 插件（`dsh-plugin`）形式分发。

## 目录结构

```
Deepseek-Harness-as-Desktop/
├── dsh-desktop-window/        # 宿主插件 + 桌面客户端
│   ├── lib/index.js           #   DSH 宿主插件：窗口拉起、turn/end Toast、皮肤清单
│   └── shell/                 #   DshDesktop.exe + 源码 + WebView2 SDK + Toast 脚本 + whale.ico
├── dsh-desktop-settings/      # 客户端插件：桌面客户端设置页（皮肤中心等）
├── dsh-settings-framework/   # 通用设置框架（tab/条目/同步），任何插件可用
└── docs/skin-compatibility.md # 第三方皮肤兼容约定
```

## 环境要求

- Windows 10/11（x64）
- Node.js 22.19+ 或 24+，corepack 启用的 pnpm
- Microsoft Edge WebView2 Runtime（多数系统已预装）
- 一份 DeepSeek Harness 源码检出

> **路径约定**：桌面客户端与插件**可重定位**——配置、数据、脚本路径均从
> 自身位置推导。唯一与机器相关的路径是 DeepSeek Harness 检出目录，默认为
> `D:\deepseek harness`，可通过 `config.json` 的 `serverWorkDir` 键按安装修改，
> 或每次启动用 `--workdir` 覆盖。

## 快速开始

1. **准备 harness**（一次性）：
   ```powershell
   git clone https://github.com/deepseek-ai/deepseek-harness.git "D:\deepseek harness"
   cd /d "D:\deepseek harness"
   corepack pnpm install
   corepack pnpm run build
   ```

2. **把应用放到任意位置**——复制 `dsh-desktop-window` 文件夹到任意位置
   （如 `D:\dsh-desktop-window`），双击 `dsh-desktop-window\shell\DshDesktop.exe`
   （或按下文从 `Program.cs` 编译）。它会按需拉起后端并打开原生窗口。

3. **安装插件**到 web profile：
   ```powershell
   cd /d "D:\deepseek harness"
   corepack pnpm dsh plugin --profile web add D:\dsh-desktop-window
   corepack pnpm dsh plugin --profile web add D:\dsh-desktop-settings
   ```
   重启桌面客户端，打开 **设置 → 桌面客户端** 配置选项与皮肤中心。\n   完成通知默认开启；"缩到托盘时显示提示"默认关闭（可在设置中开关）。

> 宿主插件（`dsh-desktop-window`）可选但推荐：负责 `turn/end` Toast 和皮肤清单
> `skins.json` 的刷新。桌面客户端自己启动后端时以 `DSH_DESKTOP_AUTO=0`
> 禁止插件重复弹窗。

## 配置

存储于 `D:\dsh-desktop-window\config.json`：

| 键 | 取值 | 说明 |
|---|---|---|
| `closeBehavior` | `tray`（默认）/ `exit` | 关闭按钮行为 |
| `autoStart` | `true` / `false` | 开机自启（HKCU Run） |
| `notifyOnComplete` | `true` / `false` | 任务（回合）完成时 Toast |
| `activeSkin` | 皮肤 id 或 `""` | 皮肤中心持久化选择（`""` = DSH 默认） |
| `apiPort` | `3980` | 本地配置 API 端口 |
| `serverWorkDir` | `D:\deepseek harness` | 作为后端启动的 Harness 检出目录；覆盖编译默认值（`--workdir` 参数优先级更高） |

设置页通过 exe 的本地 HTTP API（`127.0.0.1:3980`，CORS 开放）读写：

| 端点 | 说明 |
|---|---|
| `GET /api/config` | 读取配置 |
| `POST /api/config` `{key,value}` | 更新配置 |
| `GET /api/skins` | 皮肤清单（默认 + 已装皮肤） |
| `POST /api/notify` `{title,message}` | 发送真实 Windows Toast |
| `GET/POST /api/settings` `{key,value}` | 通用键值设置（框架后端） |

## 皮肤中心与皮肤兼容

设置页的**皮肤中心**是几选一选择器：DSH 内置默认 + 每个已安装皮肤插件。
选中后持久化 `activeSkin` 并自动刷新界面；每次启动只保持所选皮肤挂载。

第三方皮肤**不打包进本项目**。皮肤要出现在选择器中，需在其包旁提供
`skin.json` 并用 `dsh plugin --profile web add` 注册。完整约定见
[docs/skin-compatibility.md](docs/skin-compatibility.md)。

**推荐皮肤**

- [深海女仆工坊 / Abyssal Maid Atelier](https://github.com/Small-tailqwq/dsh-deep-whale)（作者 Small-tailqwq）——双女仆背景、深海蓝蕾丝界面、Q 版侧栏（CC BY-NC-SA 4.0）。安装：
  ```powershell
  git clone https://github.com/Small-tailqwq/dsh-deep-whale "D:\dsh-deep-whale"
  corepack pnpm dsh plugin --profile web add D:\dsh-deep-whale\maid-atelier
  ```

## 从源码编译壳

```
C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe /platform:x64 ^
  /win32icon:dsh-desktop-window\shell\whale.ico ^
  /resource:dsh-desktop-window\shell\whale.ico,DshDesktop.whale.ico ^
  /out:dsh-desktop-window\shell\DshDesktop.exe ^
  /r:dsh-desktop-window\shell\Microsoft.Web.WebView2.Core.dll ^
  /r:dsh-desktop-window\shell\Microsoft.Web.WebView2.WinForms.dll ^
  /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll ^
  dsh-desktop-window\shell\Program.cs
```

## 本地化

桌面客户端设置页通过 DSH 客户端 locale 服务注册 `zh`/`en` 词典，跟随 harness
语言切换；Toast 消息使用双语。

## 更新日志

见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证与第三方声明

- 本项目代码：MIT（[LICENSE](LICENSE)）。
- `Microsoft.Web.WebView2.Core.dll` / `WinForms.dll` / `WebView2Loader.dll`：
  [Microsoft Edge WebView2 SDK](https://www.nuget.org/packages/Microsoft.Web.WebView2)（MIT），按其许可再分发。
- `whale.ico`：DeepSeek 官方鲸鱼 logo（源自 harness 仓库
  `apps/web/public/favicon.svg`），仅用于标识 DeepSeek Harness 应用。
- 第三方皮肤（如深海女仆工坊）保留各自许可证，**不打包**。