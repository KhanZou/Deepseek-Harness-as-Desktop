# Changelog

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