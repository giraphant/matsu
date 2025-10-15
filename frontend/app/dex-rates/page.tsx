import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function DexRatesPage() {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold md:text-2xl">DEX Rates</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>ETH/USDT</CardTitle>
            <CardDescription>Ethereum to USDT</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground">
              No data available
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>BTC/USDT</CardTitle>
            <CardDescription>Bitcoin to USDT</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground">
              No data available
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>SOL/USDT</CardTitle>
            <CardDescription>Solana to USDT</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$0.00</div>
            <p className="text-xs text-muted-foreground">
              No data available
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Rate History</CardTitle>
          <CardDescription>
            Historical exchange rates from various DEXs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            Connect to DEX APIs to see rate history
          </div>
        </CardContent>
      </Card>
    </div>
  )
}