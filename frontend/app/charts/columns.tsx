"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, MoreHorizontal, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface WebhookData {
  id: string
  uid: string
  title: string
  text: string
  tags: string[]
  data: Record<string, any>
  created_at: string
  time_since: string
  current_value?: number
  previous_value?: number
  change_percent?: number
}

// Helper function to format currency
const formatCurrency = (value: number | undefined) => {
  if (!value) return "N/A"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Helper function to get change indicator
const getChangeIndicator = (change: number | undefined) => {
  if (!change) return <Minus className="h-4 w-4 text-gray-500" />
  if (change > 0) return <TrendingUp className="h-4 w-4 text-green-500" />
  if (change < 0) return <TrendingDown className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-gray-500" />
}

export const columns: ColumnDef<WebhookData>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Title
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return <div className="font-medium">{row.getValue("title")}</div>
    },
  },
  {
    accessorKey: "uid",
    header: "Monitor ID",
    cell: ({ row }) => {
      return <div className="font-mono text-xs">{row.getValue("uid")}</div>
    },
  },
  {
    accessorKey: "current_value",
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
      const value = row.getValue("current_value") as number | undefined
      return <div className="text-right font-medium">{formatCurrency(value)}</div>
    },
  },
  {
    accessorKey: "previous_value",
    header: "Previous Value",
    cell: ({ row }) => {
      const value = row.getValue("previous_value") as number | undefined
      return <div className="text-right text-muted-foreground">{formatCurrency(value)}</div>
    },
  },
  {
    accessorKey: "change_percent",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Change
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const change = row.getValue("change_percent") as number | undefined
      return (
        <div className="flex items-center justify-end gap-2">
          {getChangeIndicator(change)}
          <span className={`font-medium ${
            change && change > 0 ? "text-green-600" :
            change && change < 0 ? "text-red-600" :
            "text-gray-600"
          }`}>
            {change ? `${change.toFixed(2)}%` : "N/A"}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const tags = row.getValue("tags") as string[]
      return (
        <div className="flex gap-1 flex-wrap">
          {tags.slice(0, 2).map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {tags.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{tags.length - 2}
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "time_since",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Last Updated
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      return <div className="text-muted-foreground">{row.getValue("time_since")}</div>
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const webhook = row.original
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
            <DropdownMenuItem
              onClick={() => meta?.onViewChart?.(webhook)}
            >
              View Chart
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => meta?.onViewDetails?.(webhook)}
            >
              View Details
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(webhook.id)}
            >
              Copy webhook ID
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(webhook.uid)}
            >
              Copy monitor ID
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]