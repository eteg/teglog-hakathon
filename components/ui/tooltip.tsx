'use client'

import * as React from 'react'
import { Tooltip as TooltipPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

/**
 * Content and arrow are declared together on purpose: the arrow is the one part
 * a call site cannot reach, so a variant that recoloured only the panel would
 * leave a mismatched dark dot pointing at it.
 *
 * `panel` is the light surface used by the "applied filters" summaries and by
 * the pending-sync chip — for a tooltip that is a small panel of key/value
 * lines rather than a one-line hint.
 */
const TOOLTIP_VARIANTS = {
  default: {
    content: 'bg-foreground text-background',
    arrow: 'bg-foreground fill-foreground',
  },
  panel: {
    content: 'bg-sidebar text-sidebar-foreground border border-sidebar-border',
    // The arrow is a square rotated 45°, so only two of its sides are exposed;
    // bordering all four would draw a line across the panel.
    arrow: 'bg-sidebar fill-sidebar border-r border-b border-sidebar-border',
  },
} as const

type TooltipVariant = keyof typeof TOOLTIP_VARIANTS

function TooltipTrigger({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  hideArrow = false,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & {
  hideArrow?: boolean
  variant?: TooltipVariant
}) {
  const colors = TOOLTIP_VARIANTS[variant]

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        data-variant={variant}
        sideOffset={sideOffset}
        className={cn(
          'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance wrap-break-word',
          colors.content,
          className,
        )}
        {...props}
      >
        {children}
        {!hideArrow && (
          <TooltipPrimitive.Arrow
            className={cn(
              'z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]',
              colors.arrow,
            )}
          />
        )}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
