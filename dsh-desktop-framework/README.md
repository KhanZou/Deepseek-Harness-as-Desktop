# dsh-desktop-framework

Unified desktop framework plugin for the DeepSeek Harness Web UI. This package
merges the former three plugins:

| Former plugin | Role in the merge |
|---|---|
| `dsh-settings-framework` | generic settings tabs/items (`window.__DSH_SETTINGS__`) |
| `dsh-panels-framework` | right/bottom panel shells (`window.__DSH_PANELS__`) |
| `dsh-right-panel` | Files / Changes / Terminal tabs + session-header toggles |

Install once, instead of the three separate packages:

```powershell
corepack pnpm dsh plugin --profile web add D:\dsh-desktop-framework
```

## What it provides

- **Settings framework** — any plugin can add Settings tabs/items via
  `window.__DSH_SETTINGS__` (`registerTab` / `registerItem` / `get` / `set` /
  `subscribe`), persisted through the DshDesktop.exe local API
  (`http://127.0.0.1:3980/api/settings`).
- **Panels framework** — right column + bottom bar shells with tabs, one-click
  collapse/expand rails, drag-to-resize and persisted state via
  `window.__DSH_PANELS__` (`registerPanel` / `open` / `close` / `toggle` /
  `setTab` / `setSize` / `getState` / `subscribe`).
- **Files / Changes / Terminal tabs** — file tree + preview, git stage/unstage/
  discard, and a mini terminal, backed by the DshDesktop.exe API
  (`/api/fs/*`, `/api/git/*`, `/api/shell/*`).

## Notes

- The plugin is relocatable: it talks to the desktop exe at `127.0.0.1:3980`
  and registers itself through the DSH client plugin system; no build step.
- The desktop exe (`DshDesktop.exe`) must be running for persistence and for
  the Files/Changes/Terminal backends to respond.

- **测试 CLI**：新增 `notify [title] [message]`、`notify-turn [preview]`、`notify-approval [tool] [reason]` 命令，用于直接向桌面客户端发送普通/交互式测试通知；可用环境变量 `DSH_DESKTOP_API` 覆盖默认的 `http://127.0.0.1:3980`（例如指向 `http://127.0.0.1:3981`）。
