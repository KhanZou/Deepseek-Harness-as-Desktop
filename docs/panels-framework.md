# dsh-panels-framework

The **panels framework** is the visual counterpart of `dsh-settings-framework`:
a generic way for any DSH client plugin to add tabs to a right-side column and
a bottom bar, with one-click collapse/expand, drag-to-resize and persisted
state.

## What it provides

The plugin registers two shells into the layout's `shell.overlay` slot and
exposes a global API on `window.__DSH_PANELS__`:

| Method | Description |
|---|---|
| `registerPanel({ side, id, label, order, render })` | Add a tab to `right` or `bottom` |
| `open(side)` / `close(side)` / `toggle(side)` | Open state control |
| `setTab(side, tabId)` | Switch the active tab |
| `setSize(side, px)` | Resize (right width / bottom height) |
| `getState()` | Read `{ right, bottom }` state incl. tabs |
| `subscribe(cb)` | Listen for state changes |

`side` is `"right"` or `"bottom"`. `label` can be a plain string or a
function (to follow the active locale); `render({ side, tab, h, React })`
returns the tab content.

## Persistence

Open state, active tab and sizes are persisted through the
`dsh-settings-framework` backend (keys `panelRightOpen`, `panelRightTab`,
`panelRightWidth`, `panelBottomOpen`, `panelBottomTab`,
`panelBottomHeight`). Without the settings framework installed the panels
still work but keep their state in memory for the session.

## Usage from a plugin

```js
// client.js of your plugin
window.__ModuleLoader__.load({
  id: "your-plugin",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;

    function MyTab() {
      return h("div", { style: { padding: 12 } }, "Hello from a panel tab");
    }

    function apply(ctx) {
      // wait for the panels framework, then register your tab
      const check = (n) => {
        if (window.__DSH_PANELS__) {
          window.__DSH_PANELS__.registerPanel({
            side: "right",
            id: "my-tab",
            label: () => "My Tab",
            order: 50,
            render: () => h(MyTab),
          });
        } else if (n < 200) setTimeout(() => check(n + 1), 200);
      };
      check(0);
    }

    exports.apply = apply;
    exports.inject = ["slots"];
    return module.exports;
  },
});
```

## Collapse / expand

Each open panel has a collapse button in its header; collapsed panels become
slim rails on the right / bottom edges which expand on click. Plugins can also
drive the state programmatically via `toggle(side)`.

## Notes

- The framework itself only renders the shells — the built-in Files/Changes/
  Terminal tabs come from `dsh-right-panel`, which is a consumer of this
  framework.
- Panels render inside the layout's `shell.overlay` layer, so they float above
  the columns without affecting layout.