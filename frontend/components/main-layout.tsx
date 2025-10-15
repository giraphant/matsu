"use client"

import { usePathname } from "next/navigation"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarWrapper } from "@/components/sidebar-wrapper"
import { ThemeToggle } from "@/components/theme-toggle"
import { ProtectedRoute } from "@/components/protected-route"
import { LogoutButton } from "@/components/logout-button"

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <ProtectedRoute>
      <SidebarWrapper>
        <AppSidebar />
        <main className="flex-1 w-full">
          <div className="border-b">
            <div className="flex h-16 items-center px-4 justify-between">
              <SidebarTrigger />
              <div className="flex items-center gap-2">
                <LogoutButton />
                <ThemeToggle />
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-4 p-8 pt-6">
            {children}
          </div>
        </main>
      </SidebarWrapper>
    </ProtectedRoute>
  )
}
