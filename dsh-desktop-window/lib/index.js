// dsh-desktop-window: host-side plugin for DeepSeek Harness (DSH).
// 1) Opens the native WebView2 desktop shell (DshDesktop.exe) when the
//    backend starts and the Web UI is reachable (disabled via
//    DSH_DESKTOP_AUTO=0 when the desktop client itself started the server).
// 2) Sends an interactive Windows notification when a conversation turn
//    completes: the title maps the turn-end reason, the body is a bounded
//    preview of the actual reply, and (when quickReply is enabled) the toast
//    carries a quick-reply input + reply button.
// 3) Watches the DSH mux stream for approval requests (sandbox permission
//    escalations) and surfaces them as interactive Windows toasts with
//    approve/reject actions; the native shell answers through the official
//    /api/respond channel.
// 4) Scans installed skin plugins and writes <plugin>/skins.json so the
//    desktop settings tab can list/switch skins.
//
// Configuration (optional, via environment variables):
//   DSH_DESKTOP_URL     base URL of the Web UI (default http://127.0.0.1:3080)
//   DSH_DESKTOP_WIDTH   window width  (default 1440)
//   DSH_DESKTOP_HEIGHT  window height (default 900)
//   DSH_DESKTOP_AUTO    0|false|off disables auto-launch (default enabled)
//
// All user-facing strings live here (UTF-8) and travel to the native shell via
// the /api/notify JSON payload; the C#/PowerShell shell stays text-agnostic.

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
const USER_DATA_DIR = path.join(PLUGIN_DIR, '.wv2-profile')
// Desktop shell API base; port follows config.json (apiPort) so a relocated
// shell is reachable without touching this plugin.
function exeApiUrl() {
  const c = readConfig()
  const port = Number(c.apiPort) || 3980
  return 'http://127.0.0.1:' + port
}

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
  userDataDir: '',
  autoLaunch: true,
  previewMaxChars: 300,
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

function confBool(conf, key, def) {
  const v = conf[key]
  if (v === undefined || v === null) return def
  return v === true || String(v) === 'true'
}

function confInt(conf, key, def) {
  const v = Number(conf[key])
  return Number.isFinite(v) && v > 0 ? v : def
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
      '--user-data', cfg.userDataDir || USER_DATA_DIR,
    ]
    const child = spawn(SHELL, args, { detached: true, stdio: 'ignore' })
    child.unref()
    log(`opened native WebView2 shell (${SHELL}) -> ${cfg.url}`)
    return
  }

  // Fallback: Edge/Chrome app-mode window (DSH_DESKTOP_BROWSER overrides the list).
  const envBrowser = process.env.DSH_DESKTOP_BROWSER
  const browser = (envBrowser && exists(envBrowser)) ? envBrowser : BROWSERS.find((p) => exists(p))
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
    `--user-data-dir=${cfg.userDataDir || USER_DATA_DIR}`,
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
              accent: meta.accent || '',
              tags: Array.isArray(meta.tags) ? meta.tags : [],
              bodyAttr: meta.bodyAttr || '',
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

// ---- notifications -------------------------------------------------------

const NOTIFY_GROUP = 'DeepSeekHarness.Desktop'
const TURN_TITLES = {
  completed: '任务完成 / Task completed',
  error: '任务出错 / Task failed',
  aborted: '任务已中断 / Task aborted',
  blocked: '任务被阻塞 / Task blocked',
  'max-tokens': '达到输出上限 / Max tokens reached',
  interrupted: '会话已中断 / Session interrupted',
}
const TURN_FALLBACK_TITLE = 'DeepSeek Harness'
const APPROVAL_TITLE = 'DeepSeek Harness 请求权限 / Permission requested'

function boundText(text, maxChars) {
  if (text.length <= maxChars) return text
  return text.slice(0, maxChars - 1) + '…'
}

function notifyWindows(payload) {
  fetch(exeApiUrl() + '/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((e) => log('notify failed:', e.message))
}

function dismissToast(tag) {
  if (!tag) return
  fetch(exeApiUrl() + '/api/dismiss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, group: NOTIFY_GROUP }),
  }).catch((e) => log('dismiss failed:', e.message))
}

// ---- per-session turn preview fold ---------------------------------------

const previews = new Map()   // sessionId -> { turn, text, tools }
const sessions = new Map()   // sessionId -> session object (for tool/call lookup)

function applyTurnEvent(sessionId, event, maxChars) {
  const type = event && event.type
  if (type === 'turn/start') {
    previews.set(sessionId, { turn: event.data && event.data.turn, text: '', tools: [] })
    return undefined
  }
  const st = previews.get(sessionId)
  if (!st) return undefined
  const turn = event.data && event.data.turn
  if (turn !== st.turn) return undefined
  if (type === 'assistant/message') {
    const content = event.data && event.data.message && event.data.message.content
    if (!Array.isArray(content)) return undefined
    let text = st.text
    for (const block of content) {
      if (block && block.type === 'text' && typeof block.text === 'string') text += block.text
    }
    if (text.length > maxChars) text = boundText(text, maxChars)
    if (text !== st.text) st.text = text
  } else if (type === 'tool/call') {
    const name = event.data && event.data.name
    if (name && !st.tools.includes(name)) st.tools.push(name)
  } else if (type === 'turn/end') {
    const result = {
      turn: st.turn,
      reason: event.data && event.data.reason && event.data.reason.kind,
      body: st.text.trim(),
      tools: st.tools,
    }
    previews.delete(sessionId)
    return result
  }
  return undefined
}

function lookupToolArgs(sessionId, callId) {
  try {
    const session = sessions.get(sessionId)
    if (!session || !Array.isArray(session.events)) return ''
    const evs = session.events
    for (let i = evs.length - 1; i >= 0; i--) {
      const e = evs[i]
      if (e && e.type === 'tool/call' && e.data && e.data.callId === callId) {
        const a = e.data.arguments
        if (a === undefined || a === null) return ''
        const s = typeof a === 'string' ? a : JSON.stringify(a)
        return s.length > 400 ? s.slice(0, 400) + '…' : s
      }
    }
  } catch {
    // ignore
  }
  return ''
}

function buildApprovalMessage(payload, argsText) {
  const lines = []
  if (payload.toolName) lines.push('工具: ' + payload.toolName)
  if (payload.reason) lines.push('原因: ' + payload.reason)
  if (argsText) lines.push('参数: ' + argsText)
  return lines.join('\n') || '请求权限'
}

// ---- mux subscription (approval frames) ----------------------------------

let muxWs = null
let muxRetry = 0
let muxTimer = null

function connectMux(cfg) {
  if (muxWs || muxTimer) return
  let ws
  try {
    ws = new WebSocket(cfg.muxUrl)
  } catch (e) {
    log('mux open failed:', e.message)
    scheduleMuxReconnect(cfg)
    return
  }
  muxWs = ws
  ws.onopen = () => { muxRetry = 0; log('mux connected') }
  ws.onmessage = (ev) => {
    try {
      handleMuxFrame(JSON.parse(String(ev.data)))
    } catch {
      // drop malformed frame
    }
  }
  ws.onclose = () => {
    muxWs = null
    scheduleMuxReconnect(cfg)
  }
  ws.onerror = () => { try { ws.close() } catch { /* ignore */ } }
}

function scheduleMuxReconnect(cfg) {
  if (muxWs || muxTimer) return
  const delay = Math.min(15000, 1000 * 2 ** muxRetry)
  muxRetry += 1
  muxTimer = setTimeout(() => { muxTimer = null; connectMux(cfg) }, delay)
}

function handleMuxFrame(frame) {
  const payload = frame && frame.payload
  if (!payload) return
  if (payload.type === 'approval/requested') {
    const conf = readConfig()
    if (!confBool(conf, 'approvalNotify', true)) return
    const argsText = lookupToolArgs(payload.sessionId, payload.callId)
    const approvalId = payload.approvalId || ''
    notifyWindows({
      kind: 'approval',
      title: APPROVAL_TITLE,
      message: buildApprovalMessage(payload, argsText),
      sessionId: payload.sessionId || '',
      approvalId,
      rpcId: frame.rpcId || '',
      toolName: payload.toolName || '',
      reason: payload.reason || '',
      args: argsText,
      tag: 'dsh-approval-' + approvalId,
      group: NOTIFY_GROUP,
      approveLabel: '允许一次 / Allow once',
      rejectLabel: '拒绝 / Reject',
    })
  } else if (payload.type === 'approval/resolved') {
    const approvalId = payload.approvalId || ''
    if (approvalId) dismissToast('dsh-approval-' + approvalId)
  }
}

// ---- plugin apply --------------------------------------------------------

let launched = false

export function apply(ctx, config = {}) {
  const cfg = { ...DEFAULTS, ...config, ...readEnv() }
  cfg.muxUrl = cfg.url.replace(/^http/, 'ws') + '/api/events.mux'

  // Always: keep the skin manifest fresh and listen for session completion.
  writeSkins()
  ctx.on('session/event', (session, event) => {
    try {
      if (!session || !event) return
      sessions.set(session.id, session)
      const conf = readConfig()
      const maxChars = confInt(conf, 'previewMaxChars', DEFAULTS.previewMaxChars)
      const done = applyTurnEvent(session.id, event, maxChars)
      if (done) {
        log('turn/end detected (notifyOnComplete=' + !!conf.notifyOnComplete + ')')
        if (confBool(conf, 'notifyOnComplete', true)) {
          const reason = done.reason || ''
          const title = TURN_TITLES[reason] || TURN_FALLBACK_TITLE
          const preview = done.body || ''
          notifyWindows({
            kind: 'turn',
            title,
            message: preview || '任务已完成 / Task completed',
            sessionId: session.id,
            turn: String(done.turn === undefined || done.turn === null ? '' : done.turn),
            reason,
            tools: done.tools && done.tools.length ? done.tools.join(', ') : '',
            quickReply: confBool(conf, 'quickReply', true),
            replyPlaceholder: '回复或布置下一个任务…',
            replyLabel: '回复 / Reply',
          })
          log('turn/end -> notification sent')
        }
      }
    } catch (e) {
      log('session listener error:', e.message)
    }
  })

  ctx.effect(() => {
    connectMux(cfg)
    return () => {
      if (muxTimer) { clearTimeout(muxTimer); muxTimer = null }
      if (muxWs) { try { muxWs.close() } catch { /* ignore */ } muxWs = null }
    }
  }, 'desktop-window: mux approval watcher')

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
