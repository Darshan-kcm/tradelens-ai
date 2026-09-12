"""Yahoo Finance (via yfinance) fetcher for symbols Twelve Data's free tier
can't cover: Indian NSE/BSE stocks and every index (NIFTY 50, SENSEX, BANK
NIFTY, NASDAQ Composite, S&P 500).

Confirmed directly against Twelve Data's own API responses during
development: the Basic (free) plan explicitly excludes Indian exchanges
("available starting with the Grow or Venture plan") and has no genuine
Index-type instrument for any of the above (only ETF/mutual-fund proxies,
several of which are themselves paid-plan-gated). Yahoo Finance has no
official API, but yfinance is a widely used, actively maintained library
that covers NSE/BSE and global indices with no API key and no daily quota —
the trade-off is it scrapes Yahoo's internal endpoints rather than calling a
documented contract, so treat failures as expected/recoverable, same as
every other source in this file, and never let one broken symbol propagate.

Ticker convention: NSE stocks get a ".NS" suffix, BSE a ".BO" suffix;
indices use Yahoo's "^"-prefixed tickers (e.g. "^NSEI" for NIFTY 50).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import timezone
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

DATA_SOURCE = "LIVE"

_YAHOO_INDEX_TICKERS = {
    "NIFTY50": "^NSEI",
    "SENSEX": "^BSESN",
    "BANKNIFTY": "^NSEBANK",
    "NASDAQ": "^IXIC",
    "SPX": "^GSPC",
}


def _yahoo_symbol(asset: dict) -> Optional[str]:
    symbol, asset_type, market = asset["symbol"], asset["asset_type"], asset["market"]
    if asset_type == "index":
        return _YAHOO_INDEX_TICKERS.get(symbol)
    if asset_type == "stock" and market == "NSE":
        return f"{symbol}.NS"
    if asset_type == "stock" and market == "BSE":
        return f"{symbol}.BO"
    return None


def covers(asset: dict) -> bool:
    """Whether this module is responsible for fetching this asset at all."""
    return _yahoo_symbol(asset) is not None


def _fetch_history_sync(yahoo_symbol: str, days: int):
    import yfinance as yf

    ticker = yf.Ticker(yahoo_symbol)
    return ticker.history(period=f"{days}d", interval="1d", auto_adjust=False)


async def fetch_price_history(asset: dict, days: int) -> tuple[List[dict], bool]:
    """Daily OHLCV bars from Yahoo Finance via yfinance.
    Returns (bars, is_live); caller falls back to demo data on failure."""
    yahoo_symbol = _yahoo_symbol(asset)
    if not yahoo_symbol:
        return [], False

    try:
        df = await asyncio.to_thread(_fetch_history_sync, yahoo_symbol, days)
    except Exception as exc:
        logger.warning("yfinance request failed for %s (%s): %s", asset["symbol"], yahoo_symbol, exc)
        return [], False

    if df is None or df.empty:
        logger.warning("No live price data for %s (%s) via yfinance — using demo fallback", asset["symbol"], yahoo_symbol)
        return [], False

    bars = []
    for ts, row in df.iterrows():
        try:
            bars.append(
                {
                    "symbol": asset["symbol"],
                    "timestamp": ts.to_pydatetime().astimezone(timezone.utc) if ts.tzinfo else ts.to_pydatetime().replace(tzinfo=timezone.utc),
                    "open": round(float(row["Open"]), 4),
                    "high": round(float(row["High"]), 4),
                    "low": round(float(row["Low"]), 4),
                    "close": round(float(row["Close"]), 4),
                    "volume": int(row["Volume"]) if row["Volume"] == row["Volume"] else 0,
                }
            )
        except (KeyError, ValueError, TypeError):
            continue

    if len(bars) < 2:
        return [], False
    return bars, True