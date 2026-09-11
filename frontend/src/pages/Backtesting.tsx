import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EquityCurveChart } from "@/components/charts/Charts";
import { PageHeader, SectionCard, StateBlock, StatCard } from "@/components/common/Widgets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, apiPost } from "@/lib/api";
import { formatDate, formatMoney, formatNumber, formatPercent, toneClass } from "@/lib/format";
import type { Asset, BacktestHistoryRow, BacktestRequest, BacktestResponse, StrategyOption } from "@/lib/types";
import { cn } from "@/lib/utils";

const DEFAULT_CONFIG: BacktestRequest = {
  symbol: "RELIANCE",
  lookback_days: 250,
  initial_capital: 100000,
  strategy: "ema_rsi_volume",
  rsi_threshold: 50,
  ema_period: 21,
  require_volume: true,
  stop_loss_percent: 2,
  risk_reward: 2,
  position_size_percent: 100,
};

const EMA_PERIODS = ["21", "50", "200"];

export default function Backtesting() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<BacktestRequest>(DEFAULT_CONFIG);
  const [result, setResult] = useState<BacktestResponse | null>(null);

  const assets = useQuery<Asset[]>({ queryKey: ["asset-directory"], queryFn: () => apiGet<Asset[]>("/asset-directory") });
  const strategies = useQuery<StrategyOption[]>({
    queryKey: ["strategies"],
    queryFn: () => apiGet<StrategyOption[]>("/backtest/strategies"),
  });
  const history = useQuery<BacktestHistoryRow[]>({
    queryKey: ["backtest-history"],
    queryFn: () => apiGet<BacktestHistoryRow[]>("/backtest/history?limit=10"),
  });

  const run = useMutation({
    mutationFn: (body: BacktestRequest) => apiPost<BacktestResponse>("/backtest", body),
    onSuccess: (data) => {
      setResult(data);
      toast.success(`Backtest complete — ${data.total_trades} trades on ${data.symbol}`);
      void queryClient.invalidateQueries({ queryKey: ["backtest-history"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    },
    onError: () => toast.error("Backtest failed. Check the parameters and try again."),
  });

  const set = (patch: Partial<BacktestRequest>) => setConfig((c) => ({ ...c, ...patch }));
  const strategyLabels = Object.fromEntries((strategies.data ?? []).map((s) => [s.value, s.label]));

  return (
    <div className="space-y-6" data-testid="backtesting-page">
      <PageHeader
        testId="backtesting-header"
        title="Strategy Backtesting"
        description="Run simple long-only rule-based strategies over historical demo bars. Results are calculated from past data and never imply future performance."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr]">
        <SectionCard testId="backtest-config-card" title="Strategy configuration" subtitle="Entry and exit rules are derived from these inputs.">
          <div className="space-y-4">
            <div>
              <Label>Asset</Label>
              <Select value={config.symbol} onValueChange={(value: string) => set({ symbol: value })}>
                <SelectTrigger className="mt-2 w-full" data-testid="backtest-symbol-select">
                  <SelectValue>{(v) => String(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(assets.data ?? []).map((a) => (
                    <SelectItem key={a.symbol} value={a.symbol}>
                      {a.symbol} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Strategy</Label>
              <Select
                value={config.strategy}
                onValueChange={(value: string) => set({ strategy: value as BacktestRequest["strategy"] })}
              >
                <SelectTrigger className="mt-2 w-full" data-testid="backtest-strategy-select">
                  <SelectValue>{(v) => strategyLabels[v as string] ?? String(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(strategies.data ?? []).map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="lookback">Timeframe (bars)</Label>
                <Input
                  id="lookback"
                  type="number"
                  className="mt-2"
                  value={config.lookback_days}
                  onChange={(e) => set({ lookback_days: Number(e.target.value) })}
                  data-testid="backtest-lookback-input"
                />
              </div>
              <div>
                <Label htmlFor="capital">Initial capital</Label>
                <Input
                  id="capital"
                  type="number"
                  className="mt-2"
                  value={config.initial_capital}
                  onChange={(e) => set({ initial_capital: Number(e.target.value) })}
                  data-testid="backtest-capital-input"
                />
              </div>
              <div>
                <Label>EMA period</Label>
                <Select
                  value={String(config.ema_period)}
                  onValueChange={(value: string) => set({ ema_period: Number(value) as 21 | 50 | 200 })}
                >
                  <SelectTrigger className="mt-2 w-full" data-testid="backtest-ema-select">
                    <SelectValue>{(v) => `${String(v)} EMA`}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {EMA_PERIODS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p} EMA
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rsi">RSI threshold</Label>
                <Input
                  id="rsi"
                  type="number"
                  className="mt-2"
                  value={config.rsi_threshold}
                  onChange={(e) => set({ rsi_threshold: Number(e.target.value) })}
                  data-testid="backtest-rsi-input"
                />
              </div>
              <div>
                <Label htmlFor="sl">Stop loss %</Label>
                <Input
                  id="sl"
                  type="number"
                  step="0.1"
                  className="mt-2"
                  value={config.stop_loss_percent}
                  onChange={(e) => set({ stop_loss_percent: Number(e.target.value) })}
                  data-testid="backtest-stoploss-input"
                />
              </div>
              <div>
                <Label htmlFor="rr">Risk / reward</Label>
                <Input
                  id="rr"
                  type="number"
                  step="0.1"
                  className="mt-2"
                  value={config.risk_reward}
                  onChange={(e) => set({ risk_reward: Number(e.target.value) })}
                  data-testid="backtest-rr-input"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Checkbox
                id="require-volume"
                checked={config.require_volume}
                onCheckedChange={(checked) => set({ require_volume: Boolean(checked) })}
                data-testid="backtest-volume-toggle"
              />
              <Label htmlFor="require-volume" className="font-normal">
                Require volume above average on entry
              </Label>
            </div>

            <Button
              className="w-full"
              onClick={() => run.mutate(config)}
              disabled={run.isPending}
              data-testid="backtest-run-button"
            >
              <Play className="size-4" />
              {run.isPending ? "Running…" : "Run backtest"}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Exit uses a fixed percentage stop with a 1:{config.risk_reward} target; any open position is closed on the
              final bar.
            </p>
          </div>
        </SectionCard>

        <div className="space-y-6">
          {result ? (
            <>
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <StatCard
                  testId="backtest-return-stat"
                  label="Total return"
                  value={formatPercent(result.total_return_percent)}
                  tone={result.total_return_percent >= 0 ? "positive" : "negative"}
                  hint={`Buy & hold ${formatPercent(result.buy_hold_return_percent)}`}
                />
                <StatCard
                  testId="backtest-winrate-stat"
                  label="Win rate"
                  value={`${result.win_rate.toFixed(1)}%`}
                  hint={`${result.winning_trades}W / ${result.losing_trades}L`}
                />
                <StatCard
                  testId="backtest-pnl-stat"
                  label="Net profit / loss"
                  value={formatMoney(result.net_profit)}
                  tone={result.net_profit >= 0 ? "positive" : "negative"}
                  hint={`Final ${formatMoney(result.final_capital)}`}
                />
                <StatCard
                  testId="backtest-drawdown-stat"
                  label="Max drawdown"
                  value={`${result.max_drawdown_percent.toFixed(2)}%`}
                  tone="negative"
                />
                <StatCard testId="backtest-trades-stat" label="Total trades" value={String(result.total_trades)} />
                <StatCard
                  testId="backtest-profitfactor-stat"
                  label="Profit factor"
                  value={result.profit_factor === null ? "—" : result.profit_factor.toFixed(2)}
                />
                <StatCard testId="backtest-avgtrade-stat" label="Average trade" value={formatMoney(result.average_trade)} />
                <StatCard
                  testId="backtest-avgwin-stat"
                  label="Avg win / avg loss"
                  value={`${formatMoney(result.average_win)} / ${formatMoney(result.average_loss)}`}
                />
              </div>

              <SectionCard
                testId="backtest-rules-card"
                title={`${result.strategy} on ${result.symbol}`}
                subtitle={result.name}
                right={<Badge variant="outline">Historical demo data</Badge>}
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Entry conditions
                    </div>
                    <ul className="mt-2 space-y-1 text-sm" data-testid="backtest-entry-rules">
                      {result.entry_rules.map((r) => (
                        <li key={r} className="rounded-md bg-muted/60 px-3 py-1.5 font-mono text-xs">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Exit conditions
                    </div>
                    <ul className="mt-2 space-y-1 text-sm" data-testid="backtest-exit-rules">
                      {result.exit_rules.map((r) => (
                        <li key={r} className="rounded-md bg-muted/60 px-3 py-1.5 font-mono text-xs">
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="mt-4 rounded-md border border-dashed border-border p-3 text-[11px] leading-relaxed text-muted-foreground">
                  {result.disclaimer}
                </p>
              </SectionCard>

              <SectionCard
                testId="backtest-equity-card"
                title="Equity curve"
                subtitle="Strategy equity versus a passive buy & hold of the same capital."
              >
                <EquityCurveChart points={result.equity_curve} testId="backtest-equity-chart" />
              </SectionCard>

              <SectionCard
                testId="backtest-trades-card"
                title="Trade history"
                subtitle={`${result.trades.length} closed trades`}
              >
                <StateBlock
                  loading={false}
                  error={false}
                  empty={result.trades.length === 0}
                  emptyLabel="This rule set produced no entries over the selected window. Loosen the conditions and run again."
                  testId="backtest-trades"
                >
                  <div className="max-h-96 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>#</TableHead>
                          <TableHead>Entry</TableHead>
                          <TableHead>Exit</TableHead>
                          <TableHead className="text-right">Entry px</TableHead>
                          <TableHead className="text-right">Exit px</TableHead>
                          <TableHead className="text-right">P/L</TableHead>
                          <TableHead className="text-right">Return</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {result.trades.map((t) => (
                          <TableRow key={t.id} data-testid={`backtest-trade-row-${t.id}`}>
                            <TableCell className="font-mono text-xs">{t.id}</TableCell>
                            <TableCell className="text-xs">{formatDate(t.entry_date)}</TableCell>
                            <TableCell className="text-xs">{formatDate(t.exit_date)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatNumber(t.entry_price)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatNumber(t.exit_price)}</TableCell>
                            <TableCell className={cn("text-right font-mono text-xs font-semibold", toneClass(t.pnl))}>
                              {formatMoney(t.pnl)}
                            </TableCell>
                            <TableCell className={cn("text-right font-mono text-xs", toneClass(t.return_percent))}>
                              {formatPercent(t.return_percent)}
                            </TableCell>
                            <TableCell className="text-xs">{t.exit_reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </StateBlock>
              </SectionCard>
            </>
          ) : (
            <SectionCard testId="backtest-empty-card" title="No backtest run yet" subtitle="Configure a strategy on the left and run it.">
              <div className="rounded-md border border-dashed border-border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
                Results appear here: KPI cards, equity curve and the full trade log.
              </div>
            </SectionCard>
          )}

          <SectionCard testId="backtest-history-card" title="Recent backtests" subtitle="Saved to the database on every run.">
            <StateBlock
              loading={history.isLoading}
              error={history.isError}
              empty={(history.data ?? []).length === 0}
              emptyLabel="No backtests stored yet."
              testId="backtest-history"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead className="text-right">Return</TableHead>
                    <TableHead className="text-right">Win rate</TableHead>
                    <TableHead className="text-right">Trades</TableHead>
                    <TableHead className="text-right">Max DD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(history.data ?? []).map((row) => (
                    <TableRow key={row.id} data-testid={`backtest-history-row-${row.id}`}>
                      <TableCell className="font-mono text-xs font-bold uppercase">{row.symbol}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs">{row.strategy}</TableCell>
                      <TableCell className={cn("text-right font-mono text-xs", toneClass(row.total_return_percent))}>
                        {formatPercent(row.total_return_percent)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{row.win_rate.toFixed(1)}%</TableCell>
                      <TableCell className="text-right font-mono text-xs">{row.total_trades}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{row.max_drawdown_percent.toFixed(2)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </StateBlock>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
