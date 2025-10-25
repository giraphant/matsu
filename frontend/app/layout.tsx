import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { MainLayout } from "@/components/main-layout"
import { NavigationProgress } from "@/components/navigation-progress"
import { ServiceWorkerProvider } from "@/components/service-worker-provider"

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
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          storageKey="matsu-theme"
        >
          <ServiceWorkerProvider>
            <AuthProvider>
              <NavigationProgress />
              <MainLayout>{children}</MainLayout>
              <Toaster position="bottom-right" />
            </AuthProvider>
          </ServiceWorkerProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}