"use client"

import React, { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WebhookData } from './columns'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface ChartDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  webhook: WebhookData | null
}

interface HistoricalData {
  timestamp: string
  value: number
  unit?: string
  status?: string
  is_change?: boolean
}

export function ChartDialog({ open, onOpenChange, webhook }: ChartDialogProps) {
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([])
  const [loading, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState<number>(24) // Hours of history to fetch

  useEffect(() => {
    if (webhook && open) {
      fetchHistoricalData(webhook.uid, timeRange)
    }
  }, [webhook, open, timeRange])

  const fetchHistoricalData = async (uid: string, hours: number) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/webhooks/${uid}/history?hours=${hours}`)
      if (response.ok) {
        const data = await response.json()
        setHistoricalData(data)
      } else {
        console.error('Failed to fetch historical data:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Failed to fetch historical data:', error)
    }
    setLoading(false)
  }

  if (!webhook) return null

  const chartData = {
    labels: historicalData.map(d =>
      new Date(d.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    ),
    datasets: [
      {
        label: webhook.title,
        data: historicalData.map(d => d.value),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
      },
    ],
  }

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `${webhook.title} - Historical Data`,
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time',
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Value (USD)',
        },
        ticks: {
          callback: function(value) {
            return '$' + value.toLocaleString()
          },
        },
      },
    },
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[75vw] max-w-none sm:max-w-none max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{webhook.title}</DialogTitle>
          <DialogDescription>
            Monitor ID: {webhook.uid} | Last updated: {webhook.time_since}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="chart" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chart">Chart</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="raw">Raw Data</TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Price History</CardTitle>
                    <CardDescription>
                      {timeRange < 24
                        ? `Last ${timeRange} hour${timeRange > 1 ? 's' : ''}`
                        : `Last ${timeRange / 24} day${timeRange / 24 > 1 ? 's' : ''}`}
                      {' '}({historicalData.length} data points)
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={timeRange === 1 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTimeRange(1)}
                    >
                      1H
                    </Button>
                    <Button
                      variant={timeRange === 6 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTimeRange(6)}
                    >
                      6H
                    </Button>
                    <Button
                      variant={timeRange === 24 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTimeRange(24)}
                    >
                      24H
                    </Button>
                    <Button
                      variant={timeRange === 72 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTimeRange(72)}
                    >
                      3D
                    </Button>
                    <Button
                      variant={timeRange === 168 ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTimeRange(168)}
                    >
                      7D
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[500px]">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">Loading chart data...</p>
                    </div>
                  ) : (
                    <Line data={chartData} options={chartOptions} />
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Monitor Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current Value</p>
                    <p className="text-2xl font-bold">
                      ${webhook.current_value?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Previous Value</p>
                    <p className="text-2xl font-bold">
                      ${webhook.previous_value?.toLocaleString() || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Change</p>
                    <p className={`text-2xl font-bold ${
                      webhook.change_percent && webhook.change_percent > 0 ? 'text-green-600' :
                      webhook.change_percent && webhook.change_percent < 0 ? 'text-red-600' :
                      'text-gray-600'
                    }`}>
                      {webhook.change_percent ? `${webhook.change_percent.toFixed(2)}%` : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created At</p>
                    <p className="text-lg">
                      {new Date(webhook.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Tags</p>
                  <div className="flex gap-2 flex-wrap">
                    {webhook.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                  <p className="text-sm">{webhook.text}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Raw Data</CardTitle>
                <CardDescription>
                  Complete webhook data in JSON format
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-[400px] text-xs">
                  {JSON.stringify(webhook.data, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}