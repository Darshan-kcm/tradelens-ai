"""Backtesting endpoints. Historical DEMO data only -- never live orders."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException, Query
from models.schemas import BacktestRequest, BacktestResponse

from lib import store
from lib.backtester import STRATEGY_LABELS, run_backtest
from lib.db import db

router = APIRouter(tags=["backtest"])


@router.get("/backtest/strategies")
async def strategies():
    return [{"value": k, "label": v} for k, v in STRATEGY_LABELS.items()]


@router.post("/backtest", response_model=BacktestResponse)
async def create_backtest(req: BacktestRequest):
    asset = await store.get_asset(req.symbol)
    if not asset:
        raise HTTPException(status_code=404, detail=f"Asset '{req.symbol}' not found")
    bars = await store.load_prices(req.symbol)
    try:
        result = run_backtest(asset, bars, req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    await db.backtest_results.insert_one(
        {
            **{k: v for k, v in result.items() if k not in ("equity_curve", "trades")},
            "config": req.model_dump(),
            "trade_count": result["total_trades"],
        }
    )
    return BacktestResponse(**result)


@router.get("/backtest/history", response_model=List[dict])
async def history(limit: int = Query(default=10, ge=1, le=50)):
    docs = await db.backtest_results.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [
        {
            "id": d["id"],
            "symbol": d["symbol"],
            "name": d["name"],
            "strategy": d["strategy"],
            "total_return_percent": d["total_return_percent"],
            "win_rate": d["win_rate"],
            "total_trades": d["total_trades"],
            "max_drawdown_percent": d["max_drawdown_percent"],
            "created_at": d["created_at"].isoformat(),
        }
        for d in docs
    ]
