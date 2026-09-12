// Real candlestick charting via TradingView's own lightweight-charts library.
import { useEffect, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  createChart,
} from "lightweight-charts";
import type { Candle } from "@/lib/types";
import { useTheme } from "@/hooks/useApp";

function toUtcTimestamp(iso: string): UTCTimestamp {
  return (new Date(iso).getTime() / 1000) as UTCTimestamp;
}

const PALETTE = {
  dark: {
    background: "transparent",
    text: "#94a3b8",
    grid: "rgba(148, 163, 184, 0.08)",
    border: "rgba(148, 163, 184, 0.18)",
    up: "#22c55e",
    down: "#ef4444",
    volumeUp: "rgba(34, 197, 94, 0.5)",
    volumeDown: "rgba(239, 68, 68, 0.5)",
    ema21: "#38bdf8",
    ema50: "#f59e0b",
  },
  light: {
    background: "transparent",
    text: "#64748b",
    grid: "rgba(100, 116, 139, 0.10)",
    border: "rgba(100, 116, 139, 0.22)",
    up: "#16a34a",
    down: "#dc2626",
    volumeUp: "rgba(22, 163, 74, 0.45)",
    volumeDown: "rgba(220, 38, 38, 0.45)",
    ema21: "#0284c7",
    ema50: "#d97706",
  },
} as const;

export function CandlestickChart({
  candles,
  testId,
  height = 380,
}: {
  candles: Candle[];
  testId: string;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const colors = PALETTE[theme];

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        fontSize: 11,
        fontFamily: "inherit",
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border, timeVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
      autoSize: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: colors.up,
      downColor: colors.down,
      borderVisible: false,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    const ema21Series = chart.addLineSeries({
      color: colors.ema21,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const ema50Series = chart.addLineSeries({
      color: colors.ema50,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    ema21SeriesRef.current = ema21Series;
    ema50SeriesRef.current = ema50Series;

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const ema21Series = ema21SeriesRef.current;
    const ema50Series = ema50SeriesRef.current;
    if (!candleSeries || !volumeSeries || !ema21Series || !ema50Series || candles.length === 0) return;

    const colors = PALETTE[theme];
    const sorted = [...candles].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    candleSeries.setData(
      sorted.map((c) => ({
        time: toUtcTimestamp(c.timestamp),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    volumeSeries.setData(
      sorted.map((c) => ({
        time: toUtcTimestamp(c.timestamp),
        value: c.volume,
        color: c.close >= c.open ? colors.volumeUp : colors.volumeDown,
      })),
    );

    ema21Series.setData(
      sorted
        .filter((c) => c.ema21 != null)
        .map((c) => ({ time: toUtcTimestamp(c.timestamp), value: c.ema21 as number })),
    );
    ema50Series.setData(
      sorted
        .filter((c) => c.ema50 != null)
        .map((c) => ({ time: toUtcTimestamp(c.timestamp), value: c.ema50 as number })),
    );

    chartRef.current?.timeScale().fitContent();
  }, [candles, theme]);

  return (
    <div className="w-full" style={{ height }} data-testid={testId}>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}