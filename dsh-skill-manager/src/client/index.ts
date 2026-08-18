/**
 * Skill manager plugin, browser half: fills ui-workspace's
 * `sidebar.workspaces.skillManager` hole with the skills dialog. The project
 * row's ⋯ menu entry is owned by ui-workspace (occupancy-gated); this package
 * owns the whole dialog interaction over the skill.* manager RPCs.
 */
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotMap merge declaring the skill-manager hole.
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import { SkillsManagerSurface, type SkillsManagerInjected } from './SkillsManagerModal.tsx'
import { en, NS, zh, type SkillManagerKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The skill manager dialog's copy. */
    skillManager: SkillManagerKey
  }
}

/** Required services (cordis fiber inject): slots, the wire connection, locale. */
export const inject = ['slots', 'connection', 'locale']

/**
 * Client plugin body: register the dialog's dictionaries and the manager
 * surface into the workspace skill-manager hole through `slots.inject()`.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-skill-manager: dictionaries')

  const injected = (): SkillsManagerInjected => ({
    // The RPC rides the plugin's root-context connection captured at
    // registration, exactly like the ui-skill slash source.
    api: (ctx.get('connection') as ConnectionHandle).api.skills,
    t: ctx.locale.bind(NS),
  })
  ctx.slots.inject('sidebar.workspaces.skillManager', () =>
    ctx.slots.register({
      name: 'sidebar.workspaces.skillManager',
      inject: injected,
      locale: NS,
    }, SkillsManagerSurface))
}
