"""Markets, assets, price, volume and market-session endpoints."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query
from models.schemas import (
    Asset,
    AssetSnapshot,
    Candle,
    Market,
    MarketSession,
    MarketSessionsResponse,
    PriceSeries,
    VolumeBar,
    VolumeSeries,
)

from lib import store
from lib.demodata import MARKETS, market_session_defs

router = APIRouter(tags=["markets"])


@router.get("/markets", response_model=List[Market])
async def list_markets():
    assets = await store.load_assets()
    counts: dict = {}
    for a in assets:
        counts[a["market"]] = counts.get(a["market"], 0) + 1
    return [Market(**m, asset_count=counts.get(m["code"], 0)) for m in MARKETS]


@router.get("/assets", response_model=List[AssetSnapshot])
async def list_assets(
    market: Optional[str] = Query(default=None),
    asset_type: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=200),
):
    snaps = await store.all_snapshots()
    if market and market.lower() != "all":
        snaps = [s for s in snaps if s["market"].lower() == market.lower()]
    if asset_type and asset_type.lower() != "all":
        snaps = [s for s in snaps if s["asset_type"].lower() == asset_type.lower()]
    if search:
        q = search.strip().lower()
        snaps = [s for s in snaps if q in s["symbol"].lower() or q in s["name"].lower()]
    return [AssetSnapshot(**s) for s in snaps[:limit]]


@router.get("/assets/{symbol}", response_model=AssetSnapshot)
async def get_asset(symbol: str):
    snap = await store.snapshot_for(symbol)
    if not snap:
        raise HTTPException(status_code=404, detail=f"Asset '{symbol}' not found")
    return AssetSnapshot(**snap)


@router.get("/asset-directory", response_model=List[Asset])
async def asset_directory():
    return [Asset(**a) for a in await store.load_assets()]


@router.get("/price/{symbol}", response_model=PriceSeries)
async def get_price(symbol: str, days: int = Query(default=180, ge=20, le=400)):
    asset = await store.get_asset(symbol)
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{symbol}' not found")
    bars = await store.load_prices(symbol)
    if not bars:
        raise HTTPException(status_code=404, detail=f"No price history for '{symbol}'")
    ser = store.indicator_series(bars)
    candles = []
    for i in range(max(0, len(bars) - days), len(bars)):
        b = bars[i]
        candles.append(
            Candle(
                timestamp=b["timestamp"],
                open=b["open"],
                high=b["high"],
                low=b["low"],
                close=b["close"],
                volume=int(b["volume"]),
                ema21=_r(ser["ema21"][i]),
                ema50=_r(ser["ema50"][i]),
                ema200=_r(ser["ema200"][i]),
                rsi=_r(ser["rsi"][i]),
                avg_volume=_r(ser["avg_volume"][i], 0),
            )
        )
    return PriceSeries(symbol=asset["symbol"], name=asset["name"], candles=candles)


def _r(value, digits: int = 4):
    return None if value is None else round(value, digits)


@router.get("/volume/{symbol}", response_model=VolumeSeries)
async def get_volume(symbol: str, days: int = Query(default=90, ge=20, le=400)):
    asset = await store.get_asset(symbol)
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{symbol}' not found")
    bars = await store.load_prices(symbol)
    ser = store.indicator_series(bars)
    out: List[VolumeBar] = []
    spikes = 0
    for i in range(max(0, len(bars) - days), len(bars)):
        b = bars[i]
        avg = ser["avg_volume"][i]
        ratio = (b["volume"] / avg) if avg else None
        spike = bool(ratio and ratio >= 1.6)
        spikes += 1 if spike else 0
        out.append(
            VolumeBar(
                timestamp=b["timestamp"],
                close=b["close"],
                volume=int(b["volume"]),
                avg_volume=_r(avg, 0),
                volume_ratio=_r(ratio, 2),
                spike=spike,
            )
        )
    snap = await store.snapshot_for(symbol)
    return VolumeSeries(
        symbol=asset["symbol"],
        name=asset["name"],
        latest_volume=snap["volume"] if snap else 0,
        average_volume=snap["avg_volume"] if snap else 0,
        volume_change_percent=snap["volume_change_percent"] if snap else 0,
        spike_count=spikes,
        bars=out,
    )


@router.get("/volume-scan", response_model=List[AssetSnapshot])
async def volume_scan(
    filter: str = Query(default="all", pattern="^(all|above_average|spike|high|low)$"),
    market: Optional[str] = Query(default=None),
):
    """Assets bucketed by how current volume compares with 20-day average volume."""
    snaps = await store.all_snapshots()
    if market and market.lower() != "all":
        snaps = [s for s in snaps if s["market"].lower() == market.lower()]
    if filter == "above_average":
        snaps = [s for s in snaps if s["volume"] > s["avg_volume"]]
    elif filter == "spike":
        snaps = [s for s in snaps if s["volume_spike"]]
    elif filter == "high":
        snaps = [s for s in snaps if s["volume_change_percent"] >= 15]
    elif filter == "low":
        snaps = [s for s in snaps if s["volume_change_percent"] < 0]
    snaps = sorted(snaps, key=lambda s: s["volume_change_percent"], reverse=True)
    return [AssetSnapshot(**s) for s in snaps]


@router.get("/market-sessions", response_model=MarketSessionsResponse)
async def market_sessions(at_utc_hour: Optional[float] = Query(default=None, ge=0, le=24)):
    """Market open/closed status. Pass `at_utc_hour` to inspect another moment."""
    now_utc = datetime.now(timezone.utc)
    ref = now_utc
    if at_utc_hour is not None:
        hour = int(at_utc_hour)
        minute = int(round((at_utc_hour - hour) * 60))
        ref = now_utc.replace(hour=min(hour, 23), minute=min(minute, 59), second=0, microsecond=0)

    sessions: List[MarketSession] = []
    for cfg in market_session_defs():
        tz = ZoneInfo(cfg["timezone"])
        local = ref.astimezone(tz)
        oh, om = (int(x) for x in cfg["open"].split(":"))
        ch, cm = (int(x) for x in cfg["close"].split(":"))
        local_hour = local.hour + local.minute / 60
        weekday_ok = local.weekday() <= 4
        is_open = weekday_ok and (oh + om / 60) <= local_hour < (ch + cm / 60)
        if not weekday_ok:
            status = "Weekend"
        elif is_open:
            status = "Open"
        elif local_hour < oh + om / 60:
            status = "Pre-open"
        else:
            status = "Closed"
        open_local = local.replace(hour=oh, minute=om, second=0, microsecond=0)
        close_local = local.replace(hour=ch, minute=cm, second=0, microsecond=0)
        sessions.append(
            MarketSession(
                market=cfg["market"],
                exchange=cfg["exchange"],
                timezone=cfg["timezone"],
                local_time=local.strftime("%H:%M"),
                local_date=local.strftime("%a, %d %b"),
                open_time=cfg["open"],
                close_time=cfg["close"],
                is_open=is_open,
                status=status,
                open_utc_hour=round(_utc_hour(open_local), 2),
                close_utc_hour=round(_utc_hour(close_local), 2),
            )
        )
    return MarketSessionsResponse(
        reference_utc=ref,
        reference_utc_hour=round(ref.hour + ref.minute / 60, 2),
        sessions=sessions,
    )


def _utc_hour(dt: datetime) -> float:
    u = dt.astimezone(timezone.utc)
    return u.hour + u.minute / 60
