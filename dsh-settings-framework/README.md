# dsh-settings-framework

A generic settings framework for DeepSeek Harness client plugins: declare
**Settings tabs and items**, persist them, and **synchronize changes across
plugins** — without hand-writing React slot registrations or scope controllers.

## Install

```powershell
cd /d "D:\deepseek harness"
corepack pnpm dsh plugin --profile web add D:\dsh-settings-framework
```

Restart the desktop app. The framework exposes `window.__DSH_SETTINGS__` to
every client plugin once the web app has booted.

## API

| Method | Description |
|---|---|
| `registerTab({ id, label, order })` | Add a Settings tab (nav row). `label` may be a locale thunk `() => t(…)`. |
| `registerItem({ tabId, key, type, label, hint, defaultValue, options })` | Add a setting item to a tab. |
| `get(key)` | Current value (string) |
| `set(key, value)` | Persist + notify all subscribers |
| `subscribe(key, cb)` | Subscribe to changes; returns an unsubscribe function |

### Item types

| type | control |
|---|---|
| `toggle` | checkbox (value `"true"`/`"false"`) |
| `select` | dropdown (`options: [{ value, label }]`) |
| `text` | text input |
| `number` | number input |
| `action` | a button; `action({ get, set })` runs on click |
| `custom` | full-width custom React node; `render({ get, set, h, React, refresh })` |

## Example consumer

```js
// your-plugin/lib/client.js  (bundle shape: window.__ModuleLoader__.load …)
window.__ModuleLoader__.load({
  id: "your-plugin-id",
  factory: (require) => {
    const h = require("react").createElement;
    const NS = "mySettings";
    const dict = { zh: { nav: "我的设置" }, en: { nav: "My Settings" } };
    let t, ctxRef;

    function whenReady(cb, tries) { // wait for the framework at boot
      tries = tries || 0;
      if (window.__DSH_SETTINGS__) return cb(window.__DSH_SETTINGS__);
      if (tries > 200) return;
      setTimeout(() => whenReady(cb, tries + 1), 200);
    }

    function apply(ctx) {
      ctxRef = ctx;
      ctx.effect(() => ctx.locale.register(NS, dict), "my-settings: dictionaries");
      t = ctx.locale.bind(NS);
      whenReady((sf) => {
        sf.registerTab({ id: "my", label: () => t("nav"), order: 80 });
        sf.registerItem({ tabId: "my", key: "my.greeting", type: "text", label: "Greeting", defaultValue: "Hello" });
        sf.registerItem({ tabId: "my", key: "my.mode", type: "select",
          label: "Mode", options: [{ value: "auto", label: "Auto" }, { value: "manual", label: "Manual" }], defaultValue: "auto" });
        sf.registerItem({ tabId: "my", key: "my.notify", type: "toggle", label: "Notify", defaultValue: false });
        sf.subscribe("my.notify", (v) => { /* react to changes from any plugin */ });
      });
    }
    exports.apply = apply;
    exports.inject = ["slots", "locale"];
    return module.exports;
  },
});
```

## Backends & sync

- **Backend (v1):** the desktop client (`DshDesktop.exe`) local API
  `GET/POST /api/settings`. The endpoint returns a **merged view** of the typed
  desktop options plus a generic key-value map persisted in `config.json`.
  Known typed keys route to the typed updater (with side effects such as
  registry sync); every other key lands in the generic map.
- **Sync:** `set()` persists and broadcasts; the framework refreshes the store
  every ~3s while a settings tab is mounted and emits **only keys whose value
  actually changed** (no spurious subscriber events).

## Localization

`label`/`hint`/`options[].label` accept locale thunks; bind DSH's locale
service (`ctx.locale.bind(ns)`) in your consumer plugin and pass `() => t(…)`.

## License

MIT (this package). See the repository [LICENSE](../LICENSE).