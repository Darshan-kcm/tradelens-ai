import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Candle, EquityPoint, VolumeBar } from "@/lib/types";
import { formatCompact, shortDate } from "@/lib/format";

const AXIS = { stroke: "currentColor", fontSize: 11, tickLine: false, axisLine: false } as const;
const GRID_CLASS = "stroke-border";

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--card-foreground)",
  fontSize: 12,
};

export function PriceTrendChart({ candles, testId }: { candles: Candle[]; testId: string }) {
  const data = candles.map((c) => ({
    date: shortDate(c.timestamp),
    close: c.close,
    ema21: c.ema21,
    ema50: c.ema50,
  }));
  return (
    <div className="h-72 w-full text-muted-foreground" data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="closeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} className={GRID_CLASS} strokeDasharray="3 3" />
          <XAxis dataKey="date" {...AXIS} minTickGap={40} />
          <YAxis {...AXIS} domain={["auto", "auto"]} tickFormatter={(v: number) => formatCompact(v)} width={58} />
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            type="monotone"
            dataKey="close"
            name="Close"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#closeFill)"
          />
          <Line type="monotone" dataKey="ema21" name="EMA 21" stroke="var(--chart-3)" dot={false} strokeWidth={1.5} />
          <Line type="monotone" dataKey="ema50" name="EMA 50" stroke="var(--chart-4)" dot={false} strokeWidth={1.5} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RsiChart({ candles, testId }: { candles: Candle[]; testId: string }) {
  const data = candles.map((c) => ({ date: shortDate(c.timestamp), rsi: c.rsi }));
  return (
    <div className="h-44 w-full text-muted-foreground" data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} className={GRID_CLASS} strokeDasharray="3 3" />
          <XAxis dataKey="date" {...AXIS} minTickGap={50} />
          <YAxis {...AXIS} domain={[0, 100]} ticks={[0, 30, 50, 70, 100]} width={34} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="rsi" name="RSI(14)" stroke="var(--chart-2)" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PriceVolumeChart({ bars, testId }: { bars: VolumeBar[]; testId: string }) {
  const data = bars.map((b) => ({
    date: shortDate(b.timestamp),
    volume: b.volume,
    avg_volume: b.avg_volume,
    close: b.close,
  }));
  return (
    <div className="h-72 w-full text-muted-foreground" data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} className={GRID_CLASS} strokeDasharray="3 3" />
          <XAxis dataKey="date" {...AXIS} minTickGap={40} />
          <YAxis yAxisId="v" {...AXIS} tickFormatter={(v: number) => formatCompact(v)} width={58} />
          <YAxis
            yAxisId="p"
            orientation="right"
            {...AXIS}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => formatCompact(v)}
            width={58}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar yAxisId="v" dataKey="volume" name="Volume" fill="var(--chart-1)" radius={[2, 2, 0, 0]} opacity={0.7} />
          <Line
            yAxisId="v"
            type="monotone"
            dataKey="avg_volume"
            name="20D avg volume"
            stroke="var(--chart-3)"
            dot={false}
            strokeWidth={2}
          />
          <Line yAxisId="p" type="monotone" dataKey="close" name="Close" stroke="var(--chart-5)" dot={false} strokeWidth={2} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EquityCurveChart({ points, testId }: { points: EquityPoint[]; testId: string }) {
  const data = points.map((p) => ({
    date: shortDate(p.timestamp),
    equity: p.equity,
    buy_and_hold: p.buy_and_hold,
  }));
  return (
    <div className="h-80 w-full text-muted-foreground" data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} className={GRID_CLASS} strokeDasharray="3 3" />
          <XAxis dataKey="date" {...AXIS} minTickGap={40} />
          <YAxis {...AXIS} domain={["auto", "auto"]} tickFormatter={(v: number) => formatCompact(v)} width={62} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line type="monotone" dataKey="equity" name="Strategy equity" stroke="var(--chart-1)" dot={false} strokeWidth={2.2} />
          <Line
            type="monotone"
            dataKey="buy_and_hold"
            name="Buy & hold"
            stroke="var(--chart-3)"
            dot={false}
            strokeWidth={1.6}
            strokeDasharray="5 4"
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GenericBarChart<T extends object>({
  data,
  xKey,
  series,
  height = 280,
  testId,
}: {
  data: T[];
  xKey: string;
  series: { key: string; name: string; color: string }[];
  height?: number;
  testId: string;
}) {
  return (
    <div className="w-full text-muted-foreground" style={{ height }} data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} className={GRID_CLASS} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} {...AXIS} minTickGap={20} />
          <YAxis {...AXIS} tickFormatter={(v: number) => formatCompact(v)} width={52} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GenericLineChart<T extends object>({
  data,
  xKey,
  series,
  height = 280,
  testId,
}: {
  data: T[];
  xKey: string;
  series: { key: string; name: string; color: string }[];
  height?: number;
  testId: string;
}) {
  return (
    <div className="w-full text-muted-foreground" style={{ height }} data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} className={GRID_CLASS} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} {...AXIS} minTickGap={20} />
          <YAxis {...AXIS} tickFormatter={(v: number) => formatCompact(v)} width={52} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} dot={false} strokeWidth={2} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
