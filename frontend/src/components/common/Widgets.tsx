import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatPercent, scoreTone, toneClass } from "@/lib/format";
import { cn } from "@/lib/utils";


export function PageHeader({
  title,
  description,
  actions,
  testId,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  testId: string;
}) {
  return (
    <div
      className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between"
      data-testid={testId}
    >
      <div className="max-w-2xl">
                <h1 className="font-heading text-2xl font-bold tracking-tight md:text-[28px]">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Delta({ value, className }: { value: number; className?: string }) {
  const Icon = value > 0 ? ArrowUp : value < 0 ? ArrowDown : Minus;
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-sm font-semibold", toneClass(value), className)}>
      <Icon className="size-3.5" />
      {formatPercent(value)}
    </span>
  );
}

export function ScoreBar({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div data-testid={testId}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
        <span className={cn("font-mono text-sm font-bold", scoreTone(value))}>{value.toFixed(1)}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out dark:bg-[#3b82f6]"
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  testId,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative";
  testId: string;
}) {
  const toneCls =
    tone === "positive"
      ? "text-[#15803d] dark:text-[#4ade80]"
      : tone === "negative"
        ? "text-[#b91c1c] dark:text-[#f87171]"
        : "";
  return (
    <Card className="shadow-sm transition-colors duration-200 hover:border-slate-300 dark:hover:border-slate-700">
      <CardContent className="p-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
        <div className={cn("mt-2 font-mono text-2xl font-semibold tracking-tight", toneCls)} data-testid={testId}>
          {value}
        </div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export function SectionCard({
  title,
  subtitle,
  right,
  children,
  className,
  testId,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  testId: string;
}) {
  return (
    <Card
      className={cn(
        "shadow-sm transition-colors duration-200 hover:border-slate-300 dark:hover:border-slate-700",
        className,
      )}
      data-testid={testId}
    >
      <CardContent className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-base font-bold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {right}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function StateBlock({
  loading,
  error,
  empty,
  emptyLabel = "No data matched your criteria.",
  children,
  testId,
}: {
  loading: boolean;
  error: boolean;
  empty?: boolean;
  emptyLabel?: string;
  children: ReactNode;
  testId: string;
}) {
  if (loading) {
    return (
      <div className="space-y-2" data-testid={`${testId}-loading`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 w-full animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div
        className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground"
        data-testid={`${testId}-error`}
      >
      Backend data is unavailable right now. Start the API and refresh to try again.
      </div>
    );
  }
  if (empty) {
    return (
      <div
        className="rounded-md border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground"
        data-testid={`${testId}-empty`}
      >
        {emptyLabel}
      </div>
    );
  }
  return <>{children}</>;
}

export function SentimentPill({ sentiment }: { sentiment: string }) {
  const variant = sentiment === "positive" ? "secondary" : sentiment === "negative" ? "destructive" : "outline";
  return (
    <Badge variant={variant} className="capitalize" data-testid={`sentiment-pill-${sentiment}`}>
      {sentiment}
    </Badge>
  );
}

export const DISCLAIMER_TEXT =
  "TradeLens AI is a research, screening and backtesting tool built on clearly-labelled demo data. Scores are descriptive research metrics, not predictions or trading signals. No broker connectivity or order execution exists in this platform.";
