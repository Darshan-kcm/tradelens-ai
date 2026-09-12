import { useQuery } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { PageHeader, SectionCard, StateBlock } from "@/components/common/Widgets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { formatCompact, formatNumber } from "@/lib/format";
import type { Fundamentals as FundamentalsRow } from "@/lib/types";

interface Criteria {
  minRoe: string;
  minRevenueGrowth: string;
  maxPe: string;
  onlyAvailable: boolean;
}

const DEFAULTS: Criteria = { minRoe: "15", minRevenueGrowth: "10", maxPe: "30", onlyAvailable: true };

function buildQuery(c: Criteria): string {
  const p = new URLSearchParams();
  if (c.minRoe) p.set("min_roe", c.minRoe);
  if (c.minRevenueGrowth) p.set("min_revenue_growth", c.minRevenueGrowth);
  if (c.maxPe) p.set("max_pe", c.maxPe);
  p.set("only_available", String(c.onlyAvailable));
  return p.toString();
}

export default function Fundamentals() {
  const [draft, setDraft] = useState<Criteria>(DEFAULTS);
  const [applied, setApplied] = useState<Criteria>(DEFAULTS);

  const { data, isLoading, isError } = useQuery<FundamentalsRow[]>({
    queryKey: ["fundamentals", applied],
    queryFn: () => apiGet<FundamentalsRow[]>(`/fundamentals?${buildQuery(applied)}`),
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6" data-testid="fundamentals-page">
      <PageHeader
        testId="fundamentals-header"
        title="Fundamental Analysis"
        description="Ratio screening over the demo equity universe. Indices, forex, commodities and crypto have no fundamentals and are labelled unavailable rather than filled with invented numbers."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDraft(DEFAULTS);
                setApplied(DEFAULTS);
              }}
              data-testid="fundamentals-reset-button"
            >
              <RotateCcw className="size-4" /> Reset
            </Button>
            <Button onClick={() => setApplied({ ...draft })} data-testid="fundamentals-apply-button">
              Apply filters
            </Button>
          </>
        }
      />

      <SectionCard
        testId="fundamentals-filters-card"
        title="Screening criteria"
        subtitle="Example: ROE > 15%, revenue growth > 10%, P/E < 30."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <Label htmlFor="min-roe">Minimum ROE %</Label>
            <Input
              id="min-roe"
              type="number"
              className="mt-2"
              value={draft.minRoe}
              onChange={(e) => setDraft({ ...draft, minRoe: e.target.value })}
              data-testid="fundamentals-min-roe-input"
            />
          </div>
          <div>
            <Label htmlFor="min-growth">Minimum revenue growth %</Label>
            <Input
              id="min-growth"
              type="number"
              className="mt-2"
              value={draft.minRevenueGrowth}
              onChange={(e) => setDraft({ ...draft, minRevenueGrowth: e.target.value })}
              data-testid="fundamentals-min-growth-input"
            />
          </div>
          <div>
            <Label htmlFor="max-pe">Maximum P/E</Label>
            <Input
              id="max-pe"
              type="number"
              className="mt-2"
              value={draft.maxPe}
              onChange={(e) => setDraft({ ...draft, maxPe: e.target.value })}
              data-testid="fundamentals-max-pe-input"
            />
          </div>
          <div className="flex items-end gap-2.5 pb-2">
            <Checkbox
              id="only-available"
              checked={draft.onlyAvailable}
              onCheckedChange={(checked) => setDraft({ ...draft, onlyAvailable: Boolean(checked) })}
              data-testid="fundamentals-only-available-toggle"
            />
            <Label htmlFor="only-available" className="font-normal">
              Only assets with fundamental data
            </Label>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        testId="fundamentals-table-card"
        title="Fundamental metrics"
        subtitle={`${rows.length} assets in view`}
        right={
          <Badge variant="outline" className="font-mono" data-testid="fundamentals-count">
            {rows.length}
          </Badge>
        }
      >
        <StateBlock
          loading={isLoading}
          error={isError}
          empty={rows.length === 0}
          emptyLabel="No assets met these fundamental criteria."
          testId="fundamentals-table"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead className="text-right">Market cap</TableHead>
                  <TableHead className="text-right">P/E</TableHead>
                  <TableHead className="text-right">P/B</TableHead>
                  <TableHead className="text-right">EPS</TableHead>
                  <TableHead className="text-right">ROE %</TableHead>
                  <TableHead className="text-right">Rev growth %</TableHead>
                  <TableHead className="text-right">Profit growth %</TableHead>
                  <TableHead className="text-right">D/E</TableHead>
                  <TableHead className="text-right">Div yield %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.symbol} data-testid={`fundamentals-row-${r.symbol}`}>
                    <TableCell>
                      <div className="font-mono text-xs font-bold uppercase tracking-wider">{r.symbol}</div>
                      <div className="max-w-[170px] truncate text-xs text-muted-foreground">{r.name}</div>
                    </TableCell>
                    <TableCell className="text-xs">{r.market}</TableCell>
                    {r.available ? (
                      <>
                        <TableCell className="text-right font-mono text-xs">{formatCompact(r.market_cap)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatNumber(r.pe_ratio)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatNumber(r.pb_ratio)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatNumber(r.eps)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatNumber(r.roe)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatNumber(r.revenue_growth)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatNumber(r.profit_growth)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatNumber(r.debt_to_equity)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatNumber(r.dividend_yield)}</TableCell>
                      </>
                    ) : (
                      <TableCell colSpan={9} className="text-xs italic text-muted-foreground">
                        {r.note ?? "Fundamental data unavailable"}
                      </TableCell>
                    )}
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
