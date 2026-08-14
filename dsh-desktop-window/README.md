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