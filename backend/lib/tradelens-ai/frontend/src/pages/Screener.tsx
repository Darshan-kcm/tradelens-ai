import { useQuery } from "@tanstack/react-query";
import { Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { Delta, PageHeader, SectionCard, SentimentPill, StateBlock } from "@/components/common/Widgets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiPost } from "@/lib/api";
import { formatCompact, formatNumber, formatPrice, scoreTone } from "@/lib/format";
import type { FilterOperator, ScreenerFilter, ScreenerRequest, ScreenerResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const MARKETS = ["NSE", "BSE", "NASDAQ", "NYSE", "FOREX", "COMMODITY", "CRYPTO"];
const ASSET_TYPES = ["index", "stock", "forex", "commodity", "crypto"];
const SENTIMENTS = ["positive", "neutral", "negative"];

const FIELD_LABELS: Record<string, string> = {
  price: "Price",
  change_percent: "Change %",
  volume: "Volume",
  volume_change_percent: "Volume vs avg %",
  rsi: "RSI (14)",
  market_cap: "Market cap",
  pe_ratio: "P/E",
  pb_ratio: "P/B",
  roe: "ROE %",
  revenue_growth: "Revenue growth %",
  research_score: "Research score",
  technical_score: "Technical score",
  fundamental_score: "Fundamental score",
  volume_score: "Volume score",
  news_score: "News score",
};

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  gt: "greater than",
  gte: "at least",
  lt: "less than",
  lte: "at most",
  eq: "equals",
};

const DEFAULT_FILTERS: ScreenerFilter[] = [{ field: "rsi", operator: "gt", value: 50 }];

const EMPTY: ScreenerRequest = {
  markets: [],
  asset_types: [],
  sentiments: [],
  search: "",
  price_above_ema21: true,
  price_above_ema50: false,
  price_above_ema200: false,
  volume_above_average: true,
  filters: DEFAULT_FILTERS,
  sort_by: "research_score",
  sort_desc: true,
  limit: 100,
};

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function Screener() {
  const [req, setReq] = useState<ScreenerRequest>(EMPTY);
  const [applied, setApplied] = useState<ScreenerRequest>(EMPTY);

  const { data, isLoading, isError } = useQuery<ScreenerResponse>({
    queryKey: ["screener", applied],
    queryFn: () => apiPost<ScreenerResponse>("/screener", applied),
  });

  const update = (patch: Partial<ScreenerRequest>) => setReq((r) => ({ ...r, ...patch }));

  const setFilter = (index: number, patch: Partial<ScreenerFilter>) =>
    setReq((r) => ({
      ...r,
      filters: r.filters.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));

  return (
    <div className="space-y-6" data-testid="screener-page">
      <PageHeader
        testId="screener-header"
        title="Asset Screener"
        description="Combine technical, fundamental, volume and sentiment conditions. The backend evaluates every rule against the seeded historical dataset."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setReq(EMPTY);
                setApplied(EMPTY);
              }}
              data-testid="screener-reset-button"
            >
              <RotateCcw className="size-4" /> Reset filters
            </Button>
            <Button onClick={() => setApplied({ ...req })} data-testid="screener-apply-button">
              <Search className="size-4" /> Run screen
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
        <SectionCard testId="screener-filters-card" title="Filters" subtitle="All conditions are combined with AND.">
          <div className="space-y-5">
            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Search
              </Label>
              <Input
                className="mt-2"
                placeholder="Symbol or name"
                value={req.search ?? ""}
                onChange={(e) => update({ search: e.target.value })}
                data-testid="screener-search-input"
              />
            </div>

            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Market
              </Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {MARKETS.map((m) => (
                  <Button
                    key={m}
                    variant={req.markets.includes(m) ? "default" : "outline"}
                    size="xs"
                    onClick={() => update({ markets: toggle(req.markets, m) })}
                    data-testid={`screener-market-${m}`}
                  >
                    {m}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Asset type
              </Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ASSET_TYPES.map((t) => (
                  <Button
                    key={t}
                    variant={req.asset_types.includes(t) ? "default" : "outline"}
                    size="xs"
                    className="capitalize"
                    onClick={() => update({ asset_types: toggle(req.asset_types, t) })}
                    data-testid={`screener-type-${t}`}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                News sentiment
              </Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {SENTIMENTS.map((s) => (
                  <Button
                    key={s}
                    variant={req.sentiments.includes(s) ? "default" : "outline"}
                    size="xs"
                    className="capitalize"
                    onClick={() => update({ sentiments: toggle(req.sentiments, s) })}
                    data-testid={`screener-sentiment-${s}`}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 rounded-md border border-border p-3">
              {[
                { key: "price_above_ema21" as const, label: "Price > 21 EMA" },
                { key: "price_above_ema50" as const, label: "Price > 50 EMA" },
                { key: "price_above_ema200" as const, label: "Price > 200 EMA" },
                { key: "volume_above_average" as const, label: "Volume > average volume" },
              ].map((row) => (
                <div key={row.key} className="flex items-center gap-2.5">
                  <Checkbox
                    id={row.key}
                    checked={req[row.key]}
                    onCheckedChange={(checked) => update({ [row.key]: Boolean(checked) } as Partial<ScreenerRequest>)}
                    data-testid={`screener-toggle-${row.key}`}
                  />
                  <Label htmlFor={row.key} className="text-sm font-normal">
                    {row.label}
                  </Label>
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Numeric conditions
                </Label>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    setReq((r) => ({ ...r, filters: [...r.filters, { field: "research_score", operator: "gte", value: 55 }] }))
                  }
                  data-testid="screener-add-filter-button"
                >
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>
              <div className="mt-2 space-y-2">
                {req.filters.map((f, index) => (
                  <div key={index} className="flex items-center gap-1.5" data-testid={`screener-filter-row-${index}`}>
                    <Select value={f.field} onValueChange={(value: string) => setFilter(index, { field: value })}>
                      <SelectTrigger size="sm" className="flex-1" data-testid={`screener-filter-field-${index}`}>
                        <SelectValue>{(v) => FIELD_LABELS[v as string] ?? "Field"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(FIELD_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={f.operator}
                      onValueChange={(value: string) => setFilter(index, { operator: value as FilterOperator })}
                    >
                      <SelectTrigger size="sm" className="w-[86px]" data-testid={`screener-filter-op-${index}`}>
                        <SelectValue>{(v) => (v === "gt" ? ">" : v === "gte" ? "≥" : v === "lt" ? "<" : v === "lte" ? "≤" : "=")}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(OPERATOR_LABELS) as FilterOperator[]).map((op) => (
                          <SelectItem key={op} value={op}>
                            {OPERATOR_LABELS[op]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      className="w-[84px]"
                      value={f.value}
                      onChange={(e) => setFilter(index, { value: Number(e.target.value) })}
                      data-testid={`screener-filter-value-${index}`}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setReq((r) => ({ ...r, filters: r.filters.filter((_, i) => i !== index) }))}
                      aria-label="Remove condition"
                      data-testid={`screener-filter-remove-${index}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Sort by
              </Label>
              <div className="mt-2 flex gap-1.5">
                <Select value={req.sort_by} onValueChange={(value: string) => update({ sort_by: value })}>
                  <SelectTrigger className="flex-1" data-testid="screener-sort-field">
                    <SelectValue>{(v) => FIELD_LABELS[v as string] ?? "Research score"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(FIELD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={() => update({ sort_desc: !req.sort_desc })}
                  data-testid="screener-sort-direction"
                >
                  {req.sort_desc ? "High → low" : "Low → high"}
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          testId="screener-results-card"
          title="Matching assets"
          subtitle={data ? `${data.count} of ${data.scanned} assets matched` : "Run a screen to see matches"}
          right={
            <Badge variant="outline" className="font-mono" data-testid="screener-result-count">
              {data?.count ?? 0}
            </Badge>
          }
        >
          <StateBlock
            loading={isLoading}
            error={isError}
            empty={data?.count === 0}
            emptyLabel="No assets satisfied every condition. Loosen a filter and run the screen again."
            testId="screener-results"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Change %</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">RSI</TableHead>
                    <TableHead>EMA status</TableHead>
                    <TableHead className="text-right">P/E</TableHead>
                    <TableHead className="text-right">ROE</TableHead>
                    <TableHead>Sentiment</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.results.map((a) => (
                    <TableRow key={a.symbol} data-testid={`screener-row-${a.symbol}`}>
                      <TableCell>
                        <div className="font-mono text-xs font-bold uppercase tracking-wider">{a.symbol}</div>
                        <div className="max-w-[160px] truncate text-xs text-muted-foreground">{a.name}</div>
                      </TableCell>
                      <TableCell className="text-xs">{a.market}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{formatPrice(a.price, a.currency)}</TableCell>
                      <TableCell className="text-right">
                        <Delta value={a.change_percent} className="text-xs" />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatCompact(a.volume)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatNumber(a.rsi, 1)}</TableCell>
                      <TableCell className="text-xs">{a.ema_status}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatNumber(a.pe_ratio, 1)}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{formatNumber(a.roe, 1)}</TableCell>
                      <TableCell>
                        <SentimentPill sentiment={a.sentiment} />
                      </TableCell>
                      <TableCell className={cn("text-right font-mono text-sm font-bold", scoreTone(a.research_score))}>
                        {a.research_score.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </StateBlock>
        </SectionCard>
      </div>
    </div>
  );
}
