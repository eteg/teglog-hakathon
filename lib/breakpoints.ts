export const DESKTOP_BREAKPOINT_CSS_VARIABLE = '--breakpoint-desktop'

/** Landscape phones / short windows — prefer compact filter layouts. */
export const SHORT_VIEWPORT_MEDIA_QUERY = '(max-height: 40rem)'

const ALWAYS_MATCH_MEDIA_QUERY = '(width >= 0px)'
const NEVER_MATCH_MEDIA_QUERY = '(width < 0px)'

function resolveDesktopBreakpoint(breakpoint?: number) {
  if (breakpoint !== undefined) return `${breakpoint}px`
  if (typeof window === 'undefined') return null

  const value = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue(DESKTOP_BREAKPOINT_CSS_VARIABLE)
    .trim()

  return value || null
}

export function getDesktopMediaQuery(breakpoint?: number) {
  const value = resolveDesktopBreakpoint(breakpoint)

  return value ? `(width >= ${value})` : NEVER_MATCH_MEDIA_QUERY
}

export function getBelowDesktopMediaQuery(breakpoint?: number) {
  const value = resolveDesktopBreakpoint(breakpoint)

  return value ? `(width < ${value})` : ALWAYS_MATCH_MEDIA_QUERY
}
