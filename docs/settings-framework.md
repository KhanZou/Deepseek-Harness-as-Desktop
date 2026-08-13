# Settings framework (design)

A generic, plugin-facing settings framework for DeepSeek Harness. It lets any
DSH client plugin add **Settings tabs and items declaratively**, persist them,
and **synchronize changes across plugins** — without hand-writing React slot
registrations or scope controllers.

## Why it exists / what DSH already provides

DSH already ships a platform-level settings system that the framework builds on:

| Mechanism | What it gives |
|---|---|
| `ctx.slots.inject('settings.section', …)` | Any client plugin can register a whole Settings page (tab) |
| `ctx.slots.inject('settings.general.item', …)` | Plugins add preference rows to the General section |
| `ctx.settingsScope.bind({ namespace })` | Typed, durable, host-backed settings namespaces with revision snapshots + invalidation (used by ui-theme, locale, ui-settings-plugins) |
| `settings.plugins.tab` | Tabs inside the Plugins section |

The framework is a **thin declarative layer** on top: plugins describe tabs and
items, the framework renders them and handles persistence/sync.

## Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Consumer plugins (any DSH client plugin)                    │
│   registerTab / registerItem / get / set / subscribe        │
├─────────────────────────────────────────────────────────────┤
│ dsh-settings-framework (this repo)                          │
│   - registry (tabs, items)                                  │
│   - renderer (Settings sections + controls)                 │
│   - sync: local pub/sub + periodic store refresh            │
│   - backends (v1: desktop exe API; future: settingsScope)   │
├─────────────────────────────────────────────────────────────┤
│ Persistence backends                                        │
│   A) DshDesktop.exe local API  /api/settings  (generic KV)  │
│   B) (future) ctx.settingsScope for harness-host settings   │
└─────────────────────────────────────────────────────────────┘
```

## Public API (browser half, exposed as `window.__DSH_SETTINGS__`)

```js
const sf = window.__DSH_SETTINGS__        // wait for `sf.ready` if needed

sf.registerTab({ id: 'my-tab', label: () => t('nav'), order: 60 })

sf.registerItem({
  tabId: 'my-tab',
  key: 'my.plugin.mode',
  type: 'toggle' | 'select' | 'text' | 'number' | 'action' | 'custom',
  label: t('modeLabel'),
  hint: t('modeHint'),
  defaultValue: 'auto',
  options: [{ value: 'auto', label: t('auto') }],   // for select
})

sf.get('my.plugin.mode')                  // current value (string)
sf.set('my.plugin.mode', 'manual')        // persist + notify subscribers
const off = sf.subscribe('my.plugin.mode', (v) => { … })   // cross-plugin sync
```

- Tabs map to `settings.section` entries (nav rows in the Settings panel).
- Items render inside their tab with standard controls; `label` may be a
  locale thunk (`() => t(…)`) so localization follows the harness.
- `set()` writes through the backend and **broadcasts to every subscriber**,
  regardless of which plugin owns the key.

## Sync model (v1)

- Local pub/sub: `set()` and store refreshes emit change events to all
  subscribers.
- Cross-plugin / cross-tab sync: the framework refreshes the store every ~3s
  while a tab is mounted and re-emits changed keys. Sufficient for desktop
  settings; a host-push path (settingsScope invalidations) is planned.

## Backends

**A. Desktop client (default, implemented).** `DshDesktop.exe` exposes
`GET/POST /api/settings` returning a **merged view**: the typed desktop options
(`closeBehavior`, `autoStart`, `notifyOnComplete`, `trayHint`, `activeSkin`, …)
plus a generic key-value map persisted in `config.json` (`settings` object).
Known typed keys route to the typed updater (with side effects such as
registry sync); anything else lands in the map — the exe acts as a neutral
settings store.

**B. Harness host (future).** Bind a namespace through `ctx.settingsScope` for
settings the DSH server owns; the framework would expose the same
`get/set/subscribe` surface with a `backend: 'host'` option.

## Example consumer

The **Desktop** tab in this repo (dsh-desktop-settings) is itself a framework
consumer (dogfooding): it registers its close-behavior/auto-start/notification
items, a test-notify action, and a custom skin center through the framework.

See [dsh-settings-framework/README.md](../dsh-settings-framework/README.md) for the full consumer API and a complete example plugin.

## Roadmap

- [ ] `backend: 'host'` adapter via `ctx.settingsScope`
- [ ] per-plugin namespaces + validation schemas
- [ ] richer item types (slider, color, list, button/action)
- [ ] push-based sync (no polling) for the desktop backend