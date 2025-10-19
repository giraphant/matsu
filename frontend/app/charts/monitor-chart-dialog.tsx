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
import { MonitorData } from './monitors-columns'

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

interface MonitorChartDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  monitor: MonitorData | null
}

interface HistoricalData {
  timestamp: number // milliseconds
  value: number
}

export function MonitorChartDialog({ open, onOpenChange, monitor }: MonitorChartDialogProps) {
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([])
  const [loading, setLoading] = useState(false)
  const [timeRange, setTimeRange] = useState<number>(24) // Hours of history to fetch

  useEffect(() => {
    if (monitor && open) {
      fetchHistoricalData(monitor.id, timeRange)
    }
  }, [monitor, open, timeRange])

  const fetchHistoricalData = async (monitorId: string, hours: number) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/monitors/${monitorId}/history?hours=${hours}&limit=100`)
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

  if (!monitor) return null

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
        label: monitor.name,
        data: historicalData.map(d => d.value),
        borderColor: monitor.color || 'rgb(59, 130, 246)',
        backgroundColor: `${monitor.color || 'rgb(59, 130, 246)'}20`,
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
        text: `${monitor.name} - Historical Data`,
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
          text: monitor.unit ? `Value (${monitor.unit})` : 'Value',
        },
        ticks: {
          callback: function(value) {
            const numValue = typeof value === 'number' ? value : parseFloat(value as string);
            return numValue.toLocaleString(undefined, {
              minimumFractionDigits: monitor.decimal_places || 2,
              maximumFractionDigits: monitor.decimal_places || 2
            })
          },
        },
      },
    },
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[75vw] max-w-none sm:max-w-none max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{monitor.name}</DialogTitle>
          <DialogDescription>
            Monitor ID: {monitor.id} {monitor.formula && `| Formula: ${monitor.formula}`}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="chart" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chart">Chart</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="chart" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Value History</CardTitle>
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
                  ) : historicalData.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">No historical data available</p>
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
                      {monitor.value !== undefined && monitor.value !== null
                        ? monitor.value.toLocaleString(undefined, {
                            minimumFractionDigits: monitor.decimal_places || 2,
                            maximumFractionDigits: monitor.decimal_places || 2
                          })
                        : 'N/A'}
                      {monitor.unit && ` ${monitor.unit}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Formula</p>
                    <p className="text-sm font-mono bg-muted p-2 rounded">
                      {monitor.formula || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Decimal Places</p>
                    <p className="text-lg">
                      {monitor.decimal_places}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Enabled</p>
                    <p className="text-lg">
                      {monitor.enabled ? 'Yes' : 'No'}
                    </p>
                  </div>
                  {monitor.created_at && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Created At</p>
                      <p className="text-lg">
                        {new Date(monitor.created_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {monitor.updated_at && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Updated At</p>
                      <p className="text-lg">
                        {new Date(monitor.updated_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
                {monitor.tags && monitor.tags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Tags</p>
                    <div className="flex gap-2 flex-wrap">
                      {monitor.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {monitor.description && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                    <p className="text-sm">{monitor.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
