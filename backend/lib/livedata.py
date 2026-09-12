"""LIVE data fetcher for TradeLens AI.

Replaces backend/lib/demodata.py as the data source. Pulls real quotes, daily
OHLCV history from Twelve Data (twelvedata.com, free tier: 800 calls/day, 8
calls/min), fundamentals from Financial Modeling Prep for US stocks (free
tier: 250 calls/day, US-listed only) with a Twelve Data fallback attempt,
and finance news from Marketaux (marketaux.com, free tier). All three need a
free API key — see README / LOCAL_SETUP for signup steps.

Design notes:
- This module keeps the same UNIVERSE list and asset/bar/fundamental/news
  *shapes* as demodata.py so store.py, the routers and the frontend never
  need to change — only seed.py's import + call changes.
- Free tiers are rate-limited, so this fetches once per run (a periodic
  refresh job, e.g. the GitHub Actions workflow in
  .github/workflows/daily-refresh.yml, re-runs seed.py to refresh). It is
  NOT called per-request.
- Every network call is wrapped so a single failed/rate-limited symbol
  doesn't kill the whole seed — it's skipped and logged, and DEMO fallback
  data is used for that symbol so the app never shows a broken page.
- build_all() returns a per-symbol LIVE/DEMO flag so seed.py can print a
  summary table — a bad symbol mapping or exhausted quota is then visible
  immediately in the seed output instead of silently showing wrong numbers.
- Index tickers are resolved via Twelve Data's own symbol_search endpoint
  (not hardcoded) since ticker conventions vary by provider and guessing
  wrong silently falls back to demo data with no error.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import httpx

from lib.demodata import (
    UNIVERSE,
    build_assets as _demo_build_assets,
    build_fundamentals as _demo_build_fundamentals,
    build_news as _demo_build_news,
    build_price_history as _demo_build_price_history,
)

logger = logging.getLogger(__name__)

DATA_SOURCE = "LIVE"

TWELVE_DATA_API_KEY = os.environ.get("TWELVE_DATA_API_KEY", "").strip()
MARKETAUX_API_KEY = os.environ.get("MARKETAUX_API_KEY", "").strip()
FMP_API_KEY = os.environ.get("FMP_API_KEY", "").strip()

TWELVE_DATA_BASE = "https://api.twelvedata.com"
MARKETAUX_BASE = "https://api.marketaux.com/v1"
FMP_BASE = "https://financialmodelingprep.com/stable"

HISTORY_DAYS = 400

# Twelve Data needs an exchange suffix for NSE/BSE symbols; everything else
# (US tickers, forex pairs, crypto, commodities) uses the plain TradeLens
# symbol or a small remap below.
#
# Indices are NOT hardcoded here — index ticker conventions vary by provider
# (e.g. "NSEI" vs "^NSEI" vs "NIFTY 50") and guessing wrong silently falls
# back to demo data with no error, which is exactly what happened before.
# _resolve_index_symbol() below asks Twelve Data's own symbol_search
# endpoint for the correct ticker instead, once per run, and caches it.
_TWELVE_DATA_SYMBOL_OVERRIDES = {
    "GOLD": "XAU/USD",
    "SILVER": "XAG/USD",
    "CRUDEOIL": "WTI/USD",
    "NATGAS": "NATGAS",
    "BTC": "BTC/USD",
    "ETH": "ETH/USD",
    "SOL": "SOL/USD",
    "XRP": "XRP/USD",
    "EURUSD": "EUR/USD",
    "GBPUSD": "GBP/USD",
    "USDJPY": "USD/JPY",
    "USDINR": "USD/INR",
}
_NSE_SYMBOLS = {"RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "ITC", "TATAMOTORS", "SBIN", "SUNPHARMA", "LT", "BHARTIARTL"}

# Search terms used to look up each index's real ticker via symbol_search,
# since the TradeLens symbol itself ("NIFTY50") is never a valid API symbol.
_INDEX_SEARCH_TERMS = {
    "NIFTY50": "NIFTY 50",
    "SENSEX": "SENSEX",
    "BANKNIFTY": "NIFTY BANK",
    "NASDAQ": "NASDAQ Composite",
    "SPX": "S&P 500",
}
_index_symbol_cache: Dict[str, Optional[str]] = {}


def build_assets() -> List[dict]:
    """Asset metadata is static reference data (name/market/sector) — reuse it
    as-is from demodata.py, just relabel the source."""
    assets = _demo_build_assets()
    for a in assets:
        a["data_source"] = DATA_SOURCE
    return assets


async def _get_json(client: httpx.AsyncClient, url: str, params: dict, retries: int = 2) -> Optional[dict]:
    for attempt in range(retries + 1):
        try:
            resp = await client.get(url, params=params, timeout=15)
            data = resp.json()
            if isinstance(data, dict) and data.get("status") == "error":
                logger.warning("API error for %s: %s", params.get("symbol"), data.get("message"))
                return None
            return data
        except (httpx.HTTPError, ValueError) as exc:
            logger.warning("Request failed (attempt %s) for %s: %s", attempt + 1, params.get("symbol"), exc)
            await asyncio.sleep(1.5 * (attempt + 1))
    return None


async def _resolve_index_symbol(client: httpx.AsyncClient, tradelens_symbol: str) -> Optional[str]:
    """Look up the real ticker Twelve Data expects for an index, via their
    own symbol_search endpoint, instead of a hardcoded guess. Cached for the
    lifetime of one seed run so each index is only looked up once."""
    if tradelens_symbol in _index_symbol_cache:
        return _index_symbol_cache[tradelens_symbol]

    query = _INDEX_SEARCH_TERMS.get(tradelens_symbol, tradelens_symbol)
    data = await _get_json(
        client,
        f"{TWELVE_DATA_BASE}/symbol_search",
        {"symbol": query, "apikey": TWELVE_DATA_API_KEY, "outputsize": 5},
    )
    candidates = (data or {}).get("data") or []
    resolved = None
    for c in candidates:
        if c.get("instrument_type") == "Index":
            resolved = c.get("symbol")
            break
    if not resolved and candidates:
        resolved = candidates[0].get("symbol")

    if not resolved:
        logger.warning("symbol_search found no match for index %s (query %r)", tradelens_symbol, query)
    _index_symbol_cache[tradelens_symbol] = resolved
    return resolved


async def _twelve_data_symbol(client: httpx.AsyncClient, symbol: str, market: str, asset_type: str) -> Optional[str]:
    if asset_type == "index":
        return await _resolve_index_symbol(client, symbol)
    if symbol in _TWELVE_DATA_SYMBOL_OVERRIDES:
        return _TWELVE_DATA_SYMBOL_OVERRIDES[symbol]
    if symbol in _NSE_SYMBOLS or market == "NSE":
        return f"{symbol}:NSE"
    return symbol


async def fetch_price_history(client: httpx.AsyncClient, asset: dict) -> tuple[List[dict], bool]:
    """Daily OHLCV bars from Twelve Data, oldest first. Falls back to
    deterministic demo bars if the API key is missing or the call fails,
    so the app degrades gracefully instead of breaking.
    Returns (bars, is_live) so callers can report per-symbol status."""
    if not TWELVE_DATA_API_KEY:
        return _demo_build_price_history(asset), False

    td_symbol = await _twelve_data_symbol(client, asset["symbol"], asset["market"], asset["asset_type"])
    if not td_symbol:
        return _demo_build_price_history(asset), False

    data = await _get_json(
        client,
        f"{TWELVE_DATA_BASE}/time_series",
        {
            "symbol": td_symbol,
            "interval": "1day",
            "outputsize": HISTORY_DAYS,
            "apikey": TWELVE_DATA_API_KEY,
        },
    )
    values = (data or {}).get("values")
    if not values:
        logger.warning("No live price data for %s (%s) — using demo fallback", asset["symbol"], td_symbol)
        return _demo_build_price_history(asset), False

    bars = []
    for v in reversed(values):  # Twelve Data returns newest first
        try:
            bars.append(
                {
                    "symbol": asset["symbol"],
                    "timestamp": datetime.strptime(v["datetime"], "%Y-%m-%d").replace(tzinfo=timezone.utc),
                    "open": round(float(v["open"]), 4),
                    "high": round(float(v["high"]), 4),
                    "low": round(float(v["low"]), 4),
                    "close": round(float(v["close"]), 4),
                    "volume": int(float(v.get("volume") or 0)),
                }
            )
        except (KeyError, ValueError):
            continue
    if len(bars) < 2:
        return _demo_build_price_history(asset), False
    return bars, True


_US_MARKETS = {"NASDAQ", "NYSE"}


async def _fetch_fundamentals_fmp(client: httpx.AsyncClient, asset: dict) -> Optional[dict]:
    """Financial Modeling Prep free tier (250 calls/day) covers US-listed
    companies only, so this is only attempted for NASDAQ/NYSE symbols.
    Two lightweight calls per stock: key-metrics + ratios (both 'stable'
    endpoints, TTM snapshot, no history)."""
    if not FMP_API_KEY or asset["market"] not in _US_MARKETS:
        return None

    symbol = asset["symbol"]
    metrics_data = await _get_json(
        client, f"{FMP_BASE}/key-metrics-ttm", {"symbol": symbol, "apikey": FMP_API_KEY}
    )
    ratios_data = await _get_json(
        client, f"{FMP_BASE}/ratios-ttm", {"symbol": symbol, "apikey": FMP_API_KEY}
    )
    metrics = (metrics_data or [{}])[0] if isinstance(metrics_data, list) and metrics_data else {}
    ratios = (ratios_data or [{}])[0] if isinstance(ratios_data, list) and ratios_data else {}
    if not metrics and not ratios:
        return None

    def _num(v):
        try:
            return float(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    market_cap = _num(metrics.get("marketCap"))
    pe_ratio = _num(ratios.get("priceToEarningsRatioTTM"))
    pb_ratio = _num(ratios.get("priceToBookRatioTTM"))
    eps = _num(metrics.get("netIncomePerShareTTM"))
    roe = _num(ratios.get("returnOnEquityTTM"))
    revenue_growth = None
    debt_to_equity = _num(ratios.get("debtToEquityRatioTTM"))
    dividend_yield = _num(ratios.get("dividendYieldTTM"))

    if market_cap is None and pe_ratio is None:
        return None

    return {
        "symbol": symbol,
        "available": True,
        "note": None,
        "market_cap": market_cap,
        "pe_ratio": pe_ratio,
        "pb_ratio": pb_ratio,
        "eps": eps,
        "roe": roe * 100 if roe is not None else None,
        "revenue_growth": revenue_growth,
        "profit_growth": None,
        "debt_to_equity": debt_to_equity,
        "dividend_yield": dividend_yield * 100 if dividend_yield is not None else None,
        "data_source": DATA_SOURCE,
    }


async def fetch_fundamentals(client: httpx.AsyncClient, asset: dict) -> dict:
    """Company fundamentals, real where a free tier actually covers the
    symbol, demo fallback otherwise. Only meaningful for stocks; other
    asset types report unavailable, same as the demo build."""
    if asset["asset_type"] != "stock":
        return _demo_build_fundamentals(asset)

    fmp_result = await _fetch_fundamentals_fmp(client, asset)
    if fmp_result:
        return fmp_result

    if not TWELVE_DATA_API_KEY or asset["market"] not in _US_MARKETS:
        return _demo_build_fundamentals(asset)

    td_symbol = await _twelve_data_symbol(client, asset["symbol"], asset["market"], asset["asset_type"])
    if not td_symbol:
        return _demo_build_fundamentals(asset)
    data = await _get_json(
        client,
        f"{TWELVE_DATA_BASE}/statistics",
        {"symbol": td_symbol, "apikey": TWELVE_DATA_API_KEY},
    )
    stats = ((data or {}).get("statistics") or {})
    valuation = stats.get("valuations_metrics", {}) or {}
    financials = stats.get("financials", {}) or {}
    stock_stats = stats.get("stock_statistics", {}) or {}

    def _num(v):
        try:
            return float(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    market_cap = _num(valuation.get("market_capitalization"))
    pe_ratio = _num(valuation.get("trailing_pe"))
    pb_ratio = _num(valuation.get("price_to_book_mrq"))
    eps = _num(financials.get("income_statement", {}).get("diluted_eps_ttm") if isinstance(financials.get("income_statement"), dict) else None)
    roe = _num(financials.get("return_on_equity_ttm"))
    revenue_growth = _num(financials.get("revenue_growth"))
    debt_to_equity = _num(financials.get("total_debt_to_equity_mrq") if isinstance(financials, dict) else None)
    dividend_yield = _num(stock_stats.get("dividend_yield")) or _num(valuation.get("forward_annual_dividend_yield"))

    if market_cap is None and pe_ratio is None:
        return _demo_build_fundamentals(asset)

    return {
        "symbol": asset["symbol"],
        "available": True,
        "note": None,
        "market_cap": market_cap,
        "pe_ratio": pe_ratio,
        "pb_ratio": pb_ratio,
        "eps": eps,
        "roe": roe,
        "revenue_growth": revenue_growth,
        "profit_growth": None,
        "debt_to_equity": debt_to_equity,
        "dividend_yield": dividend_yield,
        "data_source": DATA_SOURCE,
    }


async def fetch_news(client: httpx.AsyncClient, assets: List[dict], per_asset: int = 3) -> List[dict]:
    """Finance news + sentiment from Marketaux, filtered per symbol.
    Falls back to demo news (clearly labelled) when no key is set or a
    request fails, so the News page never renders empty."""
    if not MARKETAUX_API_KEY:
        return _demo_build_news(assets, per_asset=per_asset)

    news: List[dict] = []
    stock_assets = [a for a in assets if a["asset_type"] == "stock"]
    for asset in stock_assets:
        data = await _get_json(
            client,
            f"{MARKETAUX_BASE}/news/all",
            {
                "symbols": asset["symbol"],
                "filter_entities": "true",
                "language": "en",
                "limit": per_asset,
                "api_token": MARKETAUX_API_KEY,
            },
        )
        items = (data or {}).get("data") or []
        for item in items:
            try:
                score = float(item.get("entities", [{}])[0].get("sentiment_score", 0.0))
            except (IndexError, TypeError, ValueError):
                score = 0.0
            label = "positive" if score > 0.15 else "negative" if score < -0.15 else "neutral"
            news.append(
                {
                    "asset_symbol": asset["symbol"],
                    "headline": item.get("title", ""),
                    "summary": (item.get("description") or "")[:400],
                    "source": item.get("source", "Marketaux"),
                    "published_at": _parse_dt(item.get("published_at")),
                    "category": "markets",
                    "sentiment": label,
                    "sentiment_score": round(score, 3),
                    "url": item.get("url"),
                    "data_source": DATA_SOURCE,
                }
            )
        await asyncio.sleep(0.3)

    if not news:
        logger.warning("No live news fetched — using demo fallback for News page")
        return _demo_build_news(assets, per_asset=per_asset)
    return news


def _parse_dt(value: Optional[str]) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)


async def build_all(assets: List[dict]) -> tuple[Dict[str, List[dict]], List[dict], List[dict], Dict[str, bool]]:
    """Fetch price history + fundamentals for every asset (rate-limit aware,
    small delay between calls) and news once for the whole universe.
    Returns (prices_by_symbol, fundamentals, news, price_is_live)."""
    prices: Dict[str, List[dict]] = {}
    fundamentals: List[dict] = []
    price_is_live: Dict[str, bool] = {}

    async with httpx.AsyncClient() as client:
        for asset in assets:
            bars, is_live = await fetch_price_history(client, asset)
            prices[asset["symbol"]] = bars
            price_is_live[asset["symbol"]] = is_live
            fundamentals.append(await fetch_fundamentals(client, asset))
            if TWELVE_DATA_API_KEY:
                await asyncio.sleep(0.8)

        news = await fetch_news(client, assets)

    return prices, fundamentals, news, price_is_live