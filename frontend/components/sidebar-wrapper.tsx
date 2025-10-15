"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { useState } from "react"

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  // Read sidebar state from cookie during initialization
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true

    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('sidebar_state='))

    if (cookie) {
      return cookie.split('=')[1] === 'true'
    }
    return true
  })

  return (
    <SidebarProvider
      open={open}
      onOpenChange={setOpen}
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
    >
      {children}
    </SidebarProvider>
  )
}
