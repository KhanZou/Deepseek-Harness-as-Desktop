// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SkillConfigEntry } from '@deepseek-ai/dsh-api-remotes/client'
import type { RpcResponse } from '@deepseek-ai/dsh-api-remotes/client'
import { SkillsManagerSurface, type SkillsManagerApi } from '../src/client/SkillsManagerModal.tsx'
import { Toggle } from '../src/client/Toggle.tsx'
import { NS, zh } from '../src/client/locales.ts'
// Type-only: brings the skillManager LocaleNamespaceMap merge into the
// aggregate program (the typed t seat resolves through it).
import type {} from '../src/client/index.ts'

afterEach(cleanup)

const t = makeTranslate(zh, commonZh) as never as TranslateNS<typeof NS>

const rpc = <T,>(value: T): RpcResponse<T> => ({ rpcId: 'r' as never, result: { ok: true, value } })
const rpcErr = (message: string): RpcResponse<never> => ({ rpcId: 'r' as never, result: { ok: false, error: { code: 'internal', message, details: {} } } })

function entry(name: string, scope: 'project' | 'global', enabled: boolean, source = 'project-dsh'): SkillConfigEntry {
  return { name, description: `${name} description`, source, scope, enabled, modelInvocable: true, userInvocable: true }
}

/** Scripted skills API: inspect serves a mutable list; setEnabled mutates it. */
function scriptedApi(initial: SkillConfigEntry[]): { api: SkillsManagerApi; entries: () => SkillConfigEntry[] } {
  let entries = [...initial]
  const api = {
    inspect: vi.fn(async ({ cwd }: { cwd: string }) =>
      rpc({ projectRoot: cwd, entries: [...entries] })),
    setEnabled: vi.fn(async ({ cwd, name, enabled, scope }: { cwd: string; name: string; enabled: boolean; scope: 'project' | 'global' }) => {
      entries = entries.map(item => (item.name === name && item.scope === scope ? { ...item, enabled } : item))
      return rpc({ projectRoot: cwd, entries: [...entries] })
    }),
    exportConfig: vi.fn(async () => rpc({ json: JSON.stringify({ version: 1, disabled: ['alpha'] }) })),
    applyConfig: vi.fn(async ({ cwd, json }: { cwd: string; json: string }) => {
      const parsed = JSON.parse(json) as { disabled: string[] }
      entries = entries.map(item => ({ ...item, enabled: !parsed.disabled.includes(item.name) }))
      return rpc({ projectRoot: cwd, entries: [...entries] })
    }),
  }
  return { api: api as unknown as SkillsManagerApi, entries: () => entries }
}

const workspace = { workspaceId: 'w' as never, cwd: '/projects/project', label: 'Project' }

describe('SkillsManagerSurface', () => {
  it('loads and renders project and global sections with toggles', async () => {
    const { api } = scriptedApi([entry('alpha', 'project', true), entry('gamma', 'global', false)])
    render(<SkillsManagerSurface open workspace={workspace} onCancel={vi.fn()} api={api} t={t} />)
    expect(await screen.findByText('alpha')).toBeTruthy()
    expect(screen.getByText('gamma')).toBeTruthy()
    expect(screen.getByText('项目技能')).toBeTruthy()
    expect(screen.getByText('全局技能')).toBeTruthy()
    // alpha enabled, gamma disabled
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(2)
    expect(switches[0]?.getAttribute('aria-checked')).toBe('true')
    expect(switches[1]?.getAttribute('aria-checked')).toBe('false')
  })

  it('renders the empty state when nothing is installed', async () => {
    const { api } = scriptedApi([])
    render(<SkillsManagerSurface open workspace={workspace} onCancel={vi.fn()} api={api} t={t} />)
    expect(await screen.findByText('该项目未安装任何技能。')).toBeTruthy()
  })

  it('shows the failure state when inspect rejects', async () => {
    const api = {
      inspect: vi.fn(async () => rpcErr('boom')),
    } as unknown as SkillsManagerApi
    render(<SkillsManagerSurface open workspace={workspace} onCancel={vi.fn()} api={api} t={t} />)
    expect(await screen.findByText(/技能加载失败：boom/)).toBeTruthy()
  })

  it('toggles a skill through setEnabled and reflects the fresh view', async () => {
    const { api, entries } = scriptedApi([entry('alpha', 'project', true)])
    render(<SkillsManagerSurface open workspace={workspace} onCancel={vi.fn()} api={api} t={t} />)
    const switchEl = await screen.findByRole('switch')
    fireEvent.click(switchEl)
    await waitFor(() => expect(entries().find(item => item.name === 'alpha')?.enabled).toBe(false))
    await waitFor(() => expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false'))
    expect(api.setEnabled).toHaveBeenCalledWith({ cwd: '/projects/project', name: 'alpha', enabled: false, scope: 'project' })
  })

  it('recovers with a toast when setEnabled fails and reloads', async () => {
    const { api } = scriptedApi([entry('alpha', 'project', true)])
    api.setEnabled = vi.fn(async () => rpcErr('denied'))
    render(<SkillsManagerSurface open workspace={workspace} onCancel={vi.fn()} api={api} t={t} />)
    fireEvent.click(await screen.findByRole('switch'))
    expect(await screen.findByRole('alert')).toBeTruthy()
    await waitFor(() => expect(api.inspect).toHaveBeenCalledTimes(2))
  })

  it('copies the exported config to the clipboard', async () => {
    const writeText = vi.fn(async () => {})
    const prior = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText, readText: vi.fn(async () => '') } })
    try {
      const { api } = scriptedApi([entry('alpha', 'project', true)])
      render(<SkillsManagerSurface open workspace={workspace} onCancel={vi.fn()} api={api} t={t} />)
      await screen.findByText('alpha')
      fireEvent.click(screen.getByRole('button', { name: '复制配置' }))
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(JSON.stringify({ version: 1, disabled: ['alpha'] })))
      expect(await screen.findByText('配置已复制到剪贴板')).toBeTruthy()
    } finally {
      if (prior === undefined) delete (navigator as { clipboard?: unknown }).clipboard
      else Object.defineProperty(navigator, 'clipboard', prior)
    }
  })

  it('applies a config from the clipboard and reflects the fresh view', async () => {
    const readText = vi.fn(async () => JSON.stringify({ version: 1, disabled: ['beta'] }))
    const prior = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => {}), readText } })
    try {
      const { api, entries } = scriptedApi([entry('alpha', 'project', true), entry('beta', 'project', true)])
      render(<SkillsManagerSurface open workspace={workspace} onCancel={vi.fn()} api={api} t={t} />)
      await screen.findByText('alpha')
      fireEvent.click(screen.getByRole('button', { name: '应用配置' }))
      await waitFor(() => expect(entries().find(item => item.name === 'beta')?.enabled).toBe(false))
      expect(api.applyConfig).toHaveBeenCalledWith({ cwd: '/projects/project', json: JSON.stringify({ version: 1, disabled: ['beta'] }) })
      expect(await screen.findByText('配置已应用到该项目')).toBeTruthy()
    } finally {
      if (prior === undefined) delete (navigator as { clipboard?: unknown }).clipboard
      else Object.defineProperty(navigator, 'clipboard', prior)
    }
  })

  it('dismisses through onCancel and renders nothing while closed', async () => {
    const onCancel = vi.fn()
    const { api } = scriptedApi([entry('alpha', 'project', true)])
    const { unmount } = render(<SkillsManagerSurface open={false} workspace={undefined} onCancel={onCancel} api={api} t={t} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    unmount()
    render(<SkillsManagerSurface open workspace={workspace} onCancel={onCancel} api={api} t={t} />)
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})

describe('Toggle', () => {
  it('renders a switch and flips on click', () => {
    const onChange = vi.fn()
    const { rerender } = render(<Toggle checked={false} onChange={onChange} label="启用 alpha" />)
    const el = screen.getByRole('switch')
    expect(el.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(el)
    expect(onChange).toHaveBeenCalledWith(true)
    rerender(<Toggle checked onChange={onChange} label="禁用 alpha" />)
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
  })

  it('honors disabled and calls with false when checked', () => {
    const onChange = vi.fn()
    render(<Toggle checked onChange={onChange} label="禁用 alpha" disabled />)
    const el = screen.getByRole('switch')
    expect(el.hasAttribute('disabled')).toBe(true)
    fireEvent.click(el)
    expect(onChange).not.toHaveBeenCalled()
  })
})
