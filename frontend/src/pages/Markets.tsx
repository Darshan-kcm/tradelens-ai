import { useQuery } from "@tanstack/react-query";
import { Clock, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PriceTrendChart, RsiChart } from "@/components/charts/Charts";
import { Delta, PageHeader, SectionCard, StateBlock } from "@/components/common/Widgets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { formatCompact, formatNumber, formatPrice, scoreTone } from "@/lib/format";
import type { AssetSnapshot, Market, MarketSessionsResponse, PriceSeries } from "@/lib/types";
import { cn } from "@/lib/utils";

const HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

function SessionTimeline({ data }: { data: MarketSessionsResponse }) {
  return (
    <div className="space-y-4" data-testid="session-timeline">
      <div className="relative ml-24 h-4 border-b border-border">
        {HOURS.map((h) => (
          <span
            key={h}
            className="absolute -translate-x-1/2 font-mono text-[10px] text-muted-foreground"
            style={{ left: `${(h / 24) * 100}%` }}
          >
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>
      {data.sessions.map((s) => {
        const start = (s.open_utc_hour / 24) * 100;
        const rawWidth = ((s.close_utc_hour - s.open_utc_hour + 24) % 24 || 24) / 24 * 100;
        const width = Math.min(rawWidth, 100 - start);
        return (
          <div key={s.market} className="flex items-center gap-3" data-testid={`timeline-row-${s.market}`}>
            <div className="w-24 shrink-0 text-xs font-semibold">{s.market}</div>
            <div className="relative h-7 flex-1 rounded-md bg-muted">
              <div
                className={cn(
                  "absolute inset-y-0 rounded-md transition-colors duration-200",
                  s.is_open ? "bg-[#16a34a]/85" : "bg-primary/35 dark:bg-primary/50",
                )}
                style={{ left: `${start}%`, width: `${width}%` }}
              />
              <div
                className="absolute inset-y-[-4px] w-px bg-[#dc2626]"
                style={{ left: `${(data.reference_utc_hour / 24) * 100}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="ml-24 text-[11px] text-muted-foreground">
        Bars show each session in UTC hours; the red line marks the selected reference time.
      </p>
    </div>
  );
}

export default function Markets() {
  const [params, setParams] = useSearchParams();
  const [market, setMarket] = useState("all");
  const [search, setSearch] = useState("");
  const [refHour, setRefHour] = useState<number | null>(null);

  const selected = params.get("symbol") ?? "NIFTY50";

  const marketsQuery = useQuery<Market[]>({ queryKey: ["markets"], queryFn: () => apiGet<Market[]>("/markets") });

  const assetsQuery = useQuery<AssetSnapshot[]>({
    queryKey: ["assets", market],
    queryFn: () => apiGet<AssetSnapshot[]>(`/assets?market=${market}&limit=200`),
  });

  const priceQuery = useQuery<PriceSeries>({
    queryKey: ["price", selected],
    queryFn: () => apiGet<PriceSeries>(`/price/${selected}?days=180`),
  });

  const detailQuery = useQuery<AssetSnapshot>({
    queryKey: ["asset", selected],
    queryFn: () => apiGet<AssetSnapshot>(`/assets/${selected}`),
  });

  const sessionsQuery = useQuery<MarketSessionsResponse>({
    queryKey: ["market-sessions", refHour],
    queryFn: () =>
      apiGet<MarketSessionsResponse>(
        refHour === null ? "/market-sessions" : `/market-sessions?at_utc_hour=${refHour}`,
      ),
  });

  const rows = useMemo(() => {
    const list = assetsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    return q ? list.filter((a) => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)) : list;
  }, [assetsQuery.data, search]);

  const detail = detailQuery.data;

  return (
    <div className="space-y-6" data-testid="markets-page">
      <PageHeader
        testId="markets-header"
        title="Markets"
        description="Browse the multi-market demo universe — Indian equities, US equities, forex, commodities and crypto — then inspect price, volume and indicators for any asset."
      />

      <div className="flex flex-wrap items-center gap-2" data-testid="market-filter-group">
        <Button
          variant={market === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setMarket("all")}
          data-testid="market-filter-all"
        >
          All markets
        </Button>
        {marketsQuery.data?.map((m) => (
          <Button
            key={m.code}
            variant={market === m.code ? "default" : "outline"}
            size="sm"
            onClick={() => setMarket(m.code)}
            data-testid={`market-filter-${m.code}`}
          >
            {m.code}
            <Badge variant="ghost" className="ml-1 font-mono">
              {m.asset_count}
            </Badge>
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.2fr]">
        <SectionCard
          testId="markets-list-card"
          title="Asset list"
          subtitle={`${rows.length} assets — click a row to load its charts`}
        >
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search symbol or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="markets-search-input"
            />
          </div>
          <StateBlock
            loading={assetsQuery.isLoading}
            error={assetsQuery.isError}
            empty={rows.length === 0}
            testId="markets-list"
          >
            <div className="max-h-[520px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((a) => (
                    <TableRow
                      key={a.symbol}
                      onClick={() => setParams({ symbol: a.symbol })}
                      className={cn(
                        "cursor-pointer transition-colors duration-150",
                        a.symbol === selected && "bg-accent/60",
                      )}
                      data-testid={`market-asset-row-${a.symbol}`}
                    >
                      <TableCell>
                        <div className="font-mono text-xs font-bold uppercase tracking-wider">{a.symbol}</div>
                        <div className="max-w-[170px] truncate text-xs text-muted-foreground">{a.name}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatPrice(a.price, a.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Delta value={a.change_percent} className="text-xs" />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {formatCompact(a.volume)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </StateBlock>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            testId="markets-detail-card"
            title={detail ? `${detail.symbol} · ${detail.name}` : selected}
            subtitle={detail ? `${detail.market} · ${detail.asset_type} · ${detail.sector}` : undefined}
            right={detail ? <Badge variant="secondary">{detail.market_status}</Badge> : undefined}
          >
            <StateBlock loading={detailQuery.isLoading} error={detailQuery.isError} testId="markets-detail">
              {detail && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="font-mono text-3xl font-semibold tracking-tight" data-testid="detail-price">
                      {formatPrice(detail.price, detail.currency)}
                    </div>
                    <Delta value={detail.change_percent} />
                  </div>
                  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {[
                      { label: "RSI (14)", value: formatNumber(detail.rsi), id: "rsi" },
                      { label: "EMA 21", value: formatNumber(detail.ema21), id: "ema21" },
                      { label: "EMA 50", value: formatNumber(detail.ema50), id: "ema50" },
                      { label: "EMA 200", value: formatNumber(detail.ema200), id: "ema200" },
                      { label: "Volume", value: formatCompact(detail.volume), id: "volume" },
                      { label: "Avg volume", value: formatCompact(detail.avg_volume), id: "avg-volume" },
                    ].map((item) => (
                      <div key={item.id} className="rounded-md border border-border p-3">
                        <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          {item.label}
                        </dt>
                        <dd className="mt-1 font-mono text-sm font-semibold" data-testid={`detail-${item.id}`}>
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" data-testid="detail-ema-status">
                      {detail.ema_status}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      News: {detail.sentiment}
                    </Badge>
                    <Badge variant="secondary" className={cn("font-mono", scoreTone(detail.research_score))}>
                      Research score {detail.research_score.toFixed(1)}
                    </Badge>
                  </div>
                </div>
              )}
            </StateBlock>
          </SectionCard>

          <SectionCard testId="markets-chart-card" title="Price & indicators" subtitle="Daily demo candles, last 180 bars">
            <StateBlock loading={priceQuery.isLoading} error={priceQuery.isError} testId="markets-price">
              {priceQuery.data && (
                <div className="space-y-3">
                  <PriceTrendChart candles={priceQuery.data.candles} testId="markets-price-chart" />
                  <RsiChart candles={priceQuery.data.candles} testId="markets-rsi-chart" />
                </div>
              )}
            </StateBlock>
          </SectionCard>
        </div>
      </div>

      <SectionCard
        testId="markets-sessions-card"
        title="Market sessions"
        subtitle="Local time, opening hours and live status for the four major trading centres."
        right={<Clock className="size-4 text-muted-foreground" />}
      >
        <StateBlock loading={sessionsQuery.isLoading} error={sessionsQuery.isError} testId="markets-sessions">
          {sessionsQuery.data && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {sessionsQuery.data.sessions.map((s) => (
                  <div
                    key={s.market}
                    className="rounded-lg border border-border p-4 transition-colors duration-200 hover:border-slate-300 dark:hover:border-slate-700"
                    data-testid={`session-card-${s.market}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{s.market}</span>
                      <Badge variant={s.is_open ? "secondary" : "outline"} data-testid={`session-status-${s.market}`}>
                        {s.status}
                      </Badge>
                    </div>
                    <div className="mt-3 font-mono text-2xl font-semibold tracking-tight">{s.local_time}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{s.local_date} · {s.exchange}</div>
                    <div className="mt-3 border-t border-border pt-2 font-mono text-[11px] text-muted-foreground">
                      {s.open_time} – {s.close_time} local
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label htmlFor="ref-hour" className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Inspect another time (UTC)
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold" data-testid="session-reference-hour">
                      {String(Math.floor(refHour ?? sessionsQuery.data.reference_utc_hour)).padStart(2, "0")}:00 UTC
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setRefHour(null)} data-testid="session-reset-button">
                      Now
                    </Button>
                  </div>
                </div>
                <input
                  id="ref-hour"
                  type="range"
                  min={0}
                  max={23}
                  step={1}
                  value={Math.floor(refHour ?? sessionsQuery.data.reference_utc_hour)}
                  onChange={(e) => setRefHour(Number(e.target.value))}
                  className="mt-3 w-full accent-[#2563eb]"
                  data-testid="session-hour-slider"
                />
              </div>

              <SessionTimeline data={sessionsQuery.data} />
            </div>
          )}
        </StateBlock>
      </SectionCard>
    </div>
  );
}
