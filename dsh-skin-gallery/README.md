# dsh-skin-gallery

A standalone, card-based **Skin Center** for the DeepSeek Harness (DSH) Web UI.
It lives in its own Settings tab (separate from the Desktop options tab) and
shows every skin as a card: the name in the top-left corner, a large preview
image in the middle, a highlighted border for the selected skin, and a
scrollable grid so you can flip through many skins.

## Features

- One card per skin: name (top-left), large preview, author, description.
- Selected skin is highlighted (blue border + "Current" badge).
- Scrollable card grid with a slim paired scrollbar.
- DSH's built-in default skin is listed first and always selectable.
- Switching a skin persists via the desktop client (`activeSkin`) and the UI
  refreshes automatically.
- Keeps only the active skin plugin mounted (non-active skins are disposed).

## Requirements

- `dsh-desktop-window` (DshDesktop.exe) running with its local API on
  `http://127.0.0.1:3980`.
- `dsh-settings-framework` installed (the gallery registers its tab through it).

## Install

```
dsh plugin --profile web add <path-to-this-package>
```

Then restart `dsh web`. Open **Settings → Skin Center**.

## Skin manifest

Skins are discovered from `skin.json` manifests of installed skin plugins and
written to the desktop client's `skins.json` by `dsh-desktop-window`. Each
entry may provide a `preview` image which is shown as the card preview.