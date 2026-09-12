import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PriceVolumeChart } from "@/components/charts/Charts";
import { Delta, PageHeader, SectionCard, StateBlock, StatCard } from "@/components/common/Widgets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { formatCompact, formatNumber, toneClass } from "@/lib/format";
import type { AssetSnapshot, VolumeSeries } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All assets" },
  { key: "above_average", label: "Volume above average" },
  { key: "spike", label: "Volume spike" },
  { key: "high", label: "High volume" },
  { key: "low", label: "Low volume" },
];

export default function VolumeAnalysis() {
  const [filter, setFilter] = useState("above_average");
  const [symbol, setSymbol] = useState("RELIANCE");

  const scan = useQuery<AssetSnapshot[]>({
    queryKey: ["volume-scan", filter],
    queryFn: () => apiGet<AssetSnapshot[]>(`/volume-scan?filter=${filter}`),
  });

  const series = useQuery<VolumeSeries>({
    queryKey: ["volume", symbol],
    queryFn: () => apiGet<VolumeSeries>(`/volume/${symbol}?days=90`),
  });

  const rows = scan.data ?? [];
  const v = series.data;

  return (
    <div className="space-y-6" data-testid="volume-page">
      <PageHeader
        testId="volume-header"
        title="Volume Analysis"
        description="Compare the latest session volume against its 20-day average to find participation spikes and dry-ups across every market."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          testId="volume-latest-stat"
          label={`${v?.symbol ?? symbol} latest volume`}
          value={formatCompact(v?.latest_volume ?? null)}
        />
        <StatCard
          testId="volume-average-stat"
          label="20-day average volume"
          value={formatCompact(v?.average_volume ?? null)}
        />
        <StatCard
          testId="volume-change-stat"
          label="Volume vs average"
          value={v ? `${v.volume_change_percent > 0 ? "+" : ""}${v.volume_change_percent.toFixed(2)}%` : "—"}
          tone={v && v.volume_change_percent >= 0 ? "positive" : "negative"}
        />
        <StatCard
          testId="volume-spikes-stat"
          label="Spikes in last 90 bars"
          value={v ? String(v.spike_count) : "—"}
          hint="Bar volume ≥ 1.6× its 20-day average"
        />
      </div>

      <SectionCard
        testId="volume-chart-card"
        title={`Price vs volume — ${v?.name ?? symbol}`}
        subtitle="Bars are session volume, the orange line is the 20-day average, the green line is closing price."
      >
        <StateBlock loading={series.isLoading} error={series.isError} testId="volume-chart">
          {v && <PriceVolumeChart bars={v.bars} testId="volume-price-volume-chart" />}
        </StateBlock>
      </SectionCard>

      <SectionCard
        testId="volume-scan-card"
        title="Volume scan"
        subtitle={`${rows.length} assets in this bucket — click a row to chart it`}
        right={
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                variant={filter === f.key ? "default" : "outline"}
                size="xs"
                onClick={() => setFilter(f.key)}
                data-testid={`volume-filter-${f.key}`}
              >
                {f.label}
              </Button>
            ))}
          </div>
        }
      >
        <StateBlock
          loading={scan.isLoading}
          error={scan.isError}
          empty={rows.length === 0}
          emptyLabel="No assets currently fall into this volume bucket."
          testId="volume-scan"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead className="text-right">Change %</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Avg volume</TableHead>
                  <TableHead className="text-right">Vol vs avg</TableHead>
                  <TableHead>Signal</TableHead>
                  <TableHead className="text-right">Volume score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow
                    key={a.symbol}
                    onClick={() => setSymbol(a.symbol)}
                    className={cn("cursor-pointer", a.symbol === symbol && "bg-accent/60")}
                    data-testid={`volume-row-${a.symbol}`}
                  >
                    <TableCell>
                      <div className="font-mono text-xs font-bold uppercase tracking-wider">{a.symbol}</div>
                      <div className="max-w-[170px] truncate text-xs text-muted-foreground">{a.name}</div>
                    </TableCell>
                    <TableCell className="text-xs">{a.market}</TableCell>
                    <TableCell className="text-right">
                      <Delta value={a.change_percent} className="text-xs" />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCompact(a.volume)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatCompact(a.avg_volume)}</TableCell>
                    <TableCell className={cn("text-right font-mono text-xs font-semibold", toneClass(a.volume_change_percent))}>
                      {a.volume_change_percent > 0 ? "+" : ""}
                      {a.volume_change_percent.toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      {a.volume_spike ? (
                        <Badge variant="secondary">Spike</Badge>
                      ) : a.volume > a.avg_volume ? (
                        <Badge variant="outline">Above average</Badge>
                      ) : (
                        <Badge variant="ghost">Below average</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatNumber(a.volume_score, 1)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </StateBlock>
      </SectionCard>
    </div>
  );
}
