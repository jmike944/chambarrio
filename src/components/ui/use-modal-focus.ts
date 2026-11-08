"use client"

import * as React from "react"

/*
 * Focus handling shared by Dialog, AlertDialog and Drawer.
 *
 * - Focus goes back to whatever opened the modal. Modals opened from state (a menu item, a list row)
 *   have no Radix trigger, so focus used to fall to <body> when they closed.
 * - "dialog": on touch screens, never open with a text field focused. The iPhone keyboard would pop up
 *   at once and cover the dialog's buttons; the dialog itself takes focus and the person taps the field.
 * - "sheet": vaul doesn't move focus into a sheet at all (focus stayed on the trigger behind the
 *   overlay). The sheet itself takes focus, never its first field (same keyboard problem).
 */

type Handler = ((event: Event) => void) | undefined

const TEXT_ENTRY =
  "textarea, [contenteditable]:not([contenteditable='false']), input:not([type='checkbox'], [type='radio'], [type='button'], [type='submit'], [type='reset'], [type='range'], [type='color'], [type='file'], [type='image'])"
// What Radix would focus first (it skips links).
const CANDIDATES = "button, input, select, textarea, [tabindex], [contenteditable]:not([contenteditable='false'])"

function firstTabbable(container: HTMLElement) {
  for (const el of container.querySelectorAll<HTMLElement>(CANDIDATES)) {
    if (el.tabIndex < 0 || el.matches(":disabled, [type='hidden']")) continue
    if (!el.getClientRects().length) continue
    return el
  }
  return null
}

export function useModalFocus(
  kind: "dialog" | "alert" | "sheet",
  { onOpenAutoFocus, onCloseAutoFocus }: { onOpenAutoFocus?: Handler; onCloseAutoFocus?: Handler }
) {
  const opener = React.useRef<HTMLElement | null>(null)

  return {
    onOpenAutoFocus(event: Event) {
      const active = document.activeElement
      opener.current = active instanceof HTMLElement && active !== document.body ? active : null
      onOpenAutoFocus?.(event)
      if (event.defaultPrevented || kind === "alert") return
      const content = event.currentTarget instanceof HTMLElement ? event.currentTarget : null
      if (!content) return
      const touch = window.matchMedia("(pointer: coarse)").matches
      if (kind === "sheet" || (touch && firstTabbable(content)?.matches(TEXT_ENTRY))) {
        event.preventDefault()
        content.focus({ preventScroll: true })
      }
    },
    onCloseAutoFocus(event: Event) {
      onCloseAutoFocus?.(event)
      const back = opener.current
      opener.current = null
      if (event.defaultPrevented || !back?.isConnected) return
      event.preventDefault()
      back.focus({ preventScroll: true })
    },
  }
}
