// Skills manager dialog: lists project and global skills with enable toggles
// plus config copy/apply. The occupant owns the whole interaction; the owner
// (ui-workspace row menu) only opens it for a project and forwards dismissal.

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { TranslateNS } from '@deepseek-ai/dsh-client-locale/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type { SkillConfigEntry } from '@deepseek-ai/dsh-api-remotes/client'
import { Button, Modal, Toast } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SkillManagerOwnerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import { Toggle } from './Toggle.tsx'
import type { NS } from './locales.ts'
import css from './SkillsManagerModal.module.css'

/** The skills API face the dialog drives (bound to the connection in apply). */
export type SkillsManagerApi = ConnectionHandle['api']['skills']

/** Injected face: wire calls and localized copy. */
export interface SkillsManagerInjected {
  api: SkillsManagerApi
  t: TranslateNS<typeof NS>
}

/** Full occupant props: the owner conversation plus the injected face. */
export type SkillsManagerSurfaceProps = SkillManagerOwnerProps & SkillsManagerInjected

/** Load phase of the dialog's list. */
type Phase =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; entries: readonly SkillConfigEntry[] }
  | { status: 'error'; message: string }

/** One toast show (keyed by sequence so re-shows restart the cycle). */
interface ToastState {
  text: string
  seq: number
}

/** Group the ready entries into the two scopes, keeping name order. */
function groupEntries(entries: readonly SkillConfigEntry[]): { project: SkillConfigEntry[]; global: SkillConfigEntry[] } {
  const project: SkillConfigEntry[] = []
  const global: SkillConfigEntry[] = []
  for (const entry of entries) {
    (entry.scope === 'project' ? project : global).push(entry)
  }
  return { project, global }
}

/** One skill row: name, description, source badge, invocation hint, toggle. */
function SkillRow({ entry, pending, t, onToggle }: {
  entry: SkillConfigEntry
  pending: boolean
  t: TranslateNS<typeof NS>
  onToggle: (next: boolean) => void
}) {
  const badge = entry.source.endsWith('agents') ? t('badge.agents') : t('badge.dsh')
  const invocation = entry.modelInvocable ? t('row.modelAndUser') : t('row.userOnly')
  return (
    <li className={css.row}>
      <div className={css.rowMain}>
        <div className={css.rowTitle}>
          <span className={css.rowName}>{entry.name}</span>
          <span className={clsx(css.badge, entry.scope === 'global' && css.badgeGlobal)}>{badge}</span>
        </div>
        <div className={css.rowDesc}>{entry.description}</div>
        <div className={css.rowHint}>{invocation}</div>
      </div>
      <Toggle
        checked={entry.enabled}
        disabled={pending}
        label={entry.enabled ? t('toggle.disable', { name: entry.name }) : t('toggle.enable', { name: entry.name })}
        onChange={onToggle}
      />
    </li>
  )
}

/**
 * The manager dialog occupant. Renders the Modal when open; loads the fresh
 * snapshot on open/cwd change, applies toggles through `setEnabled`, and
 * offers config copy/apply for cross-project reuse.
 * @param props - owner conversation plus the injected api/copy.
 * @returns the dialog element (Modal renders nothing while closed).
 */
export function SkillsManagerSurface({ open, workspace, onCancel, api, t }: SkillsManagerSurfaceProps): ReactNode {
  const cwd = workspace?.cwd
  const [phase, setPhase] = useState<Phase>({ status: 'idle' })
  const [reloadSeq, setReloadSeq] = useState(0)
  const [pendingName, setPendingName] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (!open || cwd === undefined) return
    let cancelled = false
    setPhase({ status: 'loading' })
    api.inspect({ cwd }).then(({ result }) => {
      if (cancelled) return
      if (!result.ok) {
        setPhase({ status: 'error', message: result.error.message })
        return
      }
      setPhase({ status: 'ready', entries: [...result.value.entries] })
    }).catch((error: unknown) => {
      if (cancelled) return
      setPhase({ status: 'error', message: String(error) })
    })
    return () => { cancelled = true }
  }, [open, cwd, reloadSeq, api])

  const toggle = async (entry: SkillConfigEntry, enabled: boolean): Promise<void> => {
    if (cwd === undefined || phase.status !== 'ready') return
    setPendingName(entry.name)
    try {
      const { result } = await api.setEnabled({ cwd, name: entry.name, enabled, scope: entry.scope })
      if (!result.ok) throw new Error(result.error.message)
      setPhase({ status: 'ready', entries: [...result.value.entries] })
    } catch (error: unknown) {
      setToast({ text: t('action.applyFailed', { message: String(error) }), seq: Date.now() })
      setReloadSeq(seq => seq + 1)
    } finally {
      setPendingName(null)
    }
  }

  const copyConfig = async (): Promise<void> => {
    if (cwd === undefined) return
    try {
      const { result } = await api.exportConfig({ cwd })
      if (!result.ok) throw new Error(result.error.message)
      await navigator.clipboard.writeText(result.value.json)
      setToast({ text: t('action.copied'), seq: Date.now() })
    } catch (error: unknown) {
      setToast({ text: t('action.copyFailed', { message: String(error) }), seq: Date.now() })
    }
  }

  const applyConfig = async (): Promise<void> => {
    if (cwd === undefined) return
    let json: string
    try {
      json = await navigator.clipboard.readText()
    } catch (error: unknown) {
      setToast({ text: t('action.clipboardUnavailable', { message: String(error) }), seq: Date.now() })
      return
    }
    try {
      const { result } = await api.applyConfig({ cwd, json })
      if (!result.ok) throw new Error(result.error.message)
      setPhase({ status: 'ready', entries: [...result.value.entries] })
      setToast({ text: t('action.applied'), seq: Date.now() })
    } catch (error: unknown) {
      setToast({ text: t('action.applyFailed', { message: String(error) }), seq: Date.now() })
    }
  }

  const refresh = (): void => { setReloadSeq(seq => seq + 1) }

  const body = phase.status === 'loading'
    ? <div className={css.status} role="status">{t('dialog.loading')}</div>
    : phase.status === 'error'
      ? <div className={css.status} role="alert">{t('dialog.failed', { message: phase.message })}</div>
      : phase.status === 'ready'
        ? (() => {
          const { project, global } = groupEntries(phase.entries)
          if (project.length === 0 && global.length === 0) {
            return <div className={css.status}>{t('dialog.empty')}</div>
          }
          return (
            <div className={css.sections}>
              {project.length > 0 && (
                <section className={css.section}>
                  <h3 className={css.sectionTitle}>{t('section.project')}</h3>
                  <p className={css.sectionHint}>{t('section.project.hint')}</p>
                  <ul className={css.list}>
                    {project.map(entry => (
                      <SkillRow
                        key={`${entry.scope}:${entry.name}`}
                        entry={entry}
                        pending={pendingName === entry.name}
                        t={t}
                        onToggle={next => { void toggle(entry, next) }}
                      />
                    ))}
                  </ul>
                </section>
              )}
              {global.length > 0 && (
                <section className={css.section}>
                  <h3 className={css.sectionTitle}>{t('section.global')}</h3>
                  <p className={css.sectionHint}>{t('section.global.hint')}</p>
                  <ul className={css.list}>
                    {global.map(entry => (
                      <SkillRow
                        key={`${entry.scope}:${entry.name}`}
                        entry={entry}
                        pending={pendingName === entry.name}
                        t={t}
                        onToggle={next => { void toggle(entry, next) }}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )
        })()
        : null

  return (
    <>
      <Modal
        open={open}
        onClose={onCancel}
        title={t('dialog.title')}
        closeLabel={t('action.close')}
        {...workspace === undefined ? {} : { description: t('footer.project', { path: workspace.cwd }) }}
        className={css.modal!}
        contentClassName={css.content!}
        footer={(
          <div className={css.footer}>
            <Button variant="outline" disabled={cwd === undefined || phase.status === 'loading'} onClick={() => { void copyConfig() }}>
              {t('action.copy')}
            </Button>
            <Button variant="outline" disabled={cwd === undefined || phase.status === 'loading'} onClick={() => { void applyConfig() }}>
              {t('action.apply')}
            </Button>
            <Button variant="outline" disabled={phase.status === 'loading'} onClick={refresh}>
              {t('action.refresh')}
            </Button>
          </div>
        )}
      >
        {body}
      </Modal>
      {toast !== null && (
        <Toast key={toast.seq} text={toast.text} onDone={() => { setToast(null) }} />
      )}
    </>
  )
}
