import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full">
        <div className="flex h-14 items-center gap-4 border-b px-4 lg:h-[60px] lg:px-6">
          <SidebarTrigger />
          <h1 className="text-lg font-semibold">Welcome to Matsu</h1>
        </div>
        <div className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          <div className="flex items-center">
            <h1 className="text-lg font-semibold md:text-2xl">Dashboard</h1>
          </div>
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
            <div className="flex flex-col items-center gap-1 text-center">
              <h3 className="text-2xl font-bold tracking-tight">
                New Clean Frontend
              </h3>
              <p className="text-sm text-muted-foreground">
                Built with Vite + React + TypeScript + shadcn/ui
              </p>
            </div>
          </div>
        </div>
      </main>
    </SidebarProvider>
  )
}

export default App
