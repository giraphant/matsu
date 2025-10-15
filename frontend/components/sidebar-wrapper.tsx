"use client"

import { useEffect, useState } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const [defaultOpen, setDefaultOpen] = useState(true)

  useEffect(() => {
    // Read sidebar state from cookie
    const cookie = document.cookie
      .split('; ')
      .find(row => row.startsWith('sidebar_state='))

    if (cookie) {
      const value = cookie.split('=')[1]
      setDefaultOpen(value === 'true')
    }
  }, [])

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
    >
      {children}
    </SidebarProvider>
  )
}
