/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-skill-manager`.
 * @module @deepseek-ai/dsh-client-ui-skill-manager/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-skill-manager'

/** Cordis companion plugin name. */
export const name = 'client-ui-skill-manager-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the manager dialog is a slot registration whose
 * disposal is proven by the same HMR-safety rules as every other occupant; it
 * emits no cordis events and owns no cross-plugin mutable state.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
