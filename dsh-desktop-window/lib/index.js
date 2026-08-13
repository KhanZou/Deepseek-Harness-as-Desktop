// dsh-desktop-window: host-side plugin for DeepSeek Harness (DSH).
// 1) Opens the native WebView2 desktop shell (DshDesktop.exe) when the
//    backend starts and the Web UI is reachable (disabled via
//    DSH_DESKTOP_AUTO=0 when the desktop client itself started the server).
// 2) Sends a Windows notification when a conversation turn completes, if
//    enabled in D:\dsh-desktop-window\config.json (notifyOnComplete=true).
// 3) Scans installed skin plugins and writes D:\dsh-desktop-window\skins.json
//    so the desktop settings tab can list/switch skins.
//
// Configuration (optional, via environment variables):
//   DSH_DESKTOP_URL     base URL of the Web UI (default http://127.0.0.1:3080)
//   DSH_DESKTOP_WIDTH   window width  (default 1440)
//   DSH_DESKTOP_HEIGHT  window height (default 900)
//   DSH_DESKTOP_AUTO    0|false|off disables auto-launch (default enabled)

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

export const name = 'desktop-window'

// Relocatable: all runtime paths derive from this plugin's own location.
const PLUGIN_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SHELL = path.join(PLUGIN_DIR, 'shell', 'DshDesktop.exe')
const CONFIG_FILE = path.join(PLUGIN_DIR, 'config.json')
const SKINS_FILE = path.join(PLUGIN_DIR, 'skins.json')
const EXE_API = 'http://127.0.0.1:3980'

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
]

const DEFAULTS = {
  url: 'http://127.0.0.1:3080',
  width: 1440,
  height: 900,
  delayMs: 1000,
  timeoutMs: 120000,
  pollIntervalMs: 1000,
  userDataDir: 'D:\\dsh-desktop-window\\.wv2-profile',
  autoLaunch: true,
}

function readEnv() {
  const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v))
  return {
    url: process.env.DSH_DESKTOP_URL || DEFAULTS.url,
    width: num(process.env.DSH_DESKTOP_WIDTH, DEFAULTS.width),
    height: num(process.env.DSH_DESKTOP_HEIGHT, DEFAULTS.height),
    autoLaunch: !['0', 'false', 'off'].includes(String(process.env.DSH_DESKTOP_AUTO || '').toLowerCase()),
  }
}

function log(...args) {
  console.log('[dsh-desktop-window]', ...args)
}

function exists(p) {
  try {
    return fs.existsSync(p)
  } catch {
    return false
  }
}

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'))
  } catch (e) {
    log('readConfig failed:', e.message)
  }
  return {}
}

async function waitForServer(url, opts, disposedRef) {
  const deadline = Date.now() + opts.timeoutMs
  while (!disposedRef.disposed && Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (res.ok) return true
    } catch {
      // server not ready yet
    }
    if (disposedRef.disposed) return false
    await sleep(opts.pollIntervalMs)
  }
  return false
}

function openWindow(cfg) {
  // Preferred: native WebView2 shell.
  if (exists(SHELL)) {
    const args = [
      '--url', cfg.url,
      '--width', String(cfg.width),
      '--height', String(cfg.height),
      '--user-data', cfg.userDataDir,
    ]
    const child = spawn(SHELL, args, { detached: true, stdio: 'ignore' })
    child.unref()
    log(`opened native WebView2 shell (${SHELL}) -> ${cfg.url}`)
    return
  }

  // Fallback: Edge/Chrome app-mode window.
  const browser = BROWSERS.find((p) => exists(p))
  if (!browser) {
    log('no native shell and no Edge/Chrome found; falling back to default browser')
    const target = process.platform === 'win32'
      ? { file: 'cmd', args: ['/c', 'start', '', cfg.url] }
      : { file: 'xdg-open', args: [cfg.url] }
    const child = spawn(target.file, target.args, { detached: true, stdio: 'ignore' })
    child.unref()
    return
  }
  const args = [
    `--app=${cfg.url}`,
    `--window-size=${cfg.width},${cfg.height}`,
    `--user-data-dir=${cfg.userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
  ]
  const child = spawn(browser, args, { detached: true, stdio: 'ignore' })
  child.unref()
  log(`opened ${browser} window -> ${cfg.url}`)
}

// ---- skin manifest -------------------------------------------------------

function scanForSkins() {
  const skins = []
  const seen = new Set()
  const roots = [
    path.join(os.homedir(), '.dsh', 'profiles', 'web', 'node_modules'),
    ...(process.env.DSH_SKIN_ROOTS ? process.env.DSH_SKIN_ROOTS.split(';').filter(Boolean) : []),
  ]
  const walk = (dir, depth) => {
    if (depth > 5) return
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === '.pnpm') continue
      const full = path.join(dir, ent.name)
      let st
      try { st = fs.statSync(full) } catch { continue }
      if (!st.isDirectory()) continue
      const sj = path.join(full, 'skin.json')
      if (fs.existsSync(sj)) {
        try {
          const meta = JSON.parse(fs.readFileSync(sj, 'utf8'))
          const pkg = meta.package || ''
          if (pkg && !seen.has(pkg)) {
            seen.add(pkg)
            const skin = {
              id: meta.id || '',
              name: meta.name || '',
              nameEn: meta.nameEn || '',
              package: pkg,
              author: meta.author || '',
              description: meta.description || '',
            }
            try {
              const light = meta.preview && meta.preview.light
              if (light) {
                const buf = fs.readFileSync(path.join(full, light))
                skin.preview = 'data:image/webp;base64,' + buf.toString('base64')
              }
            } catch {
              // preview optional
            }
            skins.push(skin)
          }
        } catch {
          // invalid skin.json, skip
        }
      }
      walk(full, depth + 1)
    }
  }
  for (const root of roots) walk(root, 0)
  return skins
}

function writeSkins() {
  try {
    const skins = scanForSkins()
    // Built-in DSH default skin (first in the picker).
    skins.unshift({
      id: "default",
      name: "DSH 默认",
      nameEn: "DSH Default",
      package: "",
      author: "DeepSeek",
      description: "DeepSeek Harness 本体内置默认外观 / Built-in default look",
      builtin: true,
      preview: "",
    })
    fs.writeFileSync(SKINS_FILE, JSON.stringify(skins, null, 2))
    log(`skin manifest updated: ${skins.length} skin(s)`)
  } catch (e) {
    log('writeSkins failed:', e.message)
  }
}

// ---- session completion notification -------------------------------------

function notifyWindows(title, message) {
  fetch(EXE_API + '/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title, message: message }),
  }).catch((e) => log('notify failed:', e.message))
}

let launched = false

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...config, ...readEnv() }

  // Always: keep the skin manifest fresh and listen for session completion.
  writeSkins()
  ctx.on('session/event', (session, event) => {
    try {
      if (event && event.type === 'turn/end') {
        const conf = readConfig()
        log('turn/end detected (notifyOnComplete=' + !!conf.notifyOnComplete + ')')
        if (conf.notifyOnComplete) {
          notifyWindows('DeepSeek Harness', '任务已完成 / Task completed')
          log('turn/end -> notification sent')
        }
      }
    } catch (e) {
      log('session listener error:', e.message)
    }
  })

  if (!cfg.autoLaunch) {
    log('auto launch disabled (DSH_DESKTOP_AUTO=0)')
    return
  }
  if (launched) return

  ctx.effect(() => {
    const disposedRef = { disposed: false }
    const run = async () => {
      await sleep(cfg.delayMs)
      if (disposedRef.disposed || launched) return
      log(`waiting for ${cfg.url} ...`)
      const ok = await waitForServer(cfg.url, cfg, disposedRef)
      if (!ok) {
        log(`server not reachable within ${cfg.timeoutMs}ms; window not opened`)
        return
      }
      if (disposedRef.disposed || launched) return
      launched = true
      openWindow(cfg)
    }
    run()
    return () => {
      disposedRef.disposed = true
    }
  })
}