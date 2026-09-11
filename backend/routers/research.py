"""News & sentiment, fundamentals, screener, dashboard and analytics endpoints."""
from __future__ import annotations

from collections import defaultdict
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from models.schemas import (
    AnalyticsResponse,
    AssetSnapshot,
    DashboardResponse,
    Fundamentals,
    NewsItem,
    NewsResponse,
    PriceSeries,
    ScoreBreakdown,
    ScreenerRequest,
    ScreenerResponse,
    SentimentSummary,
)

from lib import store
from lib.db import db
from routers.market import get_price

router = APIRouter(tags=["research"])

WATCHLIST = ["NIFTY50", "SENSEX", "NASDAQ", "SPX", "GOLD", "CRUDEOIL", "BTC", "EURUSD"]

SCREENER_FIELDS = {
    "price",
    "change_percent",
    "volume",
    "avg_volume",
    "volume_change_percent",
    "rsi",
    "market_cap",
    "pe_ratio",
    "pb_ratio",
    "roe",
    "revenue_growth",
    "research_score",
    "technical_score",
    "fundamental_score",
    "volume_score",
    "news_score",
}

OPS = {
    "gt": lambda a, b: a > b,
    "gte": lambda a, b: a >= b,
    "lt": lambda a, b: a < b,
    "lte": lambda a, b: a <= b,
    "eq": lambda a, b: abs(a - b) < 1e-9,
}


async def _news_items(symbol: Optional[str] = None, sentiment: Optional[str] = None, limit: int = 60) -> List[dict]:
    news = await store.load_news()
    assets = {a["symbol"]: a["name"] for a in await store.load_assets()}
    items = news
    if symbol and symbol.lower() != "all":
        items = [n for n in items if n["asset_symbol"].lower() == symbol.lower()]
    if sentiment and sentiment.lower() != "all":
        items = [n for n in items if n["sentiment"] == sentiment.lower()]
    return [
        {
            **n,
            "asset_name": assets.get(n["asset_symbol"], n["asset_symbol"]),
            "sentiment_score": round(n["sentiment_score"], 3),
        }
        for n in items[:limit]
    ]


@router.get("/news", response_model=NewsResponse)
async def get_news(
    symbol: Optional[str] = Query(default=None),
    sentiment: Optional[str] = Query(default=None),
    limit: int = Query(default=60, ge=1, le=200),
):
    items = await _news_items(symbol, sentiment, limit)
    return NewsResponse(
        items=[NewsItem(**i) for i in items],
        summary=SentimentSummary(**store.sentiment_summary(items)),
    )


@router.get("/fundamentals", response_model=List[Fundamentals])
async def list_fundamentals(
    min_roe: Optional[float] = None,
    min_revenue_growth: Optional[float] = None,
    max_pe: Optional[float] = None,
    only_available: bool = False,
):
    fundamentals = await store.load_fundamentals()
    assets = await store.load_assets()
    out: List[Fundamentals] = []
    for asset in assets:
        f = fundamentals.get(asset["symbol"], {})
        if only_available and not f.get("available"):
            continue
        if f.get("available"):
            if min_roe is not None and (f.get("roe") or 0) < min_roe:
                continue
            if min_revenue_growth is not None and (f.get("revenue_growth") or 0) < min_revenue_growth:
                continue
            if max_pe is not None and (f.get("pe_ratio") or 1e9) > max_pe:
                continue
        elif min_roe is not None or min_revenue_growth is not None or max_pe is not None:
            continue
        out.append(
            Fundamentals(
                symbol=asset["symbol"],
                name=asset["name"],
                market=asset["market"],
                available=bool(f.get("available")),
                note=f.get("note"),
                market_cap=f.get("market_cap"),
                pe_ratio=f.get("pe_ratio"),
                pb_ratio=f.get("pb_ratio"),
                eps=f.get("eps"),
                roe=f.get("roe"),
                revenue_growth=f.get("revenue_growth"),
                profit_growth=f.get("profit_growth"),
                debt_to_equity=f.get("debt_to_equity"),
                dividend_yield=f.get("dividend_yield"),
            )
        )
    return out


@router.get("/fundamentals/{symbol}", response_model=Fundamentals)
async def get_fundamentals(symbol: str):
    asset = await store.get_asset(symbol)
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{symbol}' not found")
    f = (await store.load_fundamentals()).get(asset["symbol"], {})
    return Fundamentals(
        symbol=asset["symbol"],
        name=asset["name"],
        market=asset["market"],
        available=bool(f.get("available")),
        note=f.get("note") or ("Fundamental data unavailable for this asset." if not f else None),
        market_cap=f.get("market_cap"),
        pe_ratio=f.get("pe_ratio"),
        pb_ratio=f.get("pb_ratio"),
        eps=f.get("eps"),
        roe=f.get("roe"),
        revenue_growth=f.get("revenue_growth"),
        profit_growth=f.get("profit_growth"),
        debt_to_equity=f.get("debt_to_equity"),
        dividend_yield=f.get("dividend_yield"),
    )


@router.post("/screener", response_model=ScreenerResponse)
async def run_screener(req: ScreenerRequest):
    snaps = await store.all_snapshots()
    scanned = len(snaps)

    for f in req.filters:
        if f.field not in SCREENER_FIELDS:
            raise HTTPException(status_code=422, detail=f"Unsupported screener field '{f.field}'")

    def keep(s: dict) -> bool:
        if req.markets and s["market"] not in req.markets:
            return False
        if req.asset_types and s["asset_type"] not in req.asset_types:
            return False
        if req.sentiments and s["sentiment"] not in req.sentiments:
            return False
        if req.search:
            q = req.search.strip().lower()
            if q not in s["symbol"].lower() and q not in s["name"].lower():
                return False
        if req.price_above_ema21 and not s["above_ema21"]:
            return False
        if req.price_above_ema50 and not s["above_ema50"]:
            return False
        if req.price_above_ema200 and not s["above_ema200"]:
            return False
        if req.volume_above_average and s["volume"] <= s["avg_volume"]:
            return False
        for f in req.filters:
            value = s.get(f.field)
            if value is None:
                return False
            if not OPS[f.operator](float(value), f.value):
                return False
        return True

    results = [s for s in snaps if keep(s)]
    sort_key = req.sort_by if req.sort_by in SCREENER_FIELDS else "research_score"
    results.sort(key=lambda s: (s.get(sort_key) is None, s.get(sort_key) or 0), reverse=req.sort_desc)
    results = results[: req.limit]
    return ScreenerResponse(
        count=len(results), scanned=scanned, results=[AssetSnapshot(**s) for s in results]
    )


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(trend_symbol: str = Query(default="NIFTY50")):
    snaps = await store.all_snapshots()
    by_symbol = {s["symbol"]: s for s in snaps}
    watchlist = [by_symbol[s] for s in WATCHLIST if s in by_symbol]
    tradables = [s for s in snaps if s["asset_type"] != "index"]
    gainers = sorted(tradables, key=lambda s: s["change_percent"], reverse=True)[:5]
    losers = sorted(tradables, key=lambda s: s["change_percent"])[:5]
    most_active = sorted(tradables, key=lambda s: s["volume_change_percent"], reverse=True)[:5]

    if trend_symbol.upper() not in by_symbol:
        trend_symbol = "NIFTY50"
    trend: PriceSeries = await get_price(trend_symbol.upper(), days=120)

    news = await _news_items(limit=8)
    all_news = await _news_items(limit=500)
    summary = store.sentiment_summary(all_news)

    def avg(key: str) -> float:
        return round(sum(s[key] for s in snaps) / len(snaps), 1) if snaps else 0.0

    overall = avg("research_score")
    verdict = (
        "Broad market breadth looks constructive"
        if overall >= 60
        else "Market breadth looks weak"
        if overall < 45
        else "Market breadth looks mixed / range-bound"
    )
    lens = ScoreBreakdown(
        technical_score=avg("technical_score"),
        fundamental_score=avg("fundamental_score"),
        volume_score=avg("volume_score"),
        news_score=avg("news_score"),
        research_score=overall,
        verdict=verdict,
    )
    return DashboardResponse(
        watchlist=[AssetSnapshot(**s) for s in watchlist],
        gainers=[AssetSnapshot(**s) for s in gainers],
        losers=[AssetSnapshot(**s) for s in losers],
        most_active=[AssetSnapshot(**s) for s in most_active],
        trend=trend,
        sentiment=SentimentSummary(**summary),
        news=[NewsItem(**n) for n in news],
        lens=lens,
    )


@router.get("/analytics", response_model=AnalyticsResponse)
async def analytics():
    snaps = await store.all_snapshots()

    by_market: dict = defaultdict(list)
    for s in snaps:
        by_market[s["market"]].append(s)
    market_comparison = [
        {
            "market": market,
            "avg_change_percent": round(sum(x["change_percent"] for x in rows) / len(rows), 2),
            "avg_research_score": round(sum(x["research_score"] for x in rows) / len(rows), 1),
            "gainers": len([x for x in rows if x["change_percent"] > 0]),
            "losers": len([x for x in rows if x["change_percent"] <= 0]),
            "count": len(rows),
        }
        for market, rows in sorted(by_market.items())
    ]

    by_sector: dict = defaultdict(list)
    for s in snaps:
        by_sector[s["sector"]].append(s)
    sector_performance = sorted(
        [
            {
                "sector": sector,
                "avg_change_percent": round(sum(x["change_percent"] for x in rows) / len(rows), 2),
                "count": len(rows),
            }
            for sector, rows in by_sector.items()
        ],
        key=lambda r: r["avg_change_percent"],
        reverse=True,
    )

    bars = await store.load_prices("NIFTY50")
    ser = store.indicator_series(bars)
    volume_trend = [
        {
            "date": bars[i]["timestamp"].strftime("%d %b"),
            "volume": int(bars[i]["volume"]),
            "avg_volume": int(ser["avg_volume"][i] or 0),
        }
        for i in range(max(0, len(bars) - 40), len(bars))
    ]

    news = await store.load_news()
    daily: dict = defaultdict(lambda: {"positive": 0, "neutral": 0, "negative": 0})
    for n in news:
        daily[n["published_at"].strftime("%d %b")][n["sentiment"]] += 1
    sentiment_trend = [{"date": d, **counts} for d, counts in sorted(daily.items(), key=lambda kv: kv[0])][-14:]

    docs = await db.backtest_results.find({}, {"_id": 0}).sort("created_at", -1).to_list(8)
    recent_backtests = [
        {
            "id": d["id"],
            "symbol": d["symbol"],
            "strategy": d["strategy"],
            "total_return_percent": d["total_return_percent"],
            "win_rate": d["win_rate"],
            "total_trades": d["total_trades"],
            "created_at": d["created_at"].isoformat(),
        }
        for d in docs
    ]

    top = sorted(snaps, key=lambda s: s["research_score"], reverse=True)[:8]
    return AnalyticsResponse(
        market_comparison=market_comparison,
        volume_trend=volume_trend,
        sentiment_trend=sentiment_trend,
        sector_performance=sector_performance,
        top_research_scores=[AssetSnapshot(**s) for s in top],
        recent_backtests=recent_backtests,
    )
