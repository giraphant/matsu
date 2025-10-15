import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ChartsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Charts</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Activity Overview</CardTitle>
            <CardDescription>
              Webhook activity over time
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              No data available
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Webhooks</CardTitle>
            <CardDescription>
              Latest webhook events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              No recent events
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}