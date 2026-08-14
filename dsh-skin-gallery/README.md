# dsh-skin-gallery

A standalone, modern **Skin Center** for the DeepSeek Harness (DSH) Web UI.
It lives in its own Settings tab, ordered after every native settings tab, and
shows every skin as a preview card: each card paints a mini app-window mockup
with the **actual theme tokens** (no hardcoded colors) — sidebar, chat bubbles,
input bar and a brand-colored send button — using the skin's `accent` color
when the manifest provides one. Click a card to apply; the current skin carries
a ✓ badge.

## Features

- One card per skin: a mini app-window mockup painted with live theme tokens,
  plus name, author and description.
- Current skin is marked with a ✓ badge and a highlighted ring.
- Filter chips (All / Built-in / Skins) and a scrollable card grid.
- DSH's built-in default skin is listed first and always selectable.
- Switching a skin persists via the desktop client (`activeSkin`) and the UI
  refreshes automatically.
- Keeps only the active skin plugin mounted (non-active skins are disposed).
- If a skin ships `preview.light` / `preview.dark` images they are shown
  instead of the generated mockup.

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
entry may provide a `preview` image (shown instead of the generated mockup) and
an optional `accent` color that drives the mockup's brand elements. `tags` and
`bodyAttr` are carried into the manifest as well. See
[../docs/skin-compatibility.md](../docs/skin-compatibility.md).