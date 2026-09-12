"""DEMO DATA generator for TradeLens AI.

Everything produced here is clearly-labelled synthetic data. It is deterministic
(seeded per symbol) so indicators, the screener and the backtester compute real,
repeatable numbers. Swap this module for a real market-data client later --
`seed.py` is the only consumer.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Dict, List

DATA_SOURCE = "DEMO"
HISTORY_DAYS = 400

# symbol, name, market, asset_type, sector, base_price, currency
UNIVERSE: List[tuple] = [
    # --- Indian indices & stocks (NSE) ---
    ("NIFTY50", "NIFTY 50", "NSE", "index", "Index", 24150.0, "INR"),
    ("SENSEX", "BSE SENSEX", "BSE", "index", "Index", 79200.0, "INR"),
    ("BANKNIFTY", "BANK NIFTY", "NSE", "index", "Index", 51800.0, "INR"),
    ("RELIANCE", "Reliance Industries Ltd", "NSE", "stock", "Energy", 2890.0, "INR"),
    ("TCS", "Tata Consultancy Services", "NSE", "stock", "Information Technology", 3950.0, "INR"),
    ("INFY", "Infosys Ltd", "NSE", "stock", "Information Technology", 1610.0, "INR"),
    ("HDFCBANK", "HDFC Bank Ltd", "NSE", "stock", "Financials", 1685.0, "INR"),
    ("ICICIBANK", "ICICI Bank Ltd", "NSE", "stock", "Financials", 1210.0, "INR"),
    ("ITC", "ITC Ltd", "NSE", "stock", "Consumer Staples", 445.0, "INR"),
    ("TATAMOTORS", "Tata Motors Ltd", "NSE", "stock", "Automobile", 985.0, "INR"),
    ("SBIN", "State Bank of India", "NSE", "stock", "Financials", 815.0, "INR"),
    ("SUNPHARMA", "Sun Pharmaceutical Industries", "NSE", "stock", "Healthcare", 1725.0, "INR"),
    ("LT", "Larsen & Toubro Ltd", "NSE", "stock", "Industrials", 3540.0, "INR"),
    ("BHARTIARTL", "Bharti Airtel Ltd", "NSE", "stock", "Telecom", 1480.0, "INR"),
    # --- US indices & stocks ---
    ("NASDAQ", "NASDAQ Composite", "NASDAQ", "index", "Index", 17850.0, "USD"),
    ("SPX", "S&P 500", "NYSE", "index", "Index", 5460.0, "USD"),
    ("AAPL", "Apple Inc.", "NASDAQ", "stock", "Information Technology", 214.0, "USD"),
    ("MSFT", "Microsoft Corporation", "NASDAQ", "stock", "Information Technology", 428.0, "USD"),
    ("NVDA", "NVIDIA Corporation", "NASDAQ", "stock", "Semiconductors", 122.0, "USD"),
    ("GOOGL", "Alphabet Inc. Class A", "NASDAQ", "stock", "Communication Services", 178.0, "USD"),
    ("AMZN", "Amazon.com Inc.", "NASDAQ", "stock", "Consumer Discretionary", 186.0, "USD"),
    ("TSLA", "Tesla Inc.", "NASDAQ", "stock", "Automobile", 248.0, "USD"),
    ("JPM", "JPMorgan Chase & Co.", "NYSE", "stock", "Financials", 205.0, "USD"),
    ("XOM", "Exxon Mobil Corporation", "NYSE", "stock", "Energy", 114.0, "USD"),
    # --- Forex ---
    ("EURUSD", "Euro / US Dollar", "FOREX", "forex", "Currency", 1.0850, "USD"),
    ("GBPUSD", "British Pound / US Dollar", "FOREX", "forex", "Currency", 1.2720, "USD"),
    ("USDJPY", "US Dollar / Japanese Yen", "FOREX", "forex", "Currency", 157.40, "JPY"),
    ("USDINR", "US Dollar / Indian Rupee", "FOREX", "forex", "Currency", 83.45, "INR"),
    # --- Commodities ---
    ("GOLD", "Gold Spot (XAU/USD)", "COMMODITY", "commodity", "Precious Metals", 2340.0, "USD"),
    ("SILVER", "Silver Spot (XAG/USD)", "COMMODITY", "commodity", "Precious Metals", 29.60, "USD"),
    ("CRUDEOIL", "Crude Oil WTI", "COMMODITY", "commodity", "Energy", 81.20, "USD"),
    ("NATGAS", "Natural Gas", "COMMODITY", "commodity", "Energy", 2.68, "USD"),
    # --- Crypto ---
    ("BTC", "Bitcoin", "CRYPTO", "crypto", "Digital Assets", 64800.0, "USD"),
    ("ETH", "Ethereum", "CRYPTO", "crypto", "Digital Assets", 3420.0, "USD"),
    ("SOL", "Solana", "CRYPTO", "crypto", "Digital Assets", 148.0, "USD"),
    ("XRP", "XRP", "CRYPTO", "crypto", "Digital Assets", 0.52, "USD"),
]

MARKETS = [
    {"code": "NSE", "name": "National Stock Exchange of India", "region": "India", "currency": "INR"},
    {"code": "BSE", "name": "Bombay Stock Exchange", "region": "India", "currency": "INR"},
    {"code": "NASDAQ", "name": "NASDAQ", "region": "United States", "currency": "USD"},
    {"code": "NYSE", "name": "New York Stock Exchange", "region": "United States", "currency": "USD"},
    {"code": "FOREX", "name": "Global Foreign Exchange", "region": "Global", "currency": "USD"},
    {"code": "COMMODITY", "name": "Global Commodities", "region": "Global", "currency": "USD"},
    {"code": "CRYPTO", "name": "Crypto Exchanges", "region": "Global", "currency": "USD"},
]

VOLATILITY = {
    "index": 0.008,
    "stock": 0.016,
    "forex": 0.004,
    "commodity": 0.013,
    "crypto": 0.032,
}

BASE_VOLUME = {
    "index": 260_000_000,
    "stock": 8_500_000,
    "forex": 420_000_000,
    "commodity": 32_000_000,
    "crypto": 95_000_000,
}


def _rng(symbol: str, salt: str = "") -> random.Random:
    return random.Random(f"tradelens::{symbol}::{salt}")


def build_assets() -> List[dict]:
    assets = []
    for symbol, name, market, asset_type, sector, base_price, currency in UNIVERSE:
        assets.append(
            {
                "symbol": symbol,
                "name": name,
                "market": market,
                "asset_type": asset_type,
                "sector": sector,
                "currency": currency,
                "base_price": base_price,
                "data_source": DATA_SOURCE,
            }
        )
    return assets


def build_price_history(asset: dict) -> List[dict]:
    """Deterministic daily OHLCV bars, oldest first."""
    rng = _rng(asset["symbol"], "price")
    vol = VOLATILITY[asset["asset_type"]]
    base_vol = BASE_VOLUME[asset["asset_type"]]
    drift = rng.uniform(-0.0004, 0.0009)
    price = asset["base_price"] * rng.uniform(0.72, 0.95)
    start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(
        days=HISTORY_DAYS
    )
    bars: List[dict] = []
    day = 0
    while len(bars) < HISTORY_DAYS:
        ts = start + timedelta(days=day)
        day += 1
        if asset["asset_type"] in ("stock", "index") and ts.weekday() >= 5:
            continue  # equity markets are closed at weekends
        shock = rng.gauss(0, 1) * vol
        cycle = 0.0025 * (rng.random() - 0.5) + 0.0016 * ((len(bars) % 55) / 55 - 0.5)
        ret = drift + shock + cycle
        open_p = price
        close_p = max(open_p * (1 + ret), 0.01)
        high_p = max(open_p, close_p) * (1 + abs(rng.gauss(0, vol / 2)))
        low_p = min(open_p, close_p) * (1 - abs(rng.gauss(0, vol / 2)))
        volume = base_vol * rng.uniform(0.55, 1.5)
        if rng.random() < 0.05:  # occasional volume spike
            volume *= rng.uniform(1.9, 3.4)
        bars.append(
            {
                "symbol": asset["symbol"],
                "timestamp": ts,
                "open": round(open_p, 4),
                "high": round(high_p, 4),
                "low": round(low_p, 4),
                "close": round(close_p, 4),
                "volume": int(volume),
            }
        )
        price = close_p
    return bars


def build_fundamentals(asset: dict) -> dict:
    """Fundamentals only exist for equities; other asset types report None."""
    if asset["asset_type"] != "stock":
        return {
            "symbol": asset["symbol"],
            "available": False,
            "note": "Fundamental data is not applicable to this asset type.",
            "data_source": DATA_SOURCE,
            **{
                k: None
                for k in (
                    "market_cap",
                    "pe_ratio",
                    "pb_ratio",
                    "eps",
                    "roe",
                    "revenue_growth",
                    "profit_growth",
                    "debt_to_equity",
                    "dividend_yield",
                )
            },
        }
    rng = _rng(asset["symbol"], "fundamentals")
    return {
        "symbol": asset["symbol"],
        "available": True,
        "note": None,
        "market_cap": round(rng.uniform(8_000, 2_900_000) * 1_000_000, 0),
        "pe_ratio": round(rng.uniform(9, 62), 2),
        "pb_ratio": round(rng.uniform(0.8, 14.0), 2),
        "eps": round(rng.uniform(2, 190), 2),
        "roe": round(rng.uniform(4, 38), 2),
        "revenue_growth": round(rng.uniform(-6, 34), 2),
        "profit_growth": round(rng.uniform(-12, 45), 2),
        "debt_to_equity": round(rng.uniform(0.05, 2.4), 2),
        "dividend_yield": round(rng.uniform(0.0, 4.2), 2),
        "data_source": DATA_SOURCE,
    }


HEADLINES = [
    ("{name} posts steady quarterly revenue, margins hold firm", "earnings", "positive"),
    ("Analysts revise {name} outlook after sector rotation", "analysis", "neutral"),
    ("{name} volumes climb as institutional interest picks up", "markets", "positive"),
    ("Cost pressure weighs on {name} operating performance", "earnings", "negative"),
    ("{name} announces capacity expansion plan", "corporate", "positive"),
    ("Regulatory review adds uncertainty for {name}", "policy", "negative"),
    ("{name} trades flat as broader indices consolidate", "markets", "neutral"),
    ("Brokerages stay constructive on {name} medium-term story", "analysis", "positive"),
    ("{name} slips on profit booking after recent rally", "markets", "negative"),
    ("Global cues keep {name} range-bound this week", "macro", "neutral"),
]

SOURCES = ["TradeLens Wire", "Market Desk Daily", "Global Macro Review", "Sector Watch", "Exchange Filings"]


def build_news(assets: List[dict], per_asset: int = 3) -> List[dict]:
    news: List[dict] = []
    now = datetime.now(timezone.utc)
    for asset in assets:
        rng = _rng(asset["symbol"], "news")
        picks = rng.sample(HEADLINES, k=min(per_asset, len(HEADLINES)))
        for i, (template, category, sentiment) in enumerate(picks):
            news.append(
                {
                    "asset_symbol": asset["symbol"],
                    "headline": template.format(name=asset["name"]),
                    "summary": (
                        f"DEMO DATA: sample research note generated for {asset['name']} "
                        f"({asset['market']}) to demonstrate the news and sentiment pipeline."
                    ),
                    "source": rng.choice(SOURCES),
                    "published_at": now - timedelta(hours=rng.randint(1, 96) + i * 5),
                    "category": category,
                    "sentiment": sentiment,
                    "sentiment_score": {"positive": 0.62, "neutral": 0.02, "negative": -0.58}[sentiment]
                    + rng.uniform(-0.12, 0.12),
                    "url": None,
                    "data_source": DATA_SOURCE,
                }
            )
    return news


def market_session_defs() -> List[Dict]:
    return [
        {"market": "India", "exchange": "NSE / BSE", "timezone": "Asia/Kolkata", "open": "09:15", "close": "15:30"},
        {"market": "London", "exchange": "LSE", "timezone": "Europe/London", "open": "08:00", "close": "16:30"},
        {"market": "New York", "exchange": "NYSE / NASDAQ", "timezone": "America/New_York", "open": "09:30", "close": "16:00"},
        {"market": "Tokyo", "exchange": "JPX", "timezone": "Asia/Tokyo", "open": "09:00", "close": "15:00"},
    ]
