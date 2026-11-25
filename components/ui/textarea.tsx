import * as React from 'react'

import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

function Textarea({
  className,
  label,
  isError,
  errorMessage,
  style,
  ...props
}: React.ComponentProps<'textarea'> & {
  label?: string
  isError?: boolean
  errorMessage?: string
}) {
  const textareaStyle = {
    maxHeight: '24rem',
    ...style,
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <Label className={cn(isError && 'text-destructive')}>{label}</Label>}
      <textarea
        data-slot="textarea"
        className={cn(
          'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive desktop:text-sm flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
          'resize-y',
          isError && 'border-destructive',
          className,
        )}
        style={textareaStyle}
        {...props}
      />
      {isError && errorMessage && <p className="text-destructive text-xs">{errorMessage}</p>}
    </div>
  )
}

export { Textarea }
