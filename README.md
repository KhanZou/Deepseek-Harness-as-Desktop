# DeepSeek Harness as Desktop

> Turn [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) into a Codex-style desktop app: a native WebView2 shell, system-tray residency, auto-start on logon, real Windows toasts, and a set of DSH plugins that add a desktop settings tab, a standalone card-based skin center, reusable right/bottom panels, a Git graph, file/SCM browsing, a mini terminal, and per-turn token statistics.

[中文文档](README.zh.md)

## Features

- 🖥️ **Native WebView2 shell** (`DshDesktop.exe`, C# WinForms + WebView2, x64) — embeds the DSH Web UI in a standalone app window.
- 🚀 **One-click launch** — the exe detects the backend (`127.0.0.1:3080`); if it is not running, it starts `corepack pnpm dsh web` in the background automatically.
- 🧭 **System tray residency** — closing/minimizing hides to tray and keeps running in the background; tray menu *Open / Exit*. *Exit* stops the backend only if this exe started it.
- 🔁 **Launch at logon** — optional HKCU `Run` key registration.
- 🔔 **Real Windows toasts** — task-completion notifications appear in the Action Center (AUMID-registered unpackaged toast), with tray-balloon fallback.
- ⚙️ **Desktop settings tab** — a **Desktop** section in *Settings* manages close-button behavior, auto-start, and notifications. Localized (zh/en), follows the DSH language switcher.
- 🧩 **Generic settings framework** — any plugin can add Settings tabs/items declaratively (`registerTab`/`registerItem`/`get`/`set`/`subscribe`) with persistence and cross-plugin sync (see [docs/settings-framework.md](docs/settings-framework.md)).
- 🎨 **Standalone skin center** — a separate **Skin Center** Settings tab (its own plugin) shows one card per skin: name top-left, large preview in the middle, highlighted selection, scrollable grid. Includes the DSH built-in default; switching persists and auto-refreshes.
- 📐 **Right/bottom panels framework** — a generic panel framework (`dsh-panels-framework`) that renders a right column and a bottom bar with tabs, one-click collapse/expand rails, drag-to-resize, and persisted state. Any plugin can register tabs (see [docs/panels-framework.md](docs/panels-framework.md)).
- 📁 **Files & SCM panel** — a **Files** tab (file tree + text/image preview) and a **Changes** tab (git status with stage/unstage/discard) in the right panel.
- 💻 **Mini terminal** — a **Terminal** tab in the bottom panel: run commands in the harness directory (`cd` supported), backed by the desktop client.
- 🌿 **Git Graph view** — a fourth conversation view tab (beside *Chat* / *Trajectory*) with a branch selector, checkout, and a commit-history swimlane graph.
- ⚡ **Live token stats** — a compact per-turn line under each completed answer showing TPS, LLM wall time, input/output tokens and cache-hit tokens (when the provider reports them).
- 🔌 **Plugin-only architecture** — everything is distributed as DSH plugins (`dsh-plugin`).

## Repository layout

```
Deepseek-Harness-as-Desktop/
├── dsh-desktop-window/        # Host plugin + desktop client
│   ├── lib/index.js           #   DSH host plugin: window launch, turn/end toast, skin manifest
│   └── shell/                 #   DshDesktop.exe + source + WebView2 SDK + toast scripts + whale.ico
├── dsh-desktop-settings/      # Client plugin: Desktop settings tab (close behavior, auto-start, notify)
├── dsh-settings-framework/    # Generic settings framework (tabs/items/sync) for any plugin
├── dsh-skin-gallery/          # Standalone card-based skin center (own Settings tab)
├── dsh-panels-framework/      # Generic right/bottom panel framework (shells + collapse/expand + resize)
├── dsh-right-panel/           # Files / Changes (right) and Terminal (bottom) tabs + header toggles
├── dsh-git-graph/             # Git Graph conversation view (branch selector + commit swimlanes)
├── dsh-live-stats/            # Per-turn token statistics line
└── docs/                      # skin-compatibility, settings-framework, panels-framework
```

## Requirements

- Windows 10/11 (x64)
- [Node.js](https://nodejs.org) 22.19+ or 24+ and corepack-enabled pnpm
- Microsoft Edge WebView2 Runtime (preinstalled on most systems)
- A DeepSeek Harness checkout

> **Path assumptions:** the desktop app and plugins are **relocatable** — they
> derive config, data, and script paths from their own location. The only
> machine-specific path is the DeepSeek Harness checkout, which defaults to
> `D:\deepseek harness` and can be changed per-install via the `serverWorkDir`
> key in `config.json`, or per-launch with `--workdir`.

## Quick start

1. **Prepare the harness** (one time):
   ```powershell
   git clone https://github.com/deepseek-ai/deepseek-harness.git "D:\deepseek harness"
   cd /d "D:\deepseek harness"
   corepack pnpm install
   corepack pnpm run build
   ```

2. **Place the app anywhere** — copy the `dsh-desktop-window` folder anywhere
   (e.g. `D:\dsh-desktop-window`) and double-click
   `dsh-desktop-window\shell\DshDesktop.exe` (or build it from `Program.cs` — see
   below). It starts the backend if needed and opens the DSH UI in a native window.

3. **Install the plugins** into the web profile (point the paths at where you
   put the folders):
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
   Restart the desktop app. Then:
   - **Settings → Desktop** — close behavior, auto-start, notifications.
   - **Settings → Skin Center** — pick one skin (card grid); the UI refreshes.
   - Session header **◧ ◨ ▤** buttons — collapse/expand the right panel and the bottom terminal.
   - Conversation tabs — **Chat / Trajectory / Git Graph**.
   - After each answer, a **live token stats** line appears under the turn.

> The host plugin (`dsh-desktop-window`) is optional but recommended: it sends
> `turn/end` toasts and keeps `skins.json` fresh for the skin center. The
> desktop app disables its own auto-open via `DSH_DESKTOP_AUTO=0` when it
> starts the backend itself.

## Configuration

Stored in `D:\dsh-desktop-window\config.json`:

| Key | Values | Description |
|---|---|---|
| `closeBehavior` | `tray` (default) / `exit` | Close-button behavior |
| `autoStart` | `true` / `false` | Launch at logon (HKCU Run) |
| `notifyOnComplete` | `true` / `false` | Toast on task (turn) completion |
| `activeSkin` | skin id or `""` | Persisted skin-center selection (`""` = DSH default) |
| `apiPort` | `3980` | Local config API port |
| `serverWorkDir` | `D:\deepseek harness` | Harness checkout to start as the backend; overrides the compiled default (`--workdir` arg wins) |
| `panelRightOpen` / `panelBottomOpen` | `true` / `false` | Persisted panel open state (panels framework) |
| `panelRightWidth` / `panelBottomHeight` | px | Persisted panel sizes (panels framework) |

The Desktop settings tab writes these through the exe's local HTTP API
(`127.0.0.1:3980`, CORS-open):

| Endpoint | Description |
|---|---|
| `GET /api/config` | Read config |
| `POST /api/config` `{key,value}` | Update config |
| `GET /api/skins` | Skin manifest (default + installed skins) |
| `POST /api/notify` `{title,message}` | Send a real Windows toast |
| `GET/POST /api/settings` `{key,value}` | Generic key-value settings (framework backend) |
| `GET /api/fs/list?dir=` | List a directory (files + folders, sizes) |
| `GET /api/fs/read?path=` | Read a text file (or image preview as data URL) |
| `GET /api/git/branches?dir=` | List branches + current |
| `GET /api/git/log?dir=&branch=&limit=` | Commit log (hash, parents, author, date, subject) |
| `GET /api/git/status?dir=` | Porcelain status (branch + changes) |
| `POST /api/git/checkout` `{dir,branch}` | Checkout a branch |
| `POST /api/git/stage|unstage|discard` `{dir,path}` | Stage / unstage / discard changes (`path` = `.` for all) |
| `GET /api/shell/cwd` | Current terminal working directory |
| `POST /api/shell/exec` `{dir,command}` | Run a command (cmd.exe); `cd` updates the cwd |

## Skin center & skin compatibility

The **Skin Center** (its own Settings tab, `dsh-skin-gallery`) is a one-of-N
card picker: the DSH built-in default plus every installed skin plugin. Each
card shows the skin name in the top-left, a large preview image in the middle,
a highlighted border for the selected skin, and the grid scrolls. Picking a
skin persists `activeSkin` and reloads the UI; on every boot only the selected
skin stays mounted.

Third-party skins are **not bundled**. To make a skin appear in the picker it
must provide a `skin.json` next to its package and be registered with
`dsh plugin --profile web add`. See
[docs/skin-compatibility.md](docs/skin-compatibility.md) for the full
convention.

**Recommended skins**

- [深海女仆工坊 / Abyssal Maid Atelier](https://github.com/Small-tailqwq/dsh-deep-whale) by Small-tailqwq — dual-maid backdrop, navy lace UI, chibi sidebar (CC BY-NC-SA 4.0). Install:
  ```powershell
  git clone https://github.com/Small-tailqwq/dsh-deep-whale "D:\dsh-deep-whale"
  corepack pnpm dsh plugin --profile web add D:\dsh-deep-whale\maid-atelier
  ```

## Panels (right column + bottom terminal)

`dsh-panels-framework` renders the panel shells; `dsh-right-panel` registers
the tabs and the header toggle buttons. Use the **◧ / ◨** and **▤** buttons in
the session header (next to the mode selector) to one-click collapse/expand
the right panel and the bottom terminal. Collapsed panels become slim rails on
the right/bottom edges — click them to expand again. Drag the panel edges to
resize; widths/heights and open state persist. Other plugins can add their own
tabs (see [docs/panels-framework.md](docs/panels-framework.md)).

## Build the shell from source

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

## Localization

All UI plugins register `zh`/`en` dictionaries through the DSH client locale
service and follow the language switcher of the harness. Toast messages are
bilingual.

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License & third-party notices

- Our code: MIT ([LICENSE](LICENSE)).
- `Microsoft.Web.WebView2.Core.dll` / `WinForms.dll` / `WebView2Loader.dll`:
  the [Microsoft Edge WebView2 SDK](https://www.nuget.org/packages/Microsoft.Web.WebView2) (MIT), redistributed per its license.
- `whale.ico`: DeepSeek's official whale logo (derived from the harness repo
  `apps/web/public/favicon.svg`); used here only to identify the DeepSeek
  Harness app.
- Third-party skins (e.g., Abyssal Maid Atelier) keep their own licenses and
  are **not** bundled.