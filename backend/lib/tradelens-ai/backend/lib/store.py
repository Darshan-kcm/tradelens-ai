"""Data-access + analytics service layer.

Reads the seeded demo data out of MongoDB, computes technical indicators and the
composite "Research Score", and caches the resulting snapshots in memory (the
demo dataset is static, so one load per process is enough).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from lib.analytics import (
    calculate_average_volume,
    calculate_ema_series,
    calculate_rsi_series,
    calculate_sma,
    round_or_none,
)
from lib.db import db

_cache: Dict[str, object] = {}


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def load_assets() -> List[dict]:
    if "assets" not in _cache:
        docs = await db.assets.find({}, {"_id": 0}).to_list(500)
        _cache["assets"] = docs
    return _cache["assets"]  # type: ignore[return-value]


async def get_asset(symbol: str) -> Optional[dict]:
    for asset in await load_assets():
        if asset["symbol"] == symbol.upper():
            return asset
    return None


async def load_prices(symbol: str) -> List[dict]:
    key = f"prices::{symbol.upper()}"
    if key not in _cache:
        docs = await db.price_data.find({"symbol": symbol.upper()}, {"_id": 0}).sort("timestamp", 1).to_list(1000)
        for d in docs:
            d["timestamp"] = _aware(d["timestamp"])
        _cache[key] = docs
    return _cache[key]  # type: ignore[return-value]


async def load_fundamentals() -> Dict[str, dict]:
    if "fundamentals" not in _cache:
        docs = await db.fundamentals.find({}, {"_id": 0}).to_list(500)
        _cache["fundamentals"] = {d["symbol"]: d for d in docs}
    return _cache["fundamentals"]  # type: ignore[return-value]


async def load_news() -> List[dict]:
    if "news" not in _cache:
        docs = await db.news.find({}, {"_id": 0}).sort("published_at", -1).to_list(1000)
        for d in docs:
            d["published_at"] = _aware(d["published_at"])
        _cache["news"] = docs
    return _cache["news"]  # type: ignore[return-value]


def indicator_series(bars: List[dict]) -> dict:
    closes = [b["close"] for b in bars]
    volumes = [float(b["volume"]) for b in bars]
    return {
        "closes": closes,
        "volumes": volumes,
        "ema21": calculate_ema_series(closes, 21),
        "ema50": calculate_ema_series(closes, 50),
        "ema200": calculate_ema_series(closes, 200),
        "rsi": calculate_rsi_series(closes, 14),
        "avg_volume": [
            calculate_average_volume(volumes[max(0, i - 19) : i + 1], 20) if i >= 4 else None
            for i in range(len(volumes))
        ],
    }


def _clamp(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 1)


def _news_sentiment_for(symbol: str, news: List[dict]) -> tuple:
    items = [n for n in news if n["asset_symbol"] == symbol]
    if not items:
        return "neutral", 0.0
    avg = sum(n["sentiment_score"] for n in items) / len(items)
    label = "positive" if avg > 0.15 else "negative" if avg < -0.15 else "neutral"
    return label, round(avg, 3)


MARKET_HOURS = {
    "NSE": ("Asia/Kolkata", 9.25, 15.5, (0, 4)),
    "BSE": ("Asia/Kolkata", 9.25, 15.5, (0, 4)),
    "NASDAQ": ("America/New_York", 9.5, 16.0, (0, 4)),
    "NYSE": ("America/New_York", 9.5, 16.0, (0, 4)),
}


def market_status(market: str) -> str:
    from zoneinfo import ZoneInfo

    cfg = MARKET_HOURS.get(market)
    if cfg is None:
        return "Open 24x5" if market == "FOREX" else "Open 24x7" if market == "CRYPTO" else "Open"
    tzname, open_h, close_h, days = cfg
    now = datetime.now(ZoneInfo(tzname))
    hour = now.hour + now.minute / 60
    if days[0] <= now.weekday() <= days[1] and open_h <= hour < close_h:
        return "Open"
    return "Closed"


def build_snapshot(asset: dict, bars: List[dict], fundamental: Optional[dict], news: List[dict]) -> dict:
    if len(bars) < 2:
        raise ValueError(f"not enough price history for {asset['symbol']}")
    ser = indicator_series(bars)
    last, prev = bars[-1], bars[-2]
    price = last["close"]
    change = price - prev["close"]
    change_percent = (change / prev["close"] * 100) if prev["close"] else 0.0
    volume = int(last["volume"])
    avg_volume = calculate_average_volume(ser["volumes"][-20:], 20) or float(volume)
    volume_change = (volume - avg_volume) / avg_volume * 100 if avg_volume else 0.0

    ema21, ema50, ema200 = ser["ema21"][-1], ser["ema50"][-1], ser["ema200"][-1]
    rsi = ser["rsi"][-1]
    sma50 = calculate_sma(ser["closes"], 50)
    above21 = bool(ema21 and price > ema21)
    above50 = bool(ema50 and price > ema50)
    above200 = bool(ema200 and price > ema200)
    if ema21 is None:
        ema_status = "Unavailable"
    elif above21 and above50 and above200:
        ema_status = "Above all EMAs"
    elif above21:
        ema_status = "Above 21 EMA"
    elif not above21 and not above50 and not above200:
        ema_status = "Below all EMAs"
    else:
        ema_status = "Mixed"

    # --- Research Score components (0-100). Descriptive, NOT a prediction. ---
    tech = 50.0
    if rsi is not None:
        tech += (rsi - 50) * 0.55
    tech += 9 if above21 else -9
    tech += 7 if above50 else -7
    tech += 6 if above200 else -6
    technical_score = _clamp(tech)

    if fundamental and fundamental.get("available"):
        f = 50.0
        f += min((fundamental["roe"] or 0) - 15, 20) * 1.1
        f += min((fundamental["revenue_growth"] or 0) - 8, 20) * 0.8
        pe = fundamental.get("pe_ratio") or 30
        f += (30 - min(pe, 70)) * 0.5
        f -= max((fundamental.get("debt_to_equity") or 0) - 1, 0) * 6
        fundamental_score = _clamp(f)
    else:
        fundamental_score = 50.0

    volume_score = _clamp(50 + max(min(volume_change, 120), -60) * 0.42)
    sentiment_label, sentiment_value = _news_sentiment_for(asset["symbol"], news)
    news_score = _clamp(50 + sentiment_value * 50)

    weights = (0.35, 0.25, 0.2, 0.2) if (fundamental and fundamental.get("available")) else (0.45, 0.0, 0.3, 0.25)
    research_score = _clamp(
        technical_score * weights[0]
        + fundamental_score * weights[1]
        + volume_score * weights[2]
        + news_score * weights[3]
    )

    return {
        "symbol": asset["symbol"],
        "name": asset["name"],
        "market": asset["market"],
        "asset_type": asset["asset_type"],
        "sector": asset["sector"],
        "currency": asset["currency"],
        "price": round(price, 4),
        "change": round(change, 4),
        "change_percent": round(change_percent, 2),
        "volume": volume,
        "avg_volume": round(avg_volume, 0),
        "volume_change_percent": round(volume_change, 2),
        "volume_spike": volume_change >= 35,
        "rsi": round_or_none(rsi, 2),
        "ema21": round_or_none(ema21, 4),
        "ema50": round_or_none(ema50, 4),
        "ema200": round_or_none(ema200, 4),
        "sma50": round_or_none(sma50, 4),
        "above_ema21": above21,
        "above_ema50": above50,
        "above_ema200": above200,
        "ema_status": ema_status,
        "market_cap": (fundamental or {}).get("market_cap"),
        "pe_ratio": (fundamental or {}).get("pe_ratio"),
        "pb_ratio": (fundamental or {}).get("pb_ratio"),
        "roe": (fundamental or {}).get("roe"),
        "revenue_growth": (fundamental or {}).get("revenue_growth"),
        "sentiment": sentiment_label,
        "sentiment_score": sentiment_value,
        "technical_score": technical_score,
        "fundamental_score": fundamental_score,
        "volume_score": volume_score,
        "news_score": news_score,
        "research_score": research_score,
        "market_status": market_status(asset["market"]),
        "timestamp": last["timestamp"],
        "data_source": asset.get("data_source", "DEMO"),
    }


async def all_snapshots() -> List[dict]:
    """Snapshot for every asset in the universe (cached per process)."""
    if "snapshots" in _cache:
        return _cache["snapshots"]  # type: ignore[return-value]
    assets = await load_assets()
    fundamentals = await load_fundamentals()
    news = await load_news()
    snaps = []
    for asset in assets:
        bars = await load_prices(asset["symbol"])
        if len(bars) < 2:
            continue
        snaps.append(build_snapshot(asset, bars, fundamentals.get(asset["symbol"]), news))
    _cache["snapshots"] = snaps
    return snaps


async def snapshot_for(symbol: str) -> Optional[dict]:
    for snap in await all_snapshots():
        if snap["symbol"] == symbol.upper():
            return snap
    return None


def sentiment_summary(items: List[dict]) -> dict:
    total = len(items)
    if total == 0:
        return {"positive": 0.0, "neutral": 0.0, "negative": 0.0, "total": 0}
    counts = {"positive": 0, "neutral": 0, "negative": 0}
    for i in items:
        counts[i["sentiment"]] += 1
    return {
        "positive": round(counts["positive"] / total * 100, 1),
        "neutral": round(counts["neutral"] / total * 100, 1),
        "negative": round(counts["negative"] / total * 100, 1),
        "total": total,
    }


def invalidate_cache() -> None:
    _cache.clear()
