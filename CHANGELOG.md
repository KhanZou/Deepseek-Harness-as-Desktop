# Changelog

All notable changes to **DeepSeek Harness as Desktop**.

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
  Exit stops the backend only when this exe started it.
- Launch at logon (HKCU Run) and local config API
  (`127.0.0.1:3980`: `/api/config`, `/api/skins`, `/api/notify`) with
  `config.json` persistence.

## [0.2.0] - 2026-08-14

### Changed
- Replaced the Edge/Chrome `--app` window with a **native WebView2 shell**
  (C# WinForms + WebView2 SDK, .NET Framework 4.8, x64).
- Added the DeepSeek whale multi-size icon (`whale.ico`, brand color #4D6BFE).

## [0.1.0] - 2026-08-14

### Added
- Initial host plugin that opens a desktop window (Edge app-mode) when the
  DSH backend is reachable.