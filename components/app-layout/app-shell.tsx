'use client'

// Port de mca-refactor/shared/components/app-layout/app-layout.tsx.
import type { CSSProperties, ReactNode } from 'react'
import { Suspense } from 'react'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppHeader } from './app-header'
import { AppSidebar } from './app-sidebar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader />
      <SidebarProvider
        style={{ '--sidebar-width': '260px', '--sidebar-width-icon': '4rem' } as CSSProperties}
        className="min-h-0 flex-1 overflow-hidden"
      >
        <Suspense fallback={null}>
          <AppSidebar />
        </Suspense>
        <SidebarInset className="overflow-auto">{children}</SidebarInset>
      </SidebarProvider>
    </div>
  )
}
