"use client"

import { SidebarProvider } from "@/components/ui/sidebar"

// Read initial state from cookie immediately
function getInitialSidebarState(): boolean {
  if (typeof window === 'undefined') return true

  const cookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('sidebar_state='))

  if (cookie) {
    return cookie.split('=')[1] === 'true'
  }

  return true
}

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider
      defaultOpen={getInitialSidebarState()}
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
    >
      {children}
    </SidebarProvider>
  )
}
