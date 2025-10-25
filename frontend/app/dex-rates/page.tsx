'use client';

import { useEffect, useState } from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { getApiUrl } from "@/lib/api-config";

interface FundingRateData {
  exchange: string;
  symbol: string;
  rate: number;
  annualized_rate: number;
  next_funding_time: string | null;
  mark_price: number | null;
  timestamp: string;
}

interface SpotPriceData {
  exchange: string;
  symbol: string;
  price: number;
  volume_24h: number | null;
  timestamp: string;
}

interface SymbolRow {
  symbol: string;
  lighter: number | null;
  aster: number | null;
  grvt: number | null;
  backpack: number | null;
  binance: number | null;
  bybit: number | null;
  hyperliquid: number | null;
  spread: number | null;
  hasBinanceSpot: boolean;
}

const exchanges = ['lighter', 'aster', 'grvt', 'backpack', 'binance', 'bybit', 'hyperliquid'];

export default function DexRatesPage() {
  const [fundingRates, setFundingRates] = useState<FundingRateData[]>([]);
  const [spotPrices, setSpotPrices] = useState<SpotPriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([{ id: 'spread', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [enabledExchanges, setEnabledExchanges] = useState<Set<string>>(
    new Set(exchanges)
  );

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchData() {
    try {
      if (!loading) setRefreshing(true);

      const [fundingRes, spotRes] = await Promise.all([
        fetch(getApiUrl('/api/trading/funding-rates')),
        fetch(getApiUrl('/api/trading/spot-prices'))
      ]);

      if (fundingRes.ok) {
        const fundingData = await fundingRes.json();
        setFundingRates(fundingData);
      }

      if (spotRes.ok) {
        const spotData = await spotRes.json();
        setSpotPrices(spotData);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch trading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Process data into table rows
  const tableData = (() => {
    const grouped = fundingRates.reduce((acc, rate) => {
      if (!acc[rate.symbol]) {
        acc[rate.symbol] = {};
      }
      acc[rate.symbol][rate.exchange] = rate.annualized_rate;
      return acc;
    }, {} as Record<string, Record<string, number>>);

    const binanceSpotSet = new Set(
      spotPrices.filter(s => s.exchange === 'binance').map(s => s.symbol)
    );

    return Object.keys(grouped)
      .map((symbol): SymbolRow | null => {
        const rates = grouped[symbol];

        // Check if at least 2 exchanges have data
        const validRates = Object.values(rates).filter(r => r !== null && r !== undefined && !isNaN(r));
        if (validRates.length < 2) return null;

        // Calculate spread from enabled exchanges only
        const enabledRates = exchanges
          .filter(ex => enabledExchanges.has(ex))
          .map(ex => rates[ex])
          .filter(r => r !== null && r !== undefined && !isNaN(r));

        const spread = enabledRates.length >= 2
          ? Math.max(...enabledRates) - Math.min(...enabledRates)
          : null;

        return {
          symbol,
          lighter: rates.lighter ?? null,
          aster: rates.aster ?? null,
          grvt: rates.grvt ?? null,
          backpack: rates.backpack ?? null,
          binance: rates.binance ?? null,
          bybit: rates.bybit ?? null,
          hyperliquid: rates.hyperliquid ?? null,
          spread,
          hasBinanceSpot: binanceSpotSet.has(symbol),
        };
      })
      .filter((row): row is SymbolRow => row !== null);
  })();

  const formatRate = (rate: number | null): string => {
    if (rate === null || rate === undefined || isNaN(rate)) return 'N/A';
    const sign = rate >= 0 ? '+' : '';
    return `${sign}${rate.toFixed(4)}%`;
  };

  const getRateColor = (rate: number | null): string => {
    if (rate === null || rate === undefined || isNaN(rate)) return 'text-muted-foreground';
    return rate >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  // Define columns
  const columns: ColumnDef<SymbolRow>[] = [
    {
      accessorKey: 'symbol',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4"
        >
          Symbol
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-bold">{row.getValue('symbol')}</span>
          {row.original.hasBinanceSpot && (
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] font-bold"
              title="Has Binance spot trading"
            >
              ✓
            </span>
          )}
        </div>
      ),
    },
    ...exchanges
      .filter(ex => enabledExchanges.has(ex))
      .map(exchange => ({
        accessorKey: exchange,
        header: ({ column }: any) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="-ml-4 capitalize"
          >
            {exchange === 'backpack' ? 'BP' : exchange}
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }: any) => {
          const rate = row.getValue(exchange) as number | null;
          return (
            <div className={`text-right font-mono ${getRateColor(rate)}`}>
              {formatRate(rate)}
            </div>
          );
        },
      } as ColumnDef<SymbolRow>)),
    {
      accessorKey: 'spread',
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="-ml-4"
        >
          Spread
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const spread = row.getValue('spread') as number | null;
        return (
          <div className="text-right font-mono font-bold text-orange-600 dark:text-orange-400">
            {spread !== null ? `${spread.toFixed(4)}%` : 'N/A'}
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: tableData,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 20,
      },
    },
  });

  const toggleExchange = (exchange: string) => {
    const newEnabled = new Set(enabledExchanges);
    if (newEnabled.has(exchange)) {
      newEnabled.delete(exchange);
    } else {
      newEnabled.add(exchange);
    }
    setEnabledExchanges(newEnabled);
  };

  return (
    <div className="container mx-auto py-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DEX Funding Rates</h1>
          <p className="text-muted-foreground">
            Compare funding rates across {exchanges.length} exchanges
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            onClick={() => fetchData()}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Search */}
          <div>
            <Input
              type="text"
              placeholder="Search symbol..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* Exchange filters */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Exchanges:</span>
            {exchanges.map(exchange => (
              <label key={exchange} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledExchanges.has(exchange)}
                  onChange={() => toggleExchange(exchange)}
                  className="w-4 h-4"
                />
                <span className="text-sm capitalize">{exchange}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={header.id !== 'symbol' ? 'text-right' : ''}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading && table.getRowModel().rows?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No symbols found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
        <div className="text-sm text-muted-foreground">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            table.getFilteredRowModel().rows.length
          )}{' '}
          of {table.getFilteredRowModel().rows.length} symbols •
          <span className="ml-1">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white text-[10px] font-bold mx-1">✓</span>
            = Has Binance spot trading
          </span>
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
              }}
              className="h-8 w-[70px] rounded-md border border-input bg-background px-2 py-1 text-sm"
            >
              {[10, 20, 30, 50, 100].map((pageSize) => (
                <option key={pageSize} value={pageSize}>
                  {pageSize}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
