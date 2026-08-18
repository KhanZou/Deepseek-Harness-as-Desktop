// Toggle: a modern switch (track + thumb) with full keyboard support. The
// dialog owns the checked state; this component only reports the flip.

import clsx from 'clsx'
import type { ReactNode } from 'react'
import css from './Toggle.module.css'

/**
 * Render an accessible switch.
 * @param props.checked - the current on/off state.
 * @param props.onChange - called with the next state when the user flips it.
 * @param props.label - accessible label naming the switch (e.g. "启用 alpha").
 * @param props.disabled - whether the switch is inert (pending writes).
 * @param props.className - optional extra class.
 * @returns the switch element.
 */
export function Toggle({ checked, onChange, label, disabled = false, className }: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
  className?: string
}): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={clsx(css.toggle, checked && css.on, disabled && css.disabled, className)}
      disabled={disabled}
      onClick={() => { onChange(!checked) }}
    >
      <span className={css.thumb} aria-hidden="true" />
    </button>
  )
}
