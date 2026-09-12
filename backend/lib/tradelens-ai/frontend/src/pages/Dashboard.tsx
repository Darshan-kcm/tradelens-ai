import { useQuery } from "@tanstack/react-query";
import { Activity, Flame, Newspaper, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { PriceTrendChart } from "@/components/charts/Charts";
import {
  Delta,
  DISCLAIMER_TEXT,
  PageHeader,
  ScoreBar,
  SectionCard,
  SentimentPill,
  StateBlock,
} from "@/components/common/Widgets";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { apiGet } from "@/lib/api";
import { formatCompact, formatDateTime, formatPrice, scoreTone, toneClass } from "@/lib/format";
import type { AssetSnapshot, DashboardResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

function MoverRow({ asset, testId }: { asset: AssetSnapshot; testId: string }) {
  return (
    <Link
      to={`/markets?symbol=${asset.symbol}`}
      className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-muted"
      data-testid={testId}
    >
      <div className="min-w-0">
        <div className="font-mono text-xs font-bold uppercase tracking-wider">{asset.symbol}</div>
        <div className="truncate text-xs text-muted-foreground">{asset.name}</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm font-semibold">{formatPrice(asset.price, asset.currency)}</div>
        <Delta value={asset.change_percent} className="text-xs" />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery<DashboardResponse>({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardResponse>("/dashboard"),
  });

  const sentiment = data?.sentiment;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <PageHeader
        testId="dashboard-header"
        title="Market Dashboard"
        description="Cross-market overview built from seeded historical demo data: latest EOD prices, breadth, volume behaviour and news sentiment."
      />

      <StateBlock loading={isLoading} error={isError} testId="dashboard-summary">
        <section
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          data-testid="dashboard-market-summary"
        >
          {data?.watchlist.map((asset) => (
            <Card
              key={asset.symbol}
              className="shadow-sm transition-colors duration-200 hover:border-slate-300 dark:hover:border-slate-700"
              data-testid={`market-card-${asset.symbol}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {asset.symbol}
                    </div>
                    <div className="mt-0.5 truncate text-sm font-semibold">{asset.name}</div>
                  </div>
                  <Badge variant={asset.market_status === "Closed" ? "outline" : "secondary"} className="shrink-0">
                    {asset.market_status}
                  </Badge>
                </div>
                <div className="mt-4 flex items-end justify-between gap-2">
                  <div className="font-mono text-xl font-semibold tracking-tight">
                    {formatPrice(asset.price, asset.currency)}
                  </div>
                  <Delta value={asset.change_percent} />
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>Vol {formatCompact(asset.volume)}</span>
                  <span className={cn("font-mono font-semibold", scoreTone(asset.research_score))}>
                    Score {asset.research_score.toFixed(0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </StateBlock>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.65fr_1fr]">
        <SectionCard
          testId="dashboard-trend-card"
          title={`Market trend — ${data?.trend.name ?? "NIFTY 50"}`}
          subtitle="Daily closes with EMA 21 / EMA 50 overlays, computed on the backend."
        >
          <StateBlock loading={isLoading} error={isError} testId="dashboard-trend">
            {data && <PriceTrendChart candles={data.trend.candles} testId="dashboard-trend-chart" />}
          </StateBlock>
        </SectionCard>

        <SectionCard
          testId="dashboard-lens-card"
          title="AI Market Lens"
          subtitle="Descriptive research scores aggregated across the demo universe — not a prediction or trading signal."
        >
          <StateBlock loading={isLoading} error={isError} testId="dashboard-lens">
            {data && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    Overall Research Score
                  </div>
                  <div className="mt-1 flex items-end gap-2">
                    <span
                      className={cn("font-mono text-4xl font-bold tracking-tight", scoreTone(data.lens.research_score))}
                      data-testid="lens-overall-score"
                    >
                      {data.lens.research_score.toFixed(1)}
                    </span>
                    <span className="pb-1 text-xs text-muted-foreground">/ 100</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{data.lens.verdict}</p>
                </div>
                <ScoreBar label="Technical" value={data.lens.technical_score} testId="lens-technical-score" />
                <ScoreBar label="Fundamental" value={data.lens.fundamental_score} testId="lens-fundamental-score" />
                <ScoreBar label="Volume" value={data.lens.volume_score} testId="lens-volume-score" />
                <ScoreBar label="News sentiment" value={data.lens.news_score} testId="lens-news-score" />
              </div>
            )}
          </StateBlock>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SectionCard
          testId="dashboard-gainers-card"
          title="Top gainers"
          right={<TrendingUp className="size-4 text-[#15803d]" />}
        >
          <StateBlock loading={isLoading} error={isError} testId="dashboard-gainers">
            <div className="space-y-1">
              {data?.gainers.map((a) => (
                <MoverRow key={a.symbol} asset={a} testId={`gainer-row-${a.symbol}`} />
              ))}
            </div>
          </StateBlock>
        </SectionCard>

        <SectionCard
          testId="dashboard-losers-card"
          title="Top losers"
          right={<TrendingDown className="size-4 text-[#b91c1c]" />}
        >
          <StateBlock loading={isLoading} error={isError} testId="dashboard-losers">
            <div className="space-y-1">
              {data?.losers.map((a) => (
                <MoverRow key={a.symbol} asset={a} testId={`loser-row-${a.symbol}`} />
              ))}
            </div>
          </StateBlock>
        </SectionCard>

        <SectionCard
          testId="dashboard-active-card"
          title="Most active"
          subtitle="Ranked by volume vs 20-day average"
          right={<Flame className="size-4 text-[#d97706]" />}
        >
          <StateBlock loading={isLoading} error={isError} testId="dashboard-active">
            <div className="space-y-1">
              {data?.most_active.map((a) => (
                <div
                  key={a.symbol}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-muted"
                  data-testid={`active-row-${a.symbol}`}
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold uppercase tracking-wider">{a.symbol}</div>
                    <div className="truncate text-xs text-muted-foreground">Vol {formatCompact(a.volume)}</div>
                  </div>
                  <span className={cn("font-mono text-sm font-semibold", toneClass(a.volume_change_percent))}>
                    {a.volume_change_percent > 0 ? "+" : ""}
                    {a.volume_change_percent.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </StateBlock>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.5fr]">
        <SectionCard
          testId="dashboard-sentiment-card"
          title="Market sentiment"
          subtitle={sentiment ? `${sentiment.total} demo news items analysed` : undefined}
          right={<Activity className="size-4 text-muted-foreground" />}
        >
          <StateBlock loading={isLoading} error={isError} testId="dashboard-sentiment">
            {sentiment && (
              <div className="space-y-4">
                <div className="flex h-3 w-full overflow-hidden rounded-full">
                  <div className="bg-[#16a34a] transition-[width] duration-500" style={{ width: `${sentiment.positive}%` }} />
                  <div className="bg-slate-300 transition-[width] duration-500 dark:bg-slate-600" style={{ width: `${sentiment.neutral}%` }} />
                  <div className="bg-[#dc2626] transition-[width] duration-500" style={{ width: `${sentiment.negative}%` }} />
                </div>
                <dl className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "Positive", value: sentiment.positive, testId: "sentiment-positive" },
                    { label: "Neutral", value: sentiment.neutral, testId: "sentiment-neutral" },
                    { label: "Negative", value: sentiment.negative, testId: "sentiment-negative" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-md border border-border p-3">
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {s.label}
                      </dt>
                      <dd className="mt-1 font-mono text-lg font-semibold" data-testid={s.testId}>
                        {s.value.toFixed(0)}%
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </StateBlock>
        </SectionCard>

        <SectionCard
          testId="dashboard-news-card"
          title="Recent news"
          subtitle="Sample research notes generated for the demo dataset"
          right={<Newspaper className="size-4 text-muted-foreground" />}
        >
          <StateBlock loading={isLoading} error={isError} testId="dashboard-news">
            <ul className="divide-y divide-border">
              {data?.news.slice(0, 6).map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0" data-testid={`dashboard-news-${item.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium leading-snug">{item.headline}</p>
                    <SentimentPill sentiment={item.sentiment} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono font-semibold uppercase">{item.asset_symbol}</span>
                    <span>·</span>
                    <span>{item.source}</span>
                    <span>·</span>
                    <span>{formatDateTime(item.published_at)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </StateBlock>
        </SectionCard>
      </div>

      <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
        {DISCLAIMER_TEXT}
      </p>
    </div>
  );
}
