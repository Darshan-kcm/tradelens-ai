import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader, SectionCard, SentimentPill, StateBlock } from "@/components/common/Widgets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { NewsResponse } from "@/lib/types";

const FILTERS = ["all", "positive", "neutral", "negative"];

export default function News() {
  const [sentiment, setSentiment] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery<NewsResponse>({
    queryKey: ["news", sentiment],
    queryFn: () => apiGet<NewsResponse>(`/news?sentiment=${sentiment}&limit=120`),
  });

  const q = search.trim().toLowerCase();
  const items = (data?.items ?? []).filter(
    (n) => !q || n.headline.toLowerCase().includes(q) || n.asset_symbol.toLowerCase().includes(q),
  );
  const summary = data?.summary;

  return (
    <div className="space-y-6" data-testid="news-page">
      <PageHeader
        testId="news-header"
        title="News & Sentiment"
        description="Sample research notes with a rule-based sentiment label per item. The backend exposes the same shape a real news API would fill, so a provider can be plugged in later."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        <SectionCard
          testId="news-summary-card"
          title="Sentiment summary"
          subtitle={summary ? `${summary.total} items in the current view` : undefined}
        >
          <StateBlock loading={isLoading} error={isError} testId="news-summary">
            {summary && (
              <div className="space-y-4">
                <div className="flex h-3 w-full overflow-hidden rounded-full">
                  <div className="bg-[#16a34a]" style={{ width: `${summary.positive}%` }} />
                  <div className="bg-slate-300 dark:bg-slate-600" style={{ width: `${summary.neutral}%` }} />
                  <div className="bg-[#dc2626]" style={{ width: `${summary.negative}%` }} />
                </div>
                {[
                  { label: "Positive", value: summary.positive, id: "positive" },
                  { label: "Neutral", value: summary.neutral, id: "neutral" },
                  { label: "Negative", value: summary.negative, id: "negative" },
                ].map((row) => (
                  <div key={row.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm">{row.label}</span>
                    <span className="font-mono text-sm font-semibold" data-testid={`news-summary-${row.id}`}>
                      {row.value.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </StateBlock>
        </SectionCard>

        <SectionCard
          testId="news-feed-card"
          title="News feed"
          subtitle={`${items.length} items`}
          right={
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <Button
                  key={f}
                  variant={sentiment === f ? "default" : "outline"}
                  size="xs"
                  className="capitalize"
                  onClick={() => setSentiment(f)}
                  data-testid={`news-filter-${f}`}
                >
                  {f}
                </Button>
              ))}
            </div>
          }
        >
          <Input
            placeholder="Search headlines or symbols…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4"
            data-testid="news-search-input"
          />
          <StateBlock
            loading={isLoading}
            error={isError}
            empty={items.length === 0}
            emptyLabel="No news items matched this filter."
            testId="news-feed"
          >
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id} className="py-4 first:pt-0" data-testid={`news-item-${item.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold leading-snug">{item.headline}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.summary}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="font-mono uppercase">
                          {item.asset_symbol}
                        </Badge>
                        <span>{item.asset_name}</span>
                        <span>·</span>
                        <span>{item.source}</span>
                        <span>·</span>
                        <span>{formatDateTime(item.published_at)}</span>
                        <span>·</span>
                        <Badge variant="ghost" className="capitalize">
                          {item.category}
                        </Badge>
                      </div>
                    </div>
                    <SentimentPill sentiment={item.sentiment} />
                  </div>
                </li>
              ))}
            </ul>
          </StateBlock>
        </SectionCard>
      </div>
    </div>
  );
}
