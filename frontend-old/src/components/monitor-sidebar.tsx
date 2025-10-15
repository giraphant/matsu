import { Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { MonitorSummary } from "@/types/monitor"

interface MonitorSidebarProps {
  monitors: MonitorSummary[]
  selectedMonitor: string | null
  selectedTag: string
  onMonitorSelect: (monitorId: string) => void
  onTagSelect: (tag: string) => void
  onShowManageModal: (show: boolean) => void
  formatValue: (monitor: MonitorSummary) => string
}

export function MonitorSidebar({
  monitors,
  selectedMonitor,
  selectedTag,
  onMonitorSelect,
  onTagSelect,
  onShowManageModal,
  formatValue,
}: MonitorSidebarProps) {
  // Get all unique tags from monitors
  const allTags = Array.from(
    new Set(monitors.flatMap((m) => m.tags || []))
  ).sort()

  // Filter monitors by selected tag
  const visibleMonitors =
    selectedTag === "all"
      ? monitors
      : monitors.filter((m) => m.tags?.includes(selectedTag))

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Monitors</h2>
            <Badge variant="secondary" className="h-5 rounded-md px-1.5 text-xs">
              {visibleMonitors.length}/{monitors.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onShowManageModal(true)}
          >
            <Settings className="h-4 w-4" />
            <span className="sr-only">Manage monitors</span>
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Tag Filter Section */}
        <div className="px-4 py-3">
          <p className="mb-2 text-xs font-medium text-sidebar-foreground/70">
            Filter by Tag
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant={selectedTag === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 rounded-md px-2.5 text-xs"
              onClick={() => onTagSelect("all")}
            >
              All
            </Button>
            {allTags.map((tag) => (
              <Button
                key={tag}
                variant={selectedTag === tag ? "default" : "outline"}
                size="sm"
                className="h-7 rounded-md px-2.5 text-xs"
                onClick={() => onTagSelect(tag)}
              >
                {tag}
              </Button>
            ))}
          </div>
        </div>

        <Separator className="mx-4" />

        {/* Monitor List */}
        <div className="px-2 py-2">
          <SidebarMenu>
            {visibleMonitors.map((monitor) => (
              <SidebarMenuItem key={monitor.monitor_id}>
                <SidebarMenuButton
                  isActive={selectedMonitor === monitor.monitor_id}
                  onClick={() => onMonitorSelect(monitor.monitor_id)}
                  className="flex flex-col items-start gap-1 px-3 py-2.5"
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="truncate text-sm font-medium">
                      {monitor.monitor_name || monitor.monitor_id}
                    </span>
                  </div>
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {monitor.monitor_type || 'monitor'}
                    </span>
                    <span className="text-xs font-semibold tabular-nums">
                      {formatValue(monitor)}
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-4 py-3">
          <p className="text-xs text-sidebar-foreground/70">
            Select a monitor to view details
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
