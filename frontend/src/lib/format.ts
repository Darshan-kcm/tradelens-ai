const CURRENCY_PREFIX: Record<string, string> = { INR: "₹", USD: "$", JPY: "¥" };

export function formatPrice(value: number, currency = "USD"): string {
  const prefix = CURRENCY_PREFIX[currency] ?? "";
  const digits = Math.abs(value) < 5 ? 4 : 2;
  return `${prefix}${value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatPercent(value: number, withSign = true): string {
  const sign = withSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function toneClass(value: number): string {
  if (value > 0) return "text-[#15803d] dark:text-[#4ade80]";
  if (value < 0) return "text-[#b91c1c] dark:text-[#f87171]";
  return "text-muted-foreground";
}

export function scoreTone(score: number): string {
  if (score >= 60) return "text-[#15803d] dark:text-[#4ade80]";
  if (score < 45) return "text-[#b91c1c] dark:text-[#f87171]";
  return "text-[#b45309] dark:text-[#fbbf24]";
}

export function sentimentClass(sentiment: string): string {
  if (sentiment === "positive") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (sentiment === "negative") return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}
