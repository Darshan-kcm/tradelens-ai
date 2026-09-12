"""Reusable technical-analysis helpers.

Every function takes a plain list of floats (oldest -> newest) and returns
either a single latest value or a list aligned to the input length
(``None`` where there is not enough history yet).
"""
from __future__ import annotations

from typing import List, Optional


def calculate_sma(values: List[float], period: int) -> Optional[float]:
    """Simple moving average of the last `period` values."""
    if len(values) < period or period <= 0:
        return None
    return sum(values[-period:]) / period


def calculate_ema_series(values: List[float], period: int) -> List[Optional[float]]:
    """Exponential moving average as a series aligned to `values`."""
    out: List[Optional[float]] = [None] * len(values)
    if len(values) < period or period <= 0:
        return out
    k = 2 / (period + 1)
    ema = sum(values[:period]) / period
    out[period - 1] = ema
    for i in range(period, len(values)):
        ema = values[i] * k + ema * (1 - k)
        out[i] = ema
    return out


def calculate_ema(values: List[float], period: int) -> Optional[float]:
    """Latest EMA value."""
    series = calculate_ema_series(values, period)
    return series[-1] if series else None


def calculate_rsi_series(values: List[float], period: int = 14) -> List[Optional[float]]:
    """Wilder's RSI as a series aligned to `values`."""
    out: List[Optional[float]] = [None] * len(values)
    if len(values) <= period:
        return out
    gains, losses = 0.0, 0.0
    for i in range(1, period + 1):
        diff = values[i] - values[i - 1]
        gains += max(diff, 0.0)
        losses += max(-diff, 0.0)
    avg_gain, avg_loss = gains / period, losses / period
    out[period] = _rsi_from(avg_gain, avg_loss)
    for i in range(period + 1, len(values)):
        diff = values[i] - values[i - 1]
        avg_gain = (avg_gain * (period - 1) + max(diff, 0.0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-diff, 0.0)) / period
        out[i] = _rsi_from(avg_gain, avg_loss)
    return out


def _rsi_from(avg_gain: float, avg_loss: float) -> float:
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def calculate_rsi(values: List[float], period: int = 14) -> Optional[float]:
    """Latest RSI value."""
    series = calculate_rsi_series(values, period)
    return series[-1] if series else None


def calculate_average_volume(volumes: List[float], period: int = 20) -> Optional[float]:
    """Average volume over the last `period` bars."""
    return calculate_sma(volumes, min(period, len(volumes)) if volumes else period)


def max_drawdown(equity: List[float]) -> float:
    """Maximum peak-to-trough drawdown of an equity curve, in percent."""
    if not equity:
        return 0.0
    peak = equity[0]
    worst = 0.0
    for v in equity:
        peak = max(peak, v)
        if peak > 0:
            worst = min(worst, (v - peak) / peak * 100)
    return round(worst, 2)


def round_or_none(value: Optional[float], digits: int = 2) -> Optional[float]:
    return None if value is None else round(value, digits)
