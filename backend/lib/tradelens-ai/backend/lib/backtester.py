"""Simple long-only backtesting engine over historical (demo) daily bars.

Results are computed from past data only -- they say nothing about future
performance. Strategies are intentionally simple so they can be explained.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List

from lib.analytics import max_drawdown
from lib.store import indicator_series

DISCLAIMER = (
    "Backtest results are calculated from historical DEMO data for research and "
    "education only. Past performance does not indicate future results. This is "
    "not investment advice and no orders are ever placed."
)

STRATEGY_LABELS = {
    "ema_rsi_volume": "EMA + RSI + Volume confirmation",
    "ema_crossover": "Price / EMA trend crossover",
    "rsi_reversal": "RSI oversold reversal",
}


def _ema_key(period: int) -> str:
    return {21: "ema21", 50: "ema50", 200: "ema200"}[period]


def run_backtest(asset: dict, bars: List[dict], cfg) -> dict:
    bars = bars[-cfg.lookback_days :]
    if len(bars) < 60:
        raise ValueError("Not enough historical bars for this lookback window.")

    ser = indicator_series(bars)
    ema = ser[_ema_key(cfg.ema_period)]
    rsi = ser["rsi"]
    avg_vol = ser["avg_volume"]

    entry_rules: List[str] = []
    if cfg.strategy == "ema_rsi_volume":
        entry_rules = [f"Close > {cfg.ema_period} EMA", f"RSI(14) > {cfg.rsi_threshold:g}"]
        if cfg.require_volume:
            entry_rules.append("Volume > 20-day average volume")
    elif cfg.strategy == "ema_crossover":
        entry_rules = [
            f"Close crosses above {cfg.ema_period} EMA",
            "Previous close was below the EMA",
        ]
    else:
        entry_rules = [f"RSI(14) crosses back above {cfg.rsi_threshold:g} from below", f"Close > {cfg.ema_period} EMA"]
    exit_rules = [
        f"Stop loss at -{cfg.stop_loss_percent:g}% from entry",
        f"Target at 1:{cfg.risk_reward:g} risk/reward (+{cfg.stop_loss_percent * cfg.risk_reward:.2f}%)",
        "Any open position is closed on the final bar",
    ]

    def entry_signal(i: int) -> bool:
        if ema[i] is None or rsi[i] is None:
            return False
        close, prev_close = bars[i]["close"], bars[i - 1]["close"]
        if cfg.strategy == "ema_rsi_volume":
            ok = close > ema[i] and rsi[i] > cfg.rsi_threshold
            if cfg.require_volume:
                ok = ok and avg_vol[i] is not None and bars[i]["volume"] > avg_vol[i]
            return ok
        if cfg.strategy == "ema_crossover":
            return ema[i - 1] is not None and prev_close <= ema[i - 1] and close > ema[i]
        return (
            rsi[i - 1] is not None
            and rsi[i - 1] <= cfg.rsi_threshold
            and rsi[i] > cfg.rsi_threshold
            and close > ema[i]
        )

    cash = float(cfg.initial_capital)
    equity_curve: List[dict] = []
    trades: List[dict] = []
    position = None
    hold_qty = cfg.initial_capital / bars[0]["close"]

    for i in range(1, len(bars)):
        bar = bars[i]
        if position is None:
            if entry_signal(i):
                alloc = cash * (cfg.position_size_percent / 100)
                qty = alloc / bar["close"]
                if qty > 0:
                    position = {
                        "entry_index": i,
                        "entry_date": bar["timestamp"],
                        "entry_price": bar["close"],
                        "quantity": qty,
                        "stop": bar["close"] * (1 - cfg.stop_loss_percent / 100),
                        "target": bar["close"] * (1 + cfg.stop_loss_percent * cfg.risk_reward / 100),
                        "cost": qty * bar["close"],
                    }
                    cash -= position["cost"]
        else:
            exit_price = None
            reason = ""
            if bar["low"] <= position["stop"]:
                exit_price, reason = position["stop"], "Stop loss hit"
            elif bar["high"] >= position["target"]:
                exit_price, reason = position["target"], "Target reached"
            elif i == len(bars) - 1:
                exit_price, reason = bar["close"], "Closed at end of test"
            if exit_price is not None:
                proceeds = position["quantity"] * exit_price
                cash += proceeds
                pnl = proceeds - position["cost"]
                trades.append(
                    {
                        "id": len(trades) + 1,
                        "entry_date": position["entry_date"],
                        "exit_date": bar["timestamp"],
                        "entry_price": round(position["entry_price"], 4),
                        "exit_price": round(exit_price, 4),
                        "quantity": round(position["quantity"], 4),
                        "pnl": round(pnl, 2),
                        "return_percent": round(pnl / position["cost"] * 100, 2),
                        "outcome": "win" if pnl >= 0 else "loss",
                        "exit_reason": reason,
                        "bars_held": i - position["entry_index"],
                    }
                )
                position = None

        mark = cash + (position["quantity"] * bar["close"] if position else 0.0)
        equity_curve.append(
            {
                "timestamp": bar["timestamp"],
                "equity": round(mark, 2),
                "buy_and_hold": round(hold_qty * bar["close"], 2),
            }
        )

    final = equity_curve[-1]["equity"] if equity_curve else float(cfg.initial_capital)
    wins = [t for t in trades if t["outcome"] == "win"]
    losses = [t for t in trades if t["outcome"] == "loss"]
    gross_profit = sum(t["pnl"] for t in wins)
    gross_loss = abs(sum(t["pnl"] for t in losses))
    net_profit = final - cfg.initial_capital

    return {
        "id": str(uuid.uuid4()),
        "symbol": asset["symbol"],
        "name": asset["name"],
        "strategy": STRATEGY_LABELS[cfg.strategy],
        "entry_rules": entry_rules,
        "exit_rules": exit_rules,
        "initial_capital": round(float(cfg.initial_capital), 2),
        "final_capital": round(final, 2),
        "total_trades": len(trades),
        "winning_trades": len(wins),
        "losing_trades": len(losses),
        "win_rate": round(len(wins) / len(trades) * 100, 2) if trades else 0.0,
        "total_return_percent": round(net_profit / cfg.initial_capital * 100, 2),
        "net_profit": round(net_profit, 2),
        "max_drawdown_percent": max_drawdown([p["equity"] for p in equity_curve]),
        "profit_factor": round(gross_profit / gross_loss, 2) if gross_loss > 0 else None,
        "average_trade": round(sum(t["pnl"] for t in trades) / len(trades), 2) if trades else 0.0,
        "average_win": round(gross_profit / len(wins), 2) if wins else 0.0,
        "average_loss": round(-gross_loss / len(losses), 2) if losses else 0.0,
        "buy_hold_return_percent": round(
            (equity_curve[-1]["buy_and_hold"] - cfg.initial_capital) / cfg.initial_capital * 100, 2
        )
        if equity_curve
        else 0.0,
        "trades": trades,
        "equity_curve": equity_curve,
        "disclaimer": DISCLAIMER,
        "created_at": datetime.now(timezone.utc),
        "data_source": "DEMO",
    }
