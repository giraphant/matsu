"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type AlertRuleData = {
  id: string
  name: string
  condition: string
  level: string
  enabled: boolean
  cooldown_seconds: number
  actions: string[]
  created_at?: string
  updated_at?: string
}

const levelColors: Record<string, "default" | "destructive" | "secondary"> = {
  critical: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
}

export const columns: ColumnDef<AlertRuleData>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "condition",
    header: "Condition",
    cell: ({ row }) => (
      <code className="text-xs bg-muted px-2 py-1 rounded whitespace-nowrap">{row.getValue("condition")}</code>
    ),
  },
  {
    accessorKey: "level",
    header: "Level",
    cell: ({ row }) => {
      const level = row.getValue("level") as string
      return (
        <Badge variant={levelColors[level] || "default"}>
          {level.toUpperCase()}
        </Badge>
      )
    },
  },
  {
    accessorKey: "cooldown_seconds",
    header: "Cooldown",
    cell: ({ row }) => {
      const seconds = row.getValue("cooldown_seconds") as number
      const minutes = Math.floor(seconds / 60)
      return minutes > 0 ? `${minutes}m` : `${seconds}s`
    },
  },
  {
    accessorKey: "enabled",
    header: "Status",
    cell: ({ row }) => {
      const enabled = row.getValue("enabled") as boolean
      return (
        <Badge variant={enabled ? "default" : "secondary"}>
          {enabled ? "Enabled" : "Disabled"}
        </Badge>
      )
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const alert = row.original
      const meta = table.options.meta as any

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => meta?.onToggle?.(alert)}>
              {alert.enabled ? "Disable" : "Enable"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => meta?.onEdit?.(alert)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => meta?.onDelete?.(alert.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]
