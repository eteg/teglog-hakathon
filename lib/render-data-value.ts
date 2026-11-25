import { format as formatDate } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import * as React from 'react'

type RenderDataValueOptions = {
  emptyValue?: React.ReactNode
  emptyStringValue?: React.ReactNode
}

const DATE_LIKE_STRING_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/

export function renderDataValue(
  value: unknown,
  { emptyValue = null, emptyStringValue = '' }: RenderDataValueOptions = {},
): React.ReactNode {
  if (value == null) return emptyValue
  if (React.isValidElement(value)) return value
  if (value instanceof Date) return renderDate(value)
  if (typeof value === 'string') {
    if (!value) return emptyStringValue

    const date = parseDateString(value)
    if (date) return renderDate(date)

    return value
  }
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return String(value)

  return String(value)
}

function renderDate(value: Date) {
  return formatDate(value, 'dd/MM/yyyy', { locale: ptBR })
}

function parseDateString(value: string) {
  const trimmedValue = value.trim()
  if (!DATE_LIKE_STRING_PATTERN.test(trimmedValue)) return null

  const date = new Date(trimmedValue)
  if (Number.isNaN(date.getTime())) return null

  return date
}
