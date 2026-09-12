"""Pydantic v2 request/response models for the TradeLens AI API.

Each model here has a hand-written TypeScript mirror in
`frontend/src/lib/types.ts` -- keep the two in sync.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

Sentiment = Literal["positive", "neutral", "negative"]


class Market(BaseModel):
    code: str
    name: str
    region: str
    currency: str
    asset_count: int


class Asset(BaseModel):
    symbol: str
    name: str
    market: str
    asset_type: str
    sector: str
    currency: str
    data_source: str = "DEMO"


class AssetSnapshot(BaseModel):
    """Common cross-market shape: price, change, volume, indicators, scores."""

    symbol: str
    name: str
    market: str
    asset_type: str
    sector: str
    currency: str
    price: float
    change: float
    change_percent: float
    volume: int
    avg_volume: float
    volume_change_percent: float
    volume_spike: bool
    rsi: Optional[float] = None
    ema21: Optional[float] = None
    ema50: Optional[float] = None
    ema200: Optional[float] = None
    sma50: Optional[float] = None
    above_ema21: bool = False
    above_ema50: bool = False
    above_ema200: bool = False
    ema_status: str = "Unavailable"
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    pb_ratio: Optional[float] = None
    roe: Optional[float] = None
    revenue_growth: Optional[float] = None
    sentiment: Sentiment = "neutral"
    sentiment_score: float = 0.0
    technical_score: float = 0.0
    fundamental_score: float = 0.0
    volume_score: float = 0.0
    news_score: float = 0.0
    research_score: float = 0.0
    market_status: str = "Closed"
    timestamp: datetime
    data_source: str = "DEMO"


class Candle(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
    ema21: Optional[float] = None
    ema50: Optional[float] = None
    ema200: Optional[float] = None
    rsi: Optional[float] = None
    avg_volume: Optional[float] = None


class PriceSeries(BaseModel):
    symbol: str
    name: str
    interval: str = "1D"
    candles: List[Candle]
    data_source: str = "DEMO"


class VolumeBar(BaseModel):
    timestamp: datetime
    close: float
    volume: int
    avg_volume: Optional[float] = None
    volume_ratio: Optional[float] = None
    spike: bool = False


class VolumeSeries(BaseModel):
    symbol: str
    name: str
    latest_volume: int
    average_volume: float
    volume_change_percent: float
    spike_count: int
    bars: List[VolumeBar]
    data_source: str = "DEMO"


class Fundamentals(BaseModel):
    symbol: str
    name: str
    market: str
    available: bool
    note: Optional[str] = None
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    pb_ratio: Optional[float] = None
    eps: Optional[float] = None
    roe: Optional[float] = None
    revenue_growth: Optional[float] = None
    profit_growth: Optional[float] = None
    debt_to_equity: Optional[float] = None
    dividend_yield: Optional[float] = None
    data_source: str = "DEMO"


class NewsItem(BaseModel):
    id: str
    asset_symbol: str
    asset_name: str
    headline: str
    summary: str
    source: str
    published_at: datetime
    category: str
    sentiment: Sentiment
    sentiment_score: float
    url: Optional[str] = None
    data_source: str = "DEMO"


class SentimentSummary(BaseModel):
    positive: float
    neutral: float
    negative: float
    total: int


class NewsResponse(BaseModel):
    items: List[NewsItem]
    summary: SentimentSummary
    data_source: str = "DEMO"


class MarketSession(BaseModel):
    market: str
    exchange: str
    timezone: str
    local_time: str
    local_date: str
    open_time: str
    close_time: str
    is_open: bool
    status: str
    open_utc_hour: float
    close_utc_hour: float


class MarketSessionsResponse(BaseModel):
    reference_utc: datetime
    reference_utc_hour: float
    sessions: List[MarketSession]


class ScoreBreakdown(BaseModel):
    technical_score: float
    fundamental_score: float
    volume_score: float
    news_score: float
    research_score: float
    verdict: str


class DashboardResponse(BaseModel):
    watchlist: List[AssetSnapshot]
    gainers: List[AssetSnapshot]
    losers: List[AssetSnapshot]
    most_active: List[AssetSnapshot]
    trend: PriceSeries
    sentiment: SentimentSummary
    news: List[NewsItem]
    lens: ScoreBreakdown
    data_source: str = "DEMO"


class ScreenerFilter(BaseModel):
    field: str
    operator: Literal["gt", "gte", "lt", "lte", "eq"]
    value: float


class ScreenerRequest(BaseModel):
    markets: List[str] = Field(default_factory=list)
    asset_types: List[str] = Field(default_factory=list)
    sentiments: List[str] = Field(default_factory=list)
    search: Optional[str] = None
    price_above_ema21: bool = False
    price_above_ema50: bool = False
    price_above_ema200: bool = False
    volume_above_average: bool = False
    filters: List[ScreenerFilter] = Field(default_factory=list)
    sort_by: str = "research_score"
    sort_desc: bool = True
    limit: int = 100


class ScreenerResponse(BaseModel):
    count: int
    scanned: int
    results: List[AssetSnapshot]
    data_source: str = "DEMO"


class BacktestRequest(BaseModel):
    symbol: str
    lookback_days: int = Field(default=250, ge=60, le=400)
    initial_capital: float = Field(default=100000, gt=0)
    strategy: Literal["ema_rsi_volume", "ema_crossover", "rsi_reversal"] = "ema_rsi_volume"
    rsi_threshold: float = Field(default=50, ge=1, le=99)
    ema_period: Literal[21, 50, 200] = 21
    require_volume: bool = True
    stop_loss_percent: float = Field(default=2.0, gt=0.1, le=25)
    risk_reward: float = Field(default=2.0, gt=0.2, le=10)
    position_size_percent: float = Field(default=100.0, gt=1, le=100)


class Trade(BaseModel):
    id: int
    entry_date: datetime
    exit_date: datetime
    entry_price: float
    exit_price: float
    quantity: float
    pnl: float
    return_percent: float
    outcome: Literal["win", "loss"]
    exit_reason: str
    bars_held: int


class EquityPoint(BaseModel):
    timestamp: datetime
    equity: float
    buy_and_hold: float


class BacktestResponse(BaseModel):
    id: str
    symbol: str
    name: str
    strategy: str
    entry_rules: List[str]
    exit_rules: List[str]
    initial_capital: float
    final_capital: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_return_percent: float
    net_profit: float
    max_drawdown_percent: float
    profit_factor: Optional[float]
    average_trade: float
    average_win: float
    average_loss: float
    buy_hold_return_percent: float
    trades: List[Trade]
    equity_curve: List[EquityPoint]
    disclaimer: str
    created_at: datetime
    data_source: str = "DEMO"


class AnalyticsResponse(BaseModel):
    market_comparison: List[dict]
    volume_trend: List[dict]
    sentiment_trend: List[dict]
    sector_performance: List[dict]
    top_research_scores: List[AssetSnapshot]
    recent_backtests: List[dict]
    data_source: str = "DEMO"


class LoginRequest(BaseModel):
    email: str
    password: str


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class User(BaseModel):
    id: str
    email: str
    name: str
    role: str = "analyst"
