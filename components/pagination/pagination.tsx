'use client'

// Port de mca-refactor/shared/components/pagination (i18n trocado por textos fixos).
import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMediaQuery } from '@/hooks/use-media-query'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: number) => void
  disabled?: boolean
  options?: number[]
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  disabled = false,
  options = [10, 20, 50, 100],
}: PaginationProps) {
  const isDesktop = useMediaQuery('(min-width: 652px)')

  useEffect(() => {
    if (disabled) return
    if (totalPages > 0 && currentPage > totalPages) {
      onPageChange(totalPages)
    }
  }, [currentPage, totalPages, onPageChange, disabled])

  const WINDOW = 3
  const isFirst = currentPage === 1
  const isLast = totalPages === 0 || currentPage === totalPages

  const currentGroup = Math.ceil(currentPage / WINDOW)
  const windowStart = (currentGroup - 1) * WINDOW + 1
  const windowEnd = Math.min(windowStart + WINDOW - 1, totalPages)
  const visiblePages = Array.from(
    { length: windowEnd - windowStart + 1 },
    (_, i) => windowStart + i,
  )

  const showLeftEllipsis = windowStart > 1
  const showRightEllipsis = windowEnd < totalPages

  const handleLeftEllipsis = () => onPageChange(windowStart - 1)
  const handleRightEllipsis = () => onPageChange(windowEnd + 1)

  return (
    <div className="mt-auto flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex items-center justify-between gap-3 max-[560px]:w-full">
        <span
          className="text-muted-foreground shrink-0 text-sm font-medium whitespace-nowrap"
          data-testid="pagination-total"
        >
          {totalItems === 1 ? '1 resultado' : `${totalItems} resultados`}
        </span>

        <PageSizeSelect
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={onItemsPerPageChange}
          onPageChange={onPageChange}
          disabled={disabled}
          options={options}
          triggerClassName="min-[560px]:hidden"
          selectTestId="select-96ea69023b84"
          triggerTestId="selecttrigger-e8b56d0ce8e5"
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 max-[560px]:flex-1">
        <div className="flex shrink-0 items-center gap-1 max-[560px]:mx-auto">
          {isDesktop && (
            <Button
              className="max-desktop:size-11"
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onPageChange(1)}
              disabled={isFirst || disabled}
              aria-label={'Primeira página'}
              title={'Primeira página'}
              data-testid={`button-bf1eb063bdd0`}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          )}

          <Button
            className="max-desktop:h-11 max-desktop:w-10"
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={isFirst || disabled}
            aria-label={'Página anterior'}
            title={'Página anterior'}
            data-testid={`button-fbe9cda02568`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {showLeftEllipsis && (
            <Button
              className="max-desktop:size-11"
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleLeftEllipsis}
              disabled={disabled}
              data-testid={`button-b2259949452d`}
            >
              ...
            </Button>
          )}

          {visiblePages.map((page) => (
            <Button
              className="max-desktop:size-11"
              key={page}
              type="button"
              variant={page === currentPage ? 'outline' : 'ghost'}
              size="icon-sm"
              onClick={() => onPageChange(page)}
              disabled={disabled}
              data-testid={`button-0f6d1935237a-${page}`}
            >
              {page}
            </Button>
          ))}

          {showRightEllipsis && (
            <Button
              className="max-desktop:size-11"
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleRightEllipsis}
              disabled={disabled}
              data-testid={`button-cbeedb7a4825`}
            >
              ...
            </Button>
          )}

          <Button
            className="max-desktop:h-11 max-desktop:w-10"
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={isLast || disabled}
            aria-label={'Próxima página'}
            title={'Próxima página'}
            data-testid={`button-bbf441d3d513`}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {isDesktop && (
            <Button
              className="max-desktop:size-11"
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onPageChange(totalPages)}
              disabled={isLast || disabled}
              aria-label={'Última página'}
              title={'Última página'}
              data-testid={`button-fd2bb1aaf728`}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        <PageSizeSelect
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={onItemsPerPageChange}
          onPageChange={onPageChange}
          disabled={disabled}
          options={options}
          triggerClassName="max-[560px]:hidden"
          selectTestId="select-971d05fae295"
          triggerTestId="selecttrigger-b210910e2fd8"
          contentTestId="selectcontent-39a117bf0efe"
        />
      </div>
    </div>
  )
}

type PageSizeSelectProps = {
  itemsPerPage: number
  onItemsPerPageChange: (value: number) => void
  onPageChange: (page: number) => void
  disabled: boolean
  options: number[]
  triggerClassName: string
  selectTestId: string
  triggerTestId: string
  contentTestId?: string
}

function PageSizeSelect({
  itemsPerPage,
  onItemsPerPageChange,
  onPageChange,
  disabled,
  options,
  triggerClassName,
  selectTestId,
  triggerTestId,
  contentTestId,
}: PageSizeSelectProps) {
  const [selectOpen, setSelectOpen] = useState(false)

  return (
    <Select
      value={String(itemsPerPage)}
      open={selectOpen}
      onOpenChange={setSelectOpen}
      onValueChange={(value) => {
        flushSync(() => setSelectOpen(false))
        onItemsPerPageChange(Number(value))
        onPageChange(1)
      }}
      disabled={disabled}
      data-testid={selectTestId}
    >
      <SelectTrigger
        size="sm"
        className={cn(
          'text-primary dark:text-foreground max-desktop:h-11! w-auto shrink-0 rounded-lg whitespace-nowrap transition-all duration-200 hover:bg-white/20',
          triggerClassName,
        )}
        data-testid={triggerTestId}
      >
        <SelectValue data-testid={`selectvalue-b085e68b8b3c`}>
          {`${itemsPerPage} por página`}
        </SelectValue>
      </SelectTrigger>
      <SelectContent data-testid={contentTestId}>
        {options.map((opt) => (
          <SelectItem
            key={opt}
            value={String(opt)}
            data-testid={`selectitem-96754aaef6b0-${opt}`}
            className="max-desktop:h-11! cursor-pointer transition-all duration-200 hover:scale-[1.03]"
          >
            {`${opt} por página`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
