# Skin compatibility conventions

This project's **Skin Center** (Settings → Desktop → Skin Center) discovers skins
from the installed DSH profile and lets the user pick **one** of them (or the
built-in default). This page documents the conventions a third-party skin
should follow to appear in the picker and behave correctly.

## How skins are discovered

The host plugin (`dsh-desktop-window`) scans:

- `C:\Users\<you>\.dsh\profiles\web\node_modules` (linked plugin packages)
- any other directory listed in `lib/index.js` (e.g. `D:\dsh-deep-whale`)

For every folder containing a `skin.json`, it appends an entry to
`D:\dsh-desktop-window\skins.json`, which the Desktop settings tab reads via
`GET /api/skins`. A built-in `default` entry is always prepended.

## `skin.json` schema

Place `skin.json` next to your plugin package (package root):

```json
{
  "id": "my-skin",
  "name": "皮肤名（中文）",
  "nameEn": "Skin Name",
  "author": "you",
  "description": "Short description.",
  "tags": ["anime"],
  "package": "@scope/dsh-client-ui-skin-my-skin",
  "accent": "#c5a468",
  "bodyAttr": "data-dsh-my-skin",
  "preview": { "light": "preview/light.webp", "dark": "preview/dark.webp" },
  "wiring": { "id": "ui-skin-my-skin", "bundleWired": false }
}
```

Required fields for the picker:

| Field | Meaning |
|---|---|
| `id` | Stable skin id used as the persisted `activeSkin` value |
| `name` / `nameEn` | Display names (the picker shows `name` or `nameEn`) |
| `package` | The plugin package name — also the runtime module id |
| `preview.light` / `preview.dark` | Optional preview images (relative to the package root, shown as data URLs) |

## Install a skin

```powershell
git clone <skin-repo> D:\<skin-folder>
cd /d "D:\deepseek harness"
corepack pnpm dsh plugin --profile web add D:\<skin-folder>\<skin-package>
```

Restart the desktop app. The skin then appears in the Skin Center picker.

## The "mount = applied" model

In this ecosystem a skin plugin is a DSH **client plugin**: when its client
bundle is mounted it applies itself (DOM overlays, `body` data-attribute, CSS
variables), and its `ctx.effect` disposer reverts everything on unmount.
There is no core-DSH "skin switch API" (`bundleWired` in `skin.json` is an
informational convention from the skin scaffold, not consumed by the harness).

The Skin Center therefore:

1. persists the choice as `activeSkin` in `config.json`;
2. reloads the UI after a switch;
3. on every boot, disposes the mounted bundles of all skins **except** the
   selected one (and all of them when the DSH default is selected).

To be compatible, a skin should:

- apply all of its visuals inside `apply(ctx)` via `ctx.effect(...)` and
  **revert them in the disposer** (so a switch back to default is clean);
- use a `body` data attribute unique to the skin (e.g. `data-dsh-my-skin`);
- avoid affecting the boot process (it will be disposed shortly after boot
  when not selected — a brief flash is expected);
- expose the standard `window.__ModuleLoader__.load({ id, factory })` bundle
  shape with `exports.apply`.

## Licensing

Third-party skins keep their own licenses and are **not** bundled into this
repository. If you recommend a skin in your README, link to its repository and
respect its license (e.g. CC BY-NC-SA 4.0 for non-commercial works).