import type { Metadata } from "next"
import "./globals.css"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Toaster } from "sonner"

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
    <html lang="en">
      <body className="font-sans antialiased">
        <SidebarProvider>
          <AppSidebar />
          <main className="flex-1">
            <div className="border-b">
              <div className="flex h-16 items-center px-4">
                <SidebarTrigger />
              </div>
            </div>
            <div className="flex-1 space-y-4 p-8 pt-6">
              {children}
            </div>
          </main>
        </SidebarProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}