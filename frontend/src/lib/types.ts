// Hand-written mirrors of the Pydantic models in backend/models/schemas.py.
// Nothing infers across the Python boundary — keep both sides in sync.

export type Sentiment = "positive" | "neutral" | "negative";

export interface Asset {
  symbol: string;
  name: string;
  market: string;
  asset_type: string;
  sector: string;
  currency: string;
  data_source: string;
}

export interface Market {
  code: string;
  name: string;
  region: string;
  currency: string;
  asset_count: number;
}

export interface AssetSnapshot {
  symbol: string;
  name: string;
  market: string;
  asset_type: string;
  sector: string;
  currency: string;
  price: number;
  change: number;
  change_percent: number;
  volume: number;
  avg_volume: number;
  volume_change_percent: number;
  volume_spike: boolean;
  rsi: number | null;
  ema21: number | null;
  ema50: number | null;
  ema200: number | null;
  sma50: number | null;
  above_ema21: boolean;
  above_ema50: boolean;
  above_ema200: boolean;
  ema_status: string;
  market_cap: number | null;
  pe_ratio: number | null;
  pb_ratio: number | null;
  roe: number | null;
  revenue_growth: number | null;
  sentiment: Sentiment;
  sentiment_score: number;
  technical_score: number;
  fundamental_score: number;
  volume_score: number;
  news_score: number;
  research_score: number;
  market_status: string;
  timestamp: string;
  data_source: string;
}

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema21: number | null;
  ema50: number | null;
  ema200: number | null;
  rsi: number | null;
  avg_volume: number | null;
}

export interface PriceSeries {
  symbol: string;
  name: string;
  interval: string;
  candles: Candle[];
  data_source: string;
}

export interface VolumeBar {
  timestamp: string;
  close: number;
  volume: number;
  avg_volume: number | null;
  volume_ratio: number | null;
  spike: boolean;
}

export interface VolumeSeries {
  symbol: string;
  name: string;
  latest_volume: number;
  average_volume: number;
  volume_change_percent: number;
  spike_count: number;
  bars: VolumeBar[];
  data_source: string;
}

export interface Fundamentals {
  symbol: string;
  name: string;
  market: string;
  available: boolean;
  note: string | null;
  market_cap: number | null;
  pe_ratio: number | null;
  pb_ratio: number | null;
  eps: number | null;
  roe: number | null;
  revenue_growth: number | null;
  profit_growth: number | null;
  debt_to_equity: number | null;
  dividend_yield: number | null;
  data_source: string;
}

export interface NewsItem {
  id: string;
  asset_symbol: string;
  asset_name: string;
  headline: string;
  summary: string;
  source: string;
  published_at: string;
  category: string;
  sentiment: Sentiment;
  sentiment_score: number;
  url: string | null;
  data_source: string;
}

export interface SentimentSummary {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

export interface NewsResponse {
  items: NewsItem[];
  summary: SentimentSummary;
  data_source: string;
}

export interface MarketSession {
  market: string;
  exchange: string;
  timezone: string;
  local_time: string;
  local_date: string;
  open_time: string;
  close_time: string;
  is_open: boolean;
  status: string;
  open_utc_hour: number;
  close_utc_hour: number;
}

export interface MarketSessionsResponse {
  reference_utc: string;
  reference_utc_hour: number;
  sessions: MarketSession[];
}

export interface ScoreBreakdown {
  technical_score: number;
  fundamental_score: number;
  volume_score: number;
  news_score: number;
  research_score: number;
  verdict: string;
}

export interface DashboardResponse {
  watchlist: AssetSnapshot[];
  gainers: AssetSnapshot[];
  losers: AssetSnapshot[];
  most_active: AssetSnapshot[];
  trend: PriceSeries;
  sentiment: SentimentSummary;
  news: NewsItem[];
  lens: ScoreBreakdown;
  data_source: string;
}

export type FilterOperator = "gt" | "gte" | "lt" | "lte" | "eq";

export interface ScreenerFilter {
  field: string;
  operator: FilterOperator;
  value: number;
}

export interface ScreenerRequest {
  markets: string[];
  asset_types: string[];
  sentiments: string[];
  search?: string | null;
  price_above_ema21: boolean;
  price_above_ema50: boolean;
  price_above_ema200: boolean;
  volume_above_average: boolean;
  filters: ScreenerFilter[];
  sort_by: string;
  sort_desc: boolean;
  limit: number;
}

export interface ScreenerResponse {
  count: number;
  scanned: number;
  results: AssetSnapshot[];
  data_source: string;
}

export interface BacktestRequest {
  symbol: string;
  lookback_days: number;
  initial_capital: number;
  strategy: "ema_rsi_volume" | "ema_crossover" | "rsi_reversal";
  rsi_threshold: number;
  ema_period: 21 | 50 | 200;
  require_volume: boolean;
  stop_loss_percent: number;
  risk_reward: number;
  position_size_percent: number;
}

export interface Trade {
  id: number;
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  quantity: number;
  pnl: number;
  return_percent: number;
  outcome: "win" | "loss";
  exit_reason: string;
  bars_held: number;
}

export interface EquityPoint {
  timestamp: string;
  equity: number;
  buy_and_hold: number;
}

export interface BacktestResponse {
  id: string;
  symbol: string;
  name: string;
  strategy: string;
  entry_rules: string[];
  exit_rules: string[];
  initial_capital: number;
  final_capital: number;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_return_percent: number;
  net_profit: number;
  max_drawdown_percent: number;
  profit_factor: number | null;
  average_trade: number;
  average_win: number;
  average_loss: number;
  buy_hold_return_percent: number;
  trades: Trade[];
  equity_curve: EquityPoint[];
  disclaimer: string;
  created_at: string;
  data_source: string;
}

export interface StrategyOption {
  value: string;
  label: string;
}

export interface BacktestHistoryRow {
  id: string;
  symbol: string;
  name: string;
  strategy: string;
  total_return_percent: number;
  win_rate: number;
  total_trades: number;
  max_drawdown_percent: number;
  created_at: string;
}

export interface MarketComparisonRow {
  market: string;
  avg_change_percent: number;
  avg_research_score: number;
  gainers: number;
  losers: number;
  count: number;
}

export interface VolumeTrendRow {
  date: string;
  volume: number;
  avg_volume: number;
}

export interface SentimentTrendRow {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

export interface SectorPerformanceRow {
  sector: string;
  avg_change_percent: number;
  count: number;
}

export interface AnalyticsBacktestRow {
  id: string;
  symbol: string;
  strategy: string;
  total_return_percent: number;
  win_rate: number;
  total_trades: number;
  created_at: string;
}

export interface AnalyticsResponse {
  market_comparison: MarketComparisonRow[];
  volume_trend: VolumeTrendRow[];
  sentiment_trend: SentimentTrendRow[];
  sector_performance: SectorPerformanceRow[];
  top_research_scores: AssetSnapshot[];
  recent_backtests: AnalyticsBacktestRow[];
  data_source: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}
