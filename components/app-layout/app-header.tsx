'use client'

// Port de mca-refactor/shared/components/app-layout/app-header.tsx (sem auth/offline).
import { Menu, Truck, XIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PRODUTO } from '@/lib/produto'
import { NAVIGATION } from './navigation'

export function AppHeader() {
  return (
    <div className="app-header sticky top-0 z-40 flex w-full flex-col">
      <div
        className="relative z-40 flex h-15 w-full items-center justify-between border-b px-3 py-2 transition-colors duration-300 sm:px-6 sm:py-2.5"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        <Link href="/" className="text-foreground flex shrink-0 items-center gap-2 font-semibold sm:gap-3">
          <Truck className="size-5" />
          {PRODUTO.nome}
        </Link>
        <div className="desktop:gap-4 flex min-w-0 items-center justify-end gap-3">
          <MobileNavigationMenu />
        </div>
      </div>
    </div>
  )
}

function MobileNavigationMenu() {
  const [open, setOpen] = useState(false)
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="group desktop:hidden h-11 w-fit rounded-full border border-transparent px-2 py-1 hover:border-white/30 hover:bg-white/20"
          aria-label="Menu"
        >
          <div className="relative grid size-7 place-items-center">
            <Menu className="text-foreground absolute size-5 scale-100 rotate-0 transition-all group-data-[state=open]:scale-0 group-data-[state=open]:-rotate-90" />
            <XIcon className="text-foreground absolute size-5 scale-0 -rotate-90 transition-all group-data-[state=open]:scale-100 group-data-[state=open]:rotate-0" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      {open && (
        <DropdownMenuContent
          align="end"
          side="bottom"
          sideOffset={8}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="max-h-[calc(100svh-76px)] w-[calc(100vw)] max-w-none overflow-y-auto rounded-t-none p-2"
        >
          <Accordion type="multiple" defaultValue={NAVIGATION.map((g) => g.title)} className="w-full">
            {NAVIGATION.map((group) => (
              <AccordionItem key={group.title} value={group.title} className="border-border/70">
                <AccordionTrigger className="hover:bg-accent/50 flex min-h-11 items-center rounded-md px-2 py-2 text-sm font-semibold hover:no-underline">
                  <span className="flex min-w-0 items-center gap-2">
                    <group.icon className="text-muted-foreground size-4 shrink-0" />
                    <span className="truncate">{group.title}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-0 pb-2">
                  {group.items.map((item) => (
                    <DropdownMenuItem key={item.href} asChild className="min-h-11 cursor-pointer px-3 text-sm">
                      <Link href={item.href} onClick={() => setOpen(false)}>
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}
