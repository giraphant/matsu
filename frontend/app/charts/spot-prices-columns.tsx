"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export interface SpotPriceData {
  exchange: string
  symbol: string
  price: number
  volume_24h: number | null
  timestamp: string
}

// Helper function to format large numbers
const formatVolume = (value: number | null) => {
  if (!value) return 'N/A'

  if (value >= 1000000000) {
    return `$${(value / 1000000000).toFixed(2)}B`
  } else if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`
  } else {
    return `$${value.toFixed(2)}`
  }
}

export const columns: ColumnDef<SpotPriceData>[] = [
  {
    accessorKey: "exchange",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Exchange
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const exchange = row.getValue("exchange") as string
      return (
        <Badge variant="outline" className="font-mono uppercase">
          {exchange}
        </Badge>
      )
    },
  },
  {
    accessorKey: "symbol",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Symbol
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const symbol = row.getValue("symbol") as string
      return (
        <div className="flex items-center gap-2">
          <span className="font-semibold">{symbol}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              navigator.clipboard.writeText(symbol)
              toast.success(`Copied ${symbol}`)
            }}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      )
    },
  },
  {
    accessorKey: "price",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Price (USD)
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const price = row.getValue("price") as number
      return (
        <div className="text-right font-mono font-medium">
          ${price.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: price < 1 ? 6 : 2
          })}
        </div>
      )
    },
  },
  {
    accessorKey: "volume_24h",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          24h Volume
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const volume = row.getValue("volume_24h") as number | null
      return (
        <div className="text-right text-muted-foreground">
          {formatVolume(volume)}
        </div>
      )
    },
  },
  {
    accessorKey: "timestamp",
    header: "Last Updated",
    cell: ({ row }) => {
      const timestamp = row.getValue("timestamp") as string
      const date = new Date(timestamp)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffSecs = Math.floor(diffMs / 1000)
      const diffMins = Math.floor(diffMs / 60000)

      let timeAgo = ''
      if (diffSecs < 60) {
        timeAgo = `${diffSecs}s ago`
      } else if (diffMins < 60) {
        timeAgo = `${diffMins}m ago`
      } else {
        const diffHours = Math.floor(diffMs / 3600000)
        if (diffHours < 24) {
          timeAgo = `${diffHours}h ago`
        } else {
          const diffDays = Math.floor(diffMs / 86400000)
          timeAgo = `${diffDays}d ago`
        }
      }

      return <div className="text-muted-foreground text-sm">{timeAgo}</div>
    },
  },
]
