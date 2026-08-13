# DeepSeek Harness as Desktop（桌面客户端）

> 把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 变成 Codex 式桌面应用：原生 WebView2 窗口、系统托盘常驻、开机自启、真实 Windows Toast，并附带一组 DSH 插件：桌面设置页、独立卡片式皮肤中心、可复用的右侧/底部面板框架、Git 图谱、文件/变更浏览、迷你终端与逐轮令牌统计。

[English README](README.md)

## 功能

- 🖥️ **原生 WebView2 壳**（`DshDesktop.exe`，C# WinForms + WebView2，x64）——独立应用窗口内嵌 DSH Web UI。
- 🚀 **一键启动**——exe 检测后端（`127.0.0.1:3080`）；未运行时自动后台启动 `corepack pnpm dsh web`。
- 🧭 **托盘常驻**——最小化/关闭隐藏到系统托盘后台运行；托盘菜单"打开 / 退出"。仅当 exe 自己启动了服务时，退出才会一并停止服务。
- 🔁 **开机自启动**——可选 HKCU `Run` 注册。
- 🔔 **真实 Windows Toast**——任务完成通知进入操作中心（AUMID 注册的无包 Toast），失败回退托盘气泡。
- ⚙️ **DSH Web 设置里的"桌面客户端"tab**——管理关闭按钮行为、开机自启、会话通知；已本地化（zh/en），跟随 DSH 语言切换。
- 🧩 **通用设置框架**——任意插件可用 `registerTab`/`registerItem`/`get`/`set`/`subscribe` 声明式添加设置 tab/条目，带持久化与跨插件同步（见 [docs/settings-framework.md](docs/settings-framework.md)）。
- 🎨 **独立皮肤中心**——独立的 **皮肤中心** 设置 tab（独立插件 `dsh-skin-gallery`）：每种皮肤一张卡片（左上角名称、中间大预览图、选中高亮、可滚动网格），包含 DSH 本体内置默认皮肤；切换后自动刷新并持久化。
- 📐 **右侧/底部面板框架**——通用面板框架（`dsh-panels-framework`）渲染右侧栏与底部栏，带 tab、一键折叠/展开把手、拖拽调宽、状态持久化；任意插件可注册面板 tab（见 [docs/panels-framework.md](docs/panels-framework.md)）。
- 📁 **文件与变更面板**——右侧面板 **文件** tab（文件树 + 文本/图片预览）与 **变更** tab（git status + stage/unstage/discard）。
- 💻 **迷你终端**——底部面板 **终端** tab：在 harness 目录执行命令（支持 `cd`），由桌面客户端后端驱动。
- 🌿 **Git 图谱视图**——对话视图新增第四个 tab（对话 / 轨迹 / **Git 图谱**）：分支选择器、切换分支、提交历史泳道图。
- ⚡ **实时令牌统计**——每条回答下方显示 TPS、LLM 耗时、输入/输出 token、缓存命中 token（提供商上报时）。
- 🔌 **纯插件架构**——全部以 DSH 插件（`dsh-plugin`）形式分发。

## 目录结构

```
Deepseek-Harness-as-Desktop/
├── dsh-desktop-window/        # 宿主插件 + 桌面客户端
│   ├── lib/index.js           #   DSH 宿主插件：窗口拉起、turn/end Toast、皮肤清单
│   └── shell/                 #   DshDesktop.exe + 源码 + WebView2 SDK + Toast 脚本 + whale.ico
├── dsh-desktop-settings/      # 客户端插件：桌面设置页（关闭行为/自启/通知）
├── dsh-settings-framework/    # 通用设置框架（tab/条目/同步），任何插件可用
├── dsh-skin-gallery/          # 独立卡片式皮肤中心（独立设置 tab）
├── dsh-panels-framework/      # 通用右侧/底部面板框架（壳 + 折叠展开 + 调宽）
├── dsh-right-panel/           # 文件/变更（右侧）+ 终端（底部）tab 与头部开关
├── dsh-git-graph/             # Git 图谱对话视图（分支选择 + 提交泳道）
├── dsh-live-stats/            # 逐轮令牌统计行
└── docs/                      # skin-compatibility / settings-framework / panels-framework
```

## 环境要求

- Windows 10/11（x64）
- Node.js 22.19+ 或 24+，corepack 启用的 pnpm
- Microsoft Edge WebView2 Runtime（多数系统已预装）
- 一份 DeepSeek Harness 源码检出

> **路径约定**：桌面客户端与插件**可重定位**——配置、数据、脚本路径均从
> 自身位置推导。唯一与机器相关的路径是 DeepSeek Harness 检出目录，默认为
> `D:\deepseek harness`，可通过 `config.json` 的 `serverWorkDir` 键按安装修改，
> 或用 `--workdir` 启动参数覆盖。

## 快速开始

1. **准备 Harness**（一次性）：
   ```powershell
   git clone https://github.com/deepseek-ai/deepseek-harness.git "D:\deepseek harness"
   cd /d "D:\deepseek harness"
   corepack pnpm install
   corepack pnpm run build
   ```

2. **放置应用**——把 `dsh-desktop-window` 文件夹复制到任意位置（如
   `D:\dsh-desktop-window`），双击 `dsh-desktop-window\shell\DshDesktop.exe`
   （或用 `Program.cs` 自行编译，见下文）。它会按需启动后端并打开原生窗口。

3. **安装插件**到 web profile（路径指向你放置的文件夹）：
   ```powershell
   cd /d "D:\deepseek harness"
   corepack pnpm dsh plugin --profile web add D:\dsh-desktop-window
   corepack pnpm dsh plugin --profile web add D:\dsh-desktop-settings
   corepack pnpm dsh plugin --profile web add D:\dsh-settings-framework
   corepack pnpm dsh plugin --profile web add D:\dsh-skin-gallery
   corepack pnpm dsh plugin --profile web add D:\dsh-panels-framework
   corepack pnpm dsh plugin --profile web add D:\dsh-right-panel
   corepack pnpm dsh plugin --profile web add D:\dsh-git-graph
   corepack pnpm dsh plugin --profile web add D:\dsh-live-stats
   ```
   重启桌面应用后：
   - **设置 → 桌面客户端**——关闭行为、开机自启、会话通知。
   - **设置 → 皮肤中心**——卡片式几选一皮肤，切换自动刷新。
   - 会话头部 **◧ ◨ ▤** 按钮——一键折叠/展开右侧面板与底部终端。
   - 对话标签——**对话 / 轨迹 / Git 图谱**。
   - 每条回答下方出现**实时令牌统计**。

> 宿主插件（`dsh-desktop-window`）可选但推荐：负责 `turn/end` Toast 与刷新
> `skins.json`。桌面应用自己启动后端时会通过 `DSH_DESKTOP_AUTO=0` 关闭重复开窗。

## 配置

配置保存在 `D:\dsh-desktop-window\config.json`：

| 键 | 取值 | 说明 |
|---|---|---|
| `closeBehavior` | `tray`（默认）/ `exit` | 关闭按钮行为 |
| `autoStart` | `true` / `false` | 开机自启动（HKCU Run） |
| `notifyOnComplete` | `true` / `false` | 任务完成 Toast |
| `activeSkin` | 皮肤 id 或 `""` | 皮肤中心选择（`""` = DSH 默认） |
| `apiPort` | `3980` | 本地配置 API 端口 |
| `serverWorkDir` | `D:\deepseek harness` | 作为后端启动的 Harness 检出目录 |
| `panelRightOpen` / `panelBottomOpen` | `true` / `false` | 面板开关状态（面板框架持久化） |
| `panelRightWidth` / `panelBottomHeight` | px | 面板尺寸（面板框架持久化） |

桌面设置页通过 exe 的本地 HTTP API（`127.0.0.1:3980`，CORS 开放）写入这些配置：

| 端点 | 说明 |
|---|---|
| `GET /api/config` | 读取配置 |
| `POST /api/config` `{key,value}` | 更新配置 |
| `GET /api/skins` | 皮肤清单（默认 + 已装皮肤） |
| `POST /api/notify` `{title,message}` | 发送真实 Windows Toast |
| `GET/POST /api/settings` `{key,value}` | 通用键值设置（框架后端） |
| `GET /api/fs/list?dir=` | 列目录（文件/文件夹 + 大小） |
| `GET /api/fs/read?path=` | 读取文本文件（图片返回 data URL 预览） |
| `GET /api/git/branches?dir=` | 分支列表 + 当前分支 |
| `GET /api/git/log?dir=&branch=&limit=` | 提交历史（hash/父提交/作者/日期/主题） |
| `GET /api/git/status?dir=` | Porcelain 状态（分支 + 变更） |
| `POST /api/git/checkout` `{dir,branch}` | 切换分支 |
| `POST /api/git/stage|unstage|discard` `{dir,path}` | 暂存/撤销/丢弃（`path` 为 `.` 表示全部） |
| `GET /api/shell/cwd` | 当前终端工作目录 |
| `POST /api/shell/exec` `{dir,command}` | 执行命令（cmd.exe）；`cd` 更新工作目录 |

## 皮肤中心与皮肤兼容

**皮肤中心**（独立设置 tab，`dsh-skin-gallery`）是几选一卡片选择器：DSH
本体内置默认 + 所有已装皮肤插件。每张卡片左上角为名称、中间为大预览图、
选中高亮边框，网格可滚动。选中后持久化 `activeSkin` 并自动刷新；每次启动
只保留选中的皮肤挂载。

第三方皮肤**不打进包里**。要让皮肤出现在选择器中，需在包旁提供 `skin.json`
并用 `dsh plugin --profile web add` 注册。完整约定见
[docs/skin-compatibility.md](docs/skin-compatibility.md)。

**推荐皮肤**

- [深海女仆工坊 / Abyssal Maid Atelier](https://github.com/Small-tailqwq/dsh-deep-whale)（Small-tailqwq，CC BY-NC-SA 4.0）——双女仆背景、深海蓝蕾丝 UI、Q 版侧栏。安装：
  ```powershell
  git clone https://github.com/Small-tailqwq/dsh-deep-whale "D:\dsh-deep-whale"
  corepack pnpm dsh plugin --profile web add D:\dsh-deep-whale\maid-atelier
  ```

## 面板（右侧栏 + 底部终端）

`dsh-panels-framework` 渲染面板壳；`dsh-right-panel` 注册 tab 与头部开关。
会话头部（模式选择旁）的 **◧ / ◨** 与 **▤** 按钮可一键折叠/展开右侧面板与
底部终端；折叠后变成右侧/底部的细长把手，点击即可展开。拖拽面板边缘可调整
大小；宽度/高度与开关状态都会持久化。其他插件也可注册自己的面板 tab
（见 [docs/panels-framework.md](docs/panels-framework.md)）。

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

所有 UI 插件通过 DSH 客户端 locale 服务注册 `zh`/`en` 词典，跟随 Harness 的
语言切换。Toast 消息双语。

## 更新日志

见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证与第三方声明

- 我们的代码：MIT（[LICENSE](LICENSE)）。
- `Microsoft.Web.WebView2.Core.dll` / `WinForms.dll` / `WebView2Loader.dll`：
  [Microsoft Edge WebView2 SDK](https://www.nuget.org/packages/Microsoft.Web.WebView2)（MIT），按许可再分发。
- `whale.ico`：DeepSeek 官方鲸鱼图标（衍生自 harness 仓库
  `apps/web/public/favicon.svg`），仅用于标识 DeepSeek Harness 应用。
- 第三方皮肤（如深海女仆工坊）保留各自许可证，**不随包分发**。