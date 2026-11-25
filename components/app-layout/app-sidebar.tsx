'use client'

// Port de mca-refactor/shared/components/sidebar.tsx (Link do TanStack → next/link).
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fragment, useRef, useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarGroup as ShadcnSidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { NAVIGATION, isActive, type AppNavigationGroup } from './navigation'

function SidebarToggleButton() {
  const { toggleSidebar, state } = useSidebar()
  const collapsed = state === 'collapsed'
  return (
    <div className={cn('flex h-[41px] items-center pb-4', collapsed ? 'justify-center' : 'justify-end')}>
      <button
        onClick={toggleSidebar}
        className="hover:bg-accent rounded p-1 transition-colors"
        aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
      >
        {collapsed ? (
          <PanelLeftOpen className="text-muted-foreground h-6 w-6" strokeWidth={1} />
        ) : (
          <PanelLeftClose className="text-muted-foreground h-6 w-6" strokeWidth={1} />
        )}
      </button>
    </div>
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  return (
    <ShadcnSidebar collapsible="icon" mobileSheet={false} className="top-[60px]! h-[calc(100svh-60px)]! overflow-x-hidden">
      <SidebarHeader className="p-4 pb-0">
        <SidebarToggleButton />
      </SidebarHeader>
      <SidebarContent className="gap-3 overflow-x-hidden p-4 pt-0 group-data-[state=collapsed]:gap-6 group-data-[state=collapsed]:pt-4">
        {NAVIGATION.map((group, i) => (
          <Fragment key={group.title}>
            {i > 0 && <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />}
            <NavGroup group={group} pathname={pathname} />
          </Fragment>
        ))}
      </SidebarContent>
    </ShadcnSidebar>
  )
}

function NavGroup({ group, pathname }: { group: AppNavigationGroup; pathname: string }) {
  const [open, setOpen] = useState(false)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const enter = () => {
    if (timeout.current) clearTimeout(timeout.current)
    setOpen(true)
  }
  const leave = () => {
    timeout.current = setTimeout(() => setOpen(false), 150)
  }

  return (
    <ShadcnSidebarGroup className="gap-0 p-0">
      <SidebarGroupLabel className="text-muted-foreground h-7 gap-2 px-2">
        <group.icon className="h-4 w-4 shrink-0" />
        {group.title}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-[10px] group-data-[state=collapsed]:gap-10">
          {/* Recolhida: ícone com popover dos itens */}
          <SidebarMenuItem className="group-data-[state=expanded]:hidden" onMouseEnter={enter} onMouseLeave={leave}>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <SidebarMenuButton className="text-muted-foreground hover:text-muted-foreground justify-center group-data-[collapsible=icon]:size-10!">
                  <group.icon className="size-4 shrink-0" />
                </SidebarMenuButton>
              </PopoverTrigger>
              <PopoverContent side="right" align="start" sideOffset={8} className="w-48 p-1" onMouseEnter={enter} onMouseLeave={leave}>
                <p className="text-muted-foreground px-2 py-1.5 text-xs font-semibold">{group.title}</p>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="hover:bg-accent hover:text-accent-foreground flex w-full rounded-sm px-2 py-1.5 text-sm transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </PopoverContent>
            </Popover>
          </SidebarMenuItem>

          {group.items.map((item) => (
            <SidebarMenuItem key={item.href} className="group-data-[collapsible=icon]:hidden">
              <SidebarMenuButton
                asChild
                isActive={isActive(pathname, item.href)}
                className="text-foreground h-8 cursor-pointer pl-8 text-[14px] font-normal"
              >
                <Link href={item.href}>
                  <span className="truncate">{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </ShadcnSidebarGroup>
  )
}
