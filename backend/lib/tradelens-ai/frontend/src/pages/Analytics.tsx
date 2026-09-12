import { useQuery } from "@tanstack/react-query";
import { GenericBarChart, GenericLineChart } from "@/components/charts/Charts";
import { PageHeader, SectionCard, StateBlock, StatCard } from "@/components/common/Widgets";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { formatPercent, scoreTone, toneClass } from "@/lib/format";
import type { AnalyticsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Analytics() {
  const { data, isLoading, isError } = useQuery<AnalyticsResponse>({
    queryKey: ["analytics"],
    queryFn: () => apiGet<AnalyticsResponse>("/analytics"),
  });

  const breadth = data
    ? data.market_comparison.reduce((acc, m) => acc + m.gainers, 0) /
      Math.max(1, data.market_comparison.reduce((acc, m) => acc + m.count, 0)) *
      100
    : 0;
  const avgScore = data
    ? data.market_comparison.reduce((acc, m) => acc + m.avg_research_score, 0) / Math.max(1, data.market_comparison.length)
    : 0;
  const bestBacktest = data?.recent_backtests[0];

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <PageHeader
        testId="analytics-header"
        title="Analytics"
        description="Cross-sectional views over the demo dataset: market breadth, sector performance, volume behaviour, sentiment trend and stored backtest performance."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard testId="analytics-breadth-stat" label="Advancing assets" value={`${breadth.toFixed(0)}%`} hint="Share of the universe closing higher" />
        <StatCard testId="analytics-score-stat" label="Average research score" value={avgScore.toFixed(1)} hint="Mean across all markets" />
        <StatCard
          testId="analytics-markets-stat"
          label="Markets covered"
          value={String(data?.market_comparison.length ?? 0)}
        />
        <StatCard
          testId="analytics-backtest-stat"
          label="Latest backtest return"
          value={bestBacktest ? formatPercent(bestBacktest.total_return_percent) : "—"}
          tone={bestBacktest && bestBacktest.total_return_percent >= 0 ? "positive" : "negative"}
          hint={bestBacktest ? bestBacktest.symbol : "Run a backtest to populate"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard testId="analytics-market-card" title="Market comparison" subtitle="Average daily change and breadth per market.">
          <StateBlock loading={isLoading} error={isError} testId="analytics-market">
            {data && (
              <GenericBarChart
                data={data.market_comparison}
                xKey="market"
                testId="analytics-market-chart"
                series={[
                  { key: "gainers", name: "Advancing", color: "var(--chart-5)" },
                  { key: "losers", name: "Declining", color: "var(--destructive)" },
                ]}
              />
            )}
          </StateBlock>
        </SectionCard>

        <SectionCard testId="analytics-sector-card" title="Sector performance" subtitle="Average change % by sector.">
          <StateBlock loading={isLoading} error={isError} testId="analytics-sector">
            {data && (
              <GenericBarChart
                data={data.sector_performance}
                xKey="sector"
                testId="analytics-sector-chart"
                series={[{ key: "avg_change_percent", name: "Avg change %", color: "var(--chart-1)" }]}
              />
            )}
          </StateBlock>
        </SectionCard>

        <SectionCard testId="analytics-volume-card" title="Volume trend" subtitle="NIFTY 50 session volume against its 20-day average.">
          <StateBlock loading={isLoading} error={isError} testId="analytics-volume">
            {data && (
              <GenericLineChart
                data={data.volume_trend}
                xKey="date"
                testId="analytics-volume-chart"
                series={[
                  { key: "volume", name: "Volume", color: "var(--chart-1)" },
                  { key: "avg_volume", name: "20D average", color: "var(--chart-3)" },
                ]}
              />
            )}
          </StateBlock>
        </SectionCard>

        <SectionCard testId="analytics-sentiment-card" title="Sentiment trend" subtitle="Daily counts of positive, neutral and negative demo news.">
          <StateBlock loading={isLoading} error={isError} testId="analytics-sentiment">
            {data && (
              <GenericBarChart
                data={data.sentiment_trend}
                xKey="date"
                testId="analytics-sentiment-chart"
                series={[
                  { key: "positive", name: "Positive", color: "var(--chart-5)" },
                  { key: "neutral", name: "Neutral", color: "var(--muted-foreground)" },
                  { key: "negative", name: "Negative", color: "var(--destructive)" },
                ]}
              />
            )}
          </StateBlock>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SectionCard testId="analytics-top-card" title="Highest research scores" subtitle="Descriptive composite score — not a recommendation.">
          <StateBlock loading={isLoading} error={isError} testId="analytics-top">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead className="text-right">Change %</TableHead>
                  <TableHead className="text-right">Technical</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.top_research_scores.map((a) => (
                  <TableRow key={a.symbol} data-testid={`analytics-top-row-${a.symbol}`}>
                    <TableCell className="font-mono text-xs font-bold uppercase">{a.symbol}</TableCell>
                    <TableCell className="text-xs">{a.market}</TableCell>
                    <TableCell className={cn("text-right font-mono text-xs", toneClass(a.change_percent))}>
                      {formatPercent(a.change_percent)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{a.technical_score.toFixed(1)}</TableCell>
                    <TableCell className={cn("text-right font-mono text-sm font-bold", scoreTone(a.research_score))}>
                      {a.research_score.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </StateBlock>
        </SectionCard>

        <SectionCard testId="analytics-backtests-card" title="Backtesting performance" subtitle="Most recent runs stored in the database.">
          <StateBlock
            loading={isLoading}
            error={isError}
            empty={(data?.recent_backtests ?? []).length === 0}
            emptyLabel="No backtests stored yet — run one from the Backtesting page."
            testId="analytics-backtests"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead className="text-right">Return</TableHead>
                  <TableHead className="text-right">Win rate</TableHead>
                  <TableHead className="text-right">Trades</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.recent_backtests.map((b) => (
                  <TableRow key={b.id} data-testid={`analytics-backtest-row-${b.id}`}>
                    <TableCell className="font-mono text-xs font-bold uppercase">{b.symbol}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{b.strategy}</TableCell>
                    <TableCell className={cn("text-right font-mono text-xs", toneClass(b.total_return_percent))}>
                      {formatPercent(b.total_return_percent)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{b.win_rate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono text-xs">{b.total_trades}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </StateBlock>
        </SectionCard>
      </div>
    </div>
  );
}
