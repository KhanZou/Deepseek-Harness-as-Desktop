#!/usr/bin/env node
// dsh-desktop-framework CLI — testing helpers for the desktop framework APIs.
// Usage: node cli.js <command> [args...]
//   check              health-check the web UI (3080) and desktop API (3980)
//   raw <path> [range] GET /api/fs/raw and print status/mime/len (+ range)
//   open <path>        POST /api/fs/open — open with the system default app
//   open-url <url>     POST /api/fs/open-url — open in the default browser
//   settings [k [v]]   GET all settings; with k GET one; with k+v POST it
//   type <path>        print the viewer kind for a file name
//   samples [dir]      generate sample md/stl/pdf files (default D:\dsh-test-files)
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

const API = process.env.DSH_DESKTOP_API || 'http://127.0.0.1:3980'
const WEB = process.env.DSH_DESKTOP_WEB || 'http://127.0.0.1:3080'

function reqJson(url, options = {}, body = undefined) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const headers = Object.assign({}, options.headers || {})
    if (body !== undefined) headers['Content-Length'] = Buffer.byteLength(body)
    const r = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method: options.method || 'GET', headers,
    }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve({ status: res.statusCode, headers: res.headers, text })
      })
    })
    r.on('error', reject)
    r.setTimeout(8000, () => { try { r.destroy(new Error('timeout')) } catch { } })
    if (body) r.write(body)
    r.end()
  })
}

const KIND_MAP = {
  image: ['png','jpg','jpeg','gif','webp','bmp','svg','ico','avif'],
  video: ['mp4','webm','mov','mkv','avi','m4v','ogv'],
  pdf: ['pdf'],
  markdown: ['md','markdown','mdown'],
  code: ['js','ts','tsx','jsx','mjs','cjs','py','java','c','h','cpp','hpp','cc','cs','go','rs','rb','php','swift','kt','sql','html','htm','css','scss','less','json','yaml','yml','toml','xml','sh','ps1','bat','cmd','vue','svelte','astro'],
  text: ['txt','log','ini','cfg','conf','csv','tsv','env','gitignore','editorconfig','license','readme'],
  model3d: ['stl','obj','glb','gltf','ply','off'],
}

function kindOf(name) {
  const n = String(name || '').toLowerCase()
  const i = n.lastIndexOf('.')
  const ext = i < 0 ? '' : n.slice(i + 1)
  for (const k of Object.keys(KIND_MAP)) if (KIND_MAP[k].includes(ext)) return k
  return ext === '' ? 'unknown' : 'other'
}

async function check() {
  const web = await reqJson(WEB + '/').catch((e) => ({ status: 'ERR ' + e.message }))
  const api = await reqJson(API + '/api/config').catch((e) => ({ status: 'ERR ' + e.message }))
  console.log('web  :', web.status)
  console.log('api  :', api.status, api.text ? api.text.slice(0, 120) : '')
}

async function raw(file, range) {
  const headers = range ? { Range: range } : {}
  const r = await reqJson(API + '/api/fs/raw?path=' + encodeURIComponent(file), { headers })
  console.log('status     :', r.status)
  console.log('content-type:', r.headers['content-type'])
  console.log('content-range:', r.headers['content-range'] || '-')
  console.log('accept-ranges:', r.headers['accept-ranges'] || '-')
  console.log('length     :', Buffer.byteLength(r.text))
  console.log('head       :', JSON.stringify(r.text.slice(0, 80)))
}

async function open(file) {
  const r = await reqJson(API + '/api/fs/open', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, JSON.stringify({ path: file }))
  console.log(r.status, r.text)
}

async function openUrl(url) {
  const r = await reqJson(API + '/api/fs/open-url', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, JSON.stringify({ url }))
  console.log(r.status, r.text)
}

async function settings(k, v) {
  if (v === undefined) {
    const r = await reqJson(API + '/api/settings' + (k ? '?key=' + encodeURIComponent(k) : ''))
    console.log(r.status, r.text)
  } else {
    const r = await reqJson(API + '/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' } }, JSON.stringify({ key: k, value: v }))
    console.log(r.status, r.text)
  }
}

function samples(dir) {
  const d = dir || path.join(process.cwd(), 'dsh-samples')
  fs.mkdirSync(d, { recursive: true })
  const md = `# Sample Document\n\n## Section A\n\nThis is **bold** and *italic* and \`code\`.\n\n- item one\n- item two\n\n\`\`\`js\nconst x = 1\n\`\`\`\n`
  fs.writeFileSync(path.join(d, 'sample.md'), md)
  const stl = `solid cube\nfacet normal 0 0 -1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nfacet normal 0 0 1\nouter loop\nvertex 0 0 1\nvertex 0 1 1\nvertex 1 0 1\nendloop\nendfacet\nendsolid cube\n`
  fs.writeFileSync(path.join(d, 'sample.stl'), stl)
  const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 60>>stream\nBT /F1 14 Tf 40 120 Td (Dsh test pdf) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \n0000000221 00000 n \n0000000333 00000 n \ntrailer<</Size 6/Root 1 0 R>>\nstartxref\n399\n%%EOF\n'
  fs.writeFileSync(path.join(d, 'sample.pdf'), pdf)
  console.log('samples written to', d)
}


async function notifyBasic(title, message) {
  const r = await reqJson(API + '/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({ title: title || 'DeepSeek Harness', message: message || 'Test notification' }))
  console.log(r.status, r.text)
}

async function notifyTurn(preview) {
  const r = await reqJson(API + '/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({
      kind: 'turn',
      title: '任务完成 / Task completed',
      message: preview || '回答预览：这是通过 CLI 发送的测试通知，包含预览与快捷回复输入框。',
      sessionId: '',
      turn: '0',
      reason: 'completed',
      tools: 'cli',
      quickReply: true,
      replyPlaceholder: '回复或布置下一个任务…',
      replyLabel: '回复 / Reply',
    }))
  console.log(r.status, r.text)
}

async function notifyApproval(tool, reason) {
  const r = await reqJson(API + '/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' } },
    JSON.stringify({
      kind: 'approval',
      title: 'DeepSeek Harness 请求权限 / Permission requested',
      message: '工具: ' + (tool || 'bash') + '\n原因: ' + (reason || 'escalate sandbox to workspace-write: 测试') + '\n参数: { "command": "..." }',
      sessionId: '',
      approvalId: 'cli-' + Date.now(),
      rpcId: 'cli-rpc',
      toolName: tool || 'bash',
      approveLabel: '允许一次 / Allow once',
      rejectLabel: '拒绝 / Reject',
      tag: 'dsh-approval-cli-' + Date.now(),
      group: 'DeepSeekHarness.Desktop',
    }))
  console.log(r.status, r.text)
}

const [cmd, a, b] = process.argv.slice(2)
const run = {
  check: () => check(),
  raw: () => raw(a, b),
  open: () => open(a),
  'open-url': () => openUrl(a),
  settings: () => settings(a, b),
  type: () => console.log(a ? kindOf(a) : 'usage: node cli.js type <path>'),
  samples: () => samples(a),
  notify: () => notifyBasic(a, b),
  'notify-turn': () => notifyTurn(a),
  'notify-approval': () => notifyApproval(a, b),
}
if (!run[cmd]) {
  console.log('dsh-desktop-framework CLI')
  console.log('usage: node cli.js <command> [args]')
  console.log('commands: check | raw <path> [range] | open <path> | open-url <url> | settings [k [v]] | type <path> | samples [dir] | notify [title] [msg] | notify-turn [preview] | notify-approval [tool] [reason]')
  process.exit(1)
}
Promise.resolve(run[cmd]()).catch((e) => { console.error('error:', e.message); process.exit(1) })