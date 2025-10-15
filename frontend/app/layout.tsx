import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarWrapper } from "@/components/sidebar-wrapper"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata: Metadata = {
  title: "Matsu Monitor",
  description: "Monitoring Dashboard",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          src="/theme-init.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          storageKey="matsu-theme"
        >
          <SidebarWrapper>
            <AppSidebar />
            <main className="flex-1 w-full">
              <div className="border-b">
                <div className="flex h-16 items-center px-4 justify-between">
                  <SidebarTrigger />
                  <ThemeToggle />
                </div>
              </div>
              <div className="flex-1 space-y-4 p-8 pt-6">
                {children}
              </div>
            </main>
          </SidebarWrapper>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}