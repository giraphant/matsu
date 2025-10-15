import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { OverviewPage, ChartsPage, DexRatesPage, SettingsPage } from "@/pages"

function App() {
  return (
    <BrowserRouter>
      <SidebarProvider>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <main className="flex flex-1 flex-col overflow-hidden">
            <div className="flex h-14 items-center gap-4 border-b px-4 lg:h-[60px] lg:px-6">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold">Matsu Monitor System</h1>
            </div>
            <div className="flex-1 overflow-auto">
              <Routes>
                <Route path="/" element={<Navigate to="/overview" replace />} />
                <Route path="/overview" element={<OverviewPage />} />
                <Route path="/charts" element={<ChartsPage />} />
                <Route path="/dex-rates" element={<DexRatesPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </div>
          </main>
        </div>
      </SidebarProvider>
    </BrowserRouter>
  )
}

export default App
