import { useQuery } from "@tanstack/react-query";
import { LogOut, Moon, Sun } from "lucide-react";
import { DISCLAIMER_TEXT, PageHeader, SectionCard } from "@/components/common/Widgets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCurrentUser, useTheme } from "@/hooks/useApp";
import { apiGet } from "@/lib/api";
import { endSession } from "@/lib/session";
import type { Market } from "@/lib/types";

const DATA_SOURCES = [
  { label: "Market & historical prices", status: "Live", note: "Twelve Data, falls back per-symbol if unavailable" },
  { label: "News & sentiment", status: "Live", note: "Marketaux, falls back per-symbol if unavailable" },
  { label: "Fundamentals", status: "Live / fallback", note: "equities only; some fields need a paid data tier" },
  { label: "Technical indicators", status: "Computed", note: "backend/lib/analytics.py" },
  { label: "Backtesting engine", status: "Computed", note: "backend/lib/backtester.py" },
];

export default function Settings() {
  const { theme, toggle } = useTheme();
  const { data: user } = useCurrentUser();
  const markets = useQuery<Market[]>({ queryKey: ["markets"], queryFn: () => apiGet<Market[]>("/markets") });

  return (
    <div className="space-y-6" data-testid="settings-page">
      <PageHeader
        testId="settings-header"
        title="Settings"
        description="Appearance, account and data-source status for this TradeLens AI deployment."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard testId="settings-appearance-card" title="Appearance" subtitle="Light mode is the default professional theme.">
          <div className="flex items-center justify-between rounded-md border border-border p-4">
            <div>
              <Label className="text-sm font-semibold">Colour theme</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Currently using {theme === "dark" ? "dark" : "light"} mode.
              </p>
            </div>
            <Button variant="outline" onClick={toggle} data-testid="settings-theme-toggle">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              Switch to {theme === "dark" ? "light" : "dark"}
            </Button>
          </div>
        </SectionCard>

         <SectionCard testId="settings-account-card" title="Account" subtitle="Session managed by a secure httpOnly cookie.">
          <div className="space-y-3">
            <div className="rounded-md border border-border p-4">
              <div className="text-sm font-semibold" data-testid="settings-user-name">
                {user?.name ?? "Guest"}
              </div>
              <div className="mt-1 font-mono text-xs text-muted-foreground" data-testid="settings-user-email">
                {user?.email ?? "—"}
              </div>
              <Badge variant="outline" className="mt-3 capitalize">
                {user?.role ?? "guest"}
              </Badge>
            </div>
            <Button variant="outline" onClick={() => void endSession()} data-testid="settings-logout-button">
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </SectionCard>
      </div>

         <SectionCard
        testId="settings-data-card"
        title="Data sources"
        subtitle="Every module reads through the FastAPI layer, sourced live where the provider supports it."
      >
        <ul className="divide-y divide-border">
          {DATA_SOURCES.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div>
                <div className="text-sm font-medium">{row.label}</div>
                <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{row.note}</div>
              </div>
             <Badge variant={row.status === "Demo generator" ? "outline" : "secondary"}>{row.status}</Badge>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard testId="settings-coverage-card" title="Market coverage" subtitle="Assets currently seeded per market.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(markets.data ?? []).map((m) => (
            <div key={m.code} className="rounded-md border border-border p-3" data-testid={`settings-market-${m.code}`}>
              <div className="font-mono text-xs font-bold uppercase tracking-wider">{m.code}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">{m.region}</div>
              <div className="mt-2 font-mono text-lg font-semibold">{m.asset_count}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <p className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
        {DISCLAIMER_TEXT}
      </p>
    </div>
  );
}
