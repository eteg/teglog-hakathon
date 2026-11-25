'use client'

import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string, defaultValue = false): boolean {
  return useSyncExternalStore(
    (callback) => {
      if (!canUseMatchMedia()) return () => undefined

      const mediaQueryList = window.matchMedia(query)
      mediaQueryList.addEventListener('change', callback)

      return () => mediaQueryList.removeEventListener('change', callback)
    },
    () => {
      if (!canUseMatchMedia()) return defaultValue

      return window.matchMedia(query).matches
    },
    () => defaultValue,
  )
}

function canUseMatchMedia() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}
