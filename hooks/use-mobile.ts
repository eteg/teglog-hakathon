'use client'

import { getBelowDesktopMediaQuery } from '@/lib/breakpoints'
import { useMediaQuery } from '@/hooks/use-media-query'

export function useIsMobile() {
  return useMediaQuery(getBelowDesktopMediaQuery())
}
