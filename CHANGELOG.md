# Changelog

## [0.8.1] - 2026-08-14

### Fixed
- **Bottom panel resize direction** (`dsh-desktop-framework`): dragging the top
  edge up now makes the panel taller (dragging down makes it shorter). The
  delta sign for the bottom panel was inverted.
- **Tray "Exit" now stops the background service**: previously the exe only


### Fixed
- **Tray "Exit" now stops the background service**: previously the exe only
  killed the backend when it had started it itself (tracking the `cmd.exe`
  wrapper PID), so a service started elsewhere survived tray-exit. On exit the
  shell now locates whatever process is listening on the web port (3080) via
  `netstat` and terminates its whole process tree with `taskkill /PID <pid> /T
  /F`, in addition to killing the tree it spawned itself.

## [0.8.0] - 2026-08-14

### Added
- **Interactive Windows notifications** (`dsh-desktop-window`):
  - **Answer preview**: completion toasts show a bounded preview of the actual
    reply; the title maps the turn-end reason and the tools used are listed.
  - **Quick reply in the toast**: completion toasts carry a text input and a
    *Reply* button; the typed text is sent to the same session through the
    official `POST /api/session.prompt` (queue mode).
  - **Permission-request toasts**: sandbox permission escalations surface as
    toasts with *Allow once / Reject* buttons, answered through the official
    `POST /api/respond`; the host plugin subscribes to the DSH mux stream
    (`ws://.../api/events.mux`) as a read-only observer.
  - New shell endpoints: `POST /api/toast-action` (toast activation),
    `POST /api/dismiss` (remove a toast by tag).
  - Toast activation: the Start-Menu shortcut now sets `ToastActivatorCLSID`;
    button clicks launch `DshDesktop.exe` with a `toast=<urlencoded json>`
    argument forwarded to the running instance; a COM activator
    (`INotificationActivationCallback`) reads in-toast text input.
  - New config toggles: `notifyPreview`, `quickReply`, `approvalNotify`,
    `previewMaxChars`, `approvalTimeoutSec`.
- **Settings UI** (`dsh-desktop-settings`): Desktop tab adds toggles for answer
  preview, quick reply and permission-request notifications, a preview-length
  selector, and an interactive test-notification action.
- **CLI** (`dsh-desktop-framework`): new `notify`, `notify-turn`,
  `notify-approval` commands; `DSH_DESKTOP_API` env var overrides the shell API
  base; HTTP helper sends `Content-Length` and a timeout.

## [0.7.0] - 2026-08-14

### Added
- **Rendered HTML pages in the right panel**: `.html`/`.htm` files are no
  longer shown as plain text — they open as real web pages in an iframe.
  `DshDesktop.exe` gains a local web server route (`GET /serve/<url-encoded
  path>`) that serves the HTML file and resolves its relative `css/js/img`
  assets next to the file, so local pages render correctly.
- **Three web forms supported**, all rendered in the iframe viewer:
  1. local `.html` files (via `/serve/`),
  2. pages on a local port (`http://127.0.0.1:<port>`),
  3. public internet URLs.
- **`HTML 网页` open-mode setting**: the Open-files settings tab gains an
  "HTML page" type; it defaults to opening in the desktop viewer (others still
  default to ask-first).

## [0.6.0] - 2026-08-14

### Added
- **Modern Skin Center** (`dsh-skin-gallery`): the settings tab is now a
  card gallery where each card paints a mini app-window mockup with the
  **real theme tokens** (no hardcoded colors) — sidebar, chat bubbles, input
  bar and a brand-colored send button. A skin's `accent` (when present) drives
  the mockup's brand elements; `preview.light/dark` images are still shown when
  provided. Cards show name/author/description, the current skin gets a ✓
  badge, cards lift on hover, and filter chips (All / Built-in / Skins) let you
  narrow the grid. One click applies, persists `activeSkin`, and reloads.
- **Plugin settings tabs are grouped after native tabs**: plugin-owned
  settings tabs now use high order values (文件打开=1010, 桌面客户端=1020,
  皮肤中心=1030) so they always appear below the native settings tabs
  (通用设置 / 模型 / 插件 / Agent 预设).
- **Skin manifest pass-through**: `dsh-desktop-window` now carries `accent`,
  `tags` and `bodyAttr` from each `skin.json` into the generated `skins.json`,
  so the Skin Center can paint accurate previews.

### Fixed
- **Settings framework**: `registerItem` dropped the `render`/`action` payload,
  so `type: "custom"` items rendered as a plain text input labeled with the
  key and `type: "action"` items never worked. Both payloads are now stored and
  `TabShellView` renders custom/action items correctly (this is what makes the
  Skin Center cards and the Desktop tab's test-notify action actually render).
- **Settings framework**: `applyChanges` now normalizes every value to a
  string. The exe returns real booleans for the typed keys
  (`autoStart` / `notifyOnComplete` / `trayHint`), but the UI compared strings
  (`"true"` / `"1"`), so the Desktop tab's checkboxes always appeared unchecked
  and only one could look enabled at a time (radio-like). The three options are
  now independent checkboxes that reflect and persist their own state.

## 0.3.0 - themed non-floating panels, multi-type viewers, conversation links

- **Panels**: right/bottom panels now follow the app theme (light/dark) instead
  of a floating dark card; the bottom panel sits inside the middle column
  (between the left sidebar and the right panel), sharing the middle area with
  the conversation.
- **Right panel** is a multi-tab workspace with closable viewer tabs and
  adjustable width: Markdown (GitHub-style), code/text, image (zoom), video
  (byte-range seeking), PDF, web iframe, and a WebGL 3D viewer (STL/OBJ with
  drag-rotate / wheel-zoom).
- **Conversation links**: URLs and Windows file paths in chat output become
  clickable links; left-click chooses how to open, right-click shows
  *Open in desktop / Open with system default / Copy link*.
- **Open preferences**: new **????** settings tab picks per file type
  between `ask` / `desktop` / `system`.
- **DshDesktop.exe** adds `GET /api/fs/raw` (byte-range streaming for
  video/PDF/3D), `POST /api/fs/open` and `POST /api/fs/open-url`.


## 0.2.0 - merge frameworks into dsh-desktop-framework

- **Fix:** `dsh-panels-framework` client crashed with `RightPanelShell is not defined` — the `RightPanelShell` declaration, its `usePanelState` effect subscription, and the `TabBar` component were lost in an edit, leaving the panel shell body inside `usePanelState`. Reconstructed all three.
- **Merge:** `dsh-settings-framework` + `dsh-panels-framework` + `dsh-right-panel` are now one plugin, `dsh-desktop-framework`. Install one package instead of three:
  ```powershell
  corepack pnpm dsh plugin --profile web add D:\dsh-desktop-framework
  ```
  The three former packages are removed from the repository; the merged plugin keeps the same `window.__DSH_SETTINGS__` / `window.__DSH_PANELS__` APIs.
- README (en/zh) and docs updated for the merge.


All notable changes to **DeepSeek Harness as Desktop**.

## [0.5.0] - 2026-08-14

### Added
- **`dsh-skin-gallery`** — standalone, card-based **Skin Center** in its own
  Settings tab: one card per skin (name top-left, large preview in the middle,
  highlighted selection, scrollable grid), includes the DSH built-in default;
  switching persists (`activeSkin`) and auto-refreshes. The skin center moved
  out of the Desktop settings tab.
- **`dsh-panels-framework`** — generic right/bottom panel framework:
  `window.__DSH_PANELS__` with `registerPanel`/`toggle`/`setTab`/`setSize`/
  `getState`/`subscribe`, one-click collapse/expand rails, drag-to-resize, and
  persisted open state + sizes (settings-framework backend).
- **`dsh-right-panel`** — Files tab (file tree + text/image preview), Changes
  tab (git status with stage/unstage/discard), Terminal tab (mini cmd shell
  with `cd`) and header toggle buttons (◧ ◨ ▤).
- **`dsh-git-graph`** — Git Graph conversation view tab: branch selector,
  checkout, commit-history swimlane graph.
- **`dsh-live-stats`** — per-turn token stats line (TPS, LLM wall time,
  input/output tokens, cache-hit tokens) via the `conversation.chat.turnTail`
  chain.
- exe local API endpoints: `/api/fs/list`, `/api/fs/read` (text + image
  preview), `/api/git/branches|log|status|checkout|stage|unstage|discard`,
  `/api/shell/cwd`, `/api/shell/exec` (mini terminal backend).
- `EffectiveWorkDir` resolution: API defaults now fall back to the resolved
  workdir (config `serverWorkDir`, else `--workdir`, else the compiled
  default) instead of an empty string.

### Fixed
- Panels framework: consumer tab registration no longer clobbers persisted
  open state before the settings cache is ready (await `sf.ready` + `loaded`
  guard).
- Desktop settings tab no longer hosts the skin center (moved to the
  standalone skin gallery).

### Changed
- Skin center: card grid with scrollbar, name top-left, large preview,
  highlighted selection.
- Right panel + bottom terminal collapse/expand via one-click buttons and
  slim rails on the edges.

## [0.4.2] - 2026-08-14

### Added
- `dsh-settings-framework`: generic settings framework for plugins
  (`registerTab`/`registerItem`/`get`/`set`/`subscribe`), with `action` and
  `custom` item types.
- `dsh-demo-settings`: example framework consumer.

### Fixed
- Framework no longer re-emits **all** keys on refresh/set — it emits only
  keys whose value actually changed (prevents subscriber loops, e.g. the
  demo toast spam).

### Changed
- The Desktop settings tab now runs **on the framework** (dogfooding): its
  options, test-notify action, and skin center are declared through the
  framework.
- The exe `/api/settings` endpoint returns a merged view (typed desktop
  options + generic plugin key-value map); known keys route to the typed
  updater.

## [0.4.1] - 2026-08-14

### Changed
- Desktop app and plugins are now **relocatable**: config, data, and script
  paths derive from their own location instead of hardcoded `D:\` paths; the
  only machine-specific path is the DeepSeek Harness checkout
  (`D:\deepseek harness` by default, overridable via `--workdir`).
- Task-completion notifications are **enabled by default**.
- New **"Tray balloon on minimize/close"** option in the Desktop settings tab
  (default **off** — no more repeated balloon when minimized to tray).

### Fixed
- Toast messages are transported via a UTF-8 JSON file to preserve CJK text.

## [0.4.0] - 2026-08-14

### Added
- **One-of-N skin center** in the Desktop settings tab: DSH built-in default +
  every installed skin; selection persists (`activeSkin`) and the UI reloads
  after switching; the persisted choice is enforced on every boot.
- Real **Windows toasts** (AUMID-registered unpackaged toast via
  `toast.ps1` + `ShortcutAppId.cs`), with tray-balloon fallback.
- **Localization**: the Desktop settings tab registers `zh`/`en`
  dictionaries and follows the DSH language switcher.

### Changed
- `/api/notify` now sends real toasts instead of tray balloons.
- Skin manifest (`skins.json`) includes a built-in "DSH Default" entry.

## [0.3.0] - 2026-08-14

### Added
- Desktop app is now the entry point: it launches the DSH backend
  automatically when needed (`DSH_DESKTOP_AUTO=0` prevents duplicate windows).
- System-tray residency: minimize/close hides to tray; tray menu Open/Exit;