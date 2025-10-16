"use client"

import { ColumnDef } from "@tanstack/react-table"
import { ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export interface FundingRateData {
  exchange: string
  symbol: string
  rate: number
  annualized_rate: number
  next_funding_time: string | null
  mark_price: number | null
  timestamp: string
}

// Helper function to format percentage
const formatPercent = (value: number) => {
  const formatted = (value * 100).toFixed(4)
  return `${formatted}%`
}

// Helper function to format annualized rate
const formatAnnualizedRate = (value: number) => {
  const formatted = (value * 100).toFixed(2)
  return `${formatted}%`
}

// Helper function to get time until next funding
const getTimeUntil = (timestamp: string | null) => {
  if (!timestamp) return 'N/A'

  const now = new Date()
  const next = new Date(timestamp)
  const diffMs = next.getTime() - now.getTime()

  if (diffMs < 0) return 'Past'

  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 60) {
    return `${diffMins}m`
  } else {
    const mins = diffMins % 60
    return `${diffHours}h ${mins}m`
  }
}

export const columns: ColumnDef<FundingRateData>[] = [
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
      return <div className="font-semibold">{row.getValue("symbol")}</div>
    },
  },
  {
    accessorKey: "rate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Funding Rate
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const rate = row.getValue("rate") as number
      return (
        <div className={`font-medium text-right ${
          rate > 0 ? 'text-green-600' : rate < 0 ? 'text-red-600' : 'text-gray-600'
        }`}>
          {formatPercent(rate)}
        </div>
      )
    },
  },
  {
    accessorKey: "annualized_rate",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Annual Rate
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => {
      const rate = row.getValue("annualized_rate") as number
      return (
        <div className={`font-medium text-right ${
          rate > 0 ? 'text-green-600' : rate < 0 ? 'text-red-600' : 'text-gray-600'
        }`}>
          {formatAnnualizedRate(rate)}
        </div>
      )
    },
  },
  {
    accessorKey: "mark_price",
    header: "Mark Price",
    cell: ({ row }) => {
      const price = row.getValue("mark_price") as number | null
      return (
        <div className="text-right font-mono">
          {price ? `$${price.toLocaleString()}` : 'N/A'}
        </div>
      )
    },
  },
  {
    accessorKey: "next_funding_time",
    header: "Next Funding",
    cell: ({ row }) => {
      const nextTime = row.getValue("next_funding_time") as string | null
      return (
        <div className="text-muted-foreground">
          {getTimeUntil(nextTime)}
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
        timeAgo = `${diffHours}h ago`
      }

      return <div className="text-muted-foreground text-sm">{timeAgo}</div>
    },
  },
]
