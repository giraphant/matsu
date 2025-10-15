import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function SettingsPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">Settings</h1>
      </div>
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
            <CardDescription>
              Configure webhook endpoints and authentication
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="webhook-url" className="text-sm font-medium">
                Webhook URL
              </label>
              <Input
                id="webhook-url"
                placeholder="https://your-webhook-endpoint.com"
                type="url"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="webhook-secret" className="text-sm font-medium">
                Webhook Secret
              </label>
              <Input
                id="webhook-secret"
                placeholder="Enter webhook secret"
                type="password"
              />
            </div>
            <Button>Save Configuration</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
            <CardDescription>
              Configure alerts and notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Email Notifications</div>
                <div className="text-sm text-muted-foreground">
                  Receive alerts via email
                </div>
              </div>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Slack Integration</div>
                <div className="text-sm text-muted-foreground">
                  Send alerts to Slack channels
                </div>
              </div>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}