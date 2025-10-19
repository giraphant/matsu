"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { MoreHorizontal, Pencil, Trash2, ArrowUpDown, LineChart, Power } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type MonitorData = {
  id: string
  name: string
  formula: string
  unit?: string
  description?: string
  color?: string
  decimal_places: number
  enabled: boolean
  value?: number
  computed_at?: string
  created_at: string
  updated_at: string
  tags?: string[]
}

export const columns: ColumnDef<MonitorData>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const monitor = row.original
      return (
        <div className="flex flex-col">
          <span className="font-medium">{monitor.name}</span>
          {monitor.description && (
            <span className="text-xs text-muted-foreground">{monitor.description}</span>
          )}
        </div>
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
  },
  {
    accessorKey: "formula",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Formula
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => (
      <code className="text-xs bg-muted px-2 py-1 rounded">{row.getValue("formula")}</code>
    ),
    enableSorting: true,
  },
  {
    accessorKey: "value",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Current Value
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const monitor = row.original
      if (monitor.value === null || monitor.value === undefined) return "N/A"
      const formatted = monitor.value.toFixed(monitor.decimal_places)
      return monitor.unit ? `${formatted} ${monitor.unit}` : formatted
    },
    enableSorting: true,
  },
  {
    accessorKey: "enabled",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const enabled = row.getValue("enabled") as boolean
      return (
        <Badge variant={enabled ? "default" : "secondary"}>
          {enabled ? "Enabled" : "Disabled"}
        </Badge>
      )
    },
    enableSorting: true,
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const monitor = row.original
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
            <DropdownMenuItem onClick={() => meta?.onViewChart?.(monitor)}>
              <LineChart className="mr-2 h-4 w-4" />
              View
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => meta?.onToggle?.(monitor)}>
              <Power className="mr-2 h-4 w-4" />
              {monitor.enabled ? "Disable" : "Enable"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => meta?.onEdit?.(monitor)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => meta?.onDelete?.(monitor.id)}
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
