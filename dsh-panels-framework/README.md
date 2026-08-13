# dsh-panels-framework

Generic **right/bottom panel framework** for DSH client plugins. Renders a
right-side column and a bottom bar (into the layout's `shell.overlay`) with
tabs, one-click collapse/expand rails, drag-to-resize and persisted state.

Other plugins register tabs through `window.__DSH_PANELS__`:
`registerPanel({ side, id, label, order, render })`,
`open/close/toggle(side)`, `setTab(side, tabId)`, `setSize(side, px)`,
`getState()`, `subscribe(cb)`.

State (open, active tab, sizes) persists via the dsh-settings-framework
backend (`panelRight*` / `panelBottom*` keys). The built-in Files/Changes/
Terminal tabs come from `dsh-right-panel`. See
[docs/panels-framework.md](docs/panels-framework.md) in the repo root for the
full design and a usage example.