# TradeLens AI

Multi-market financial **research, screening and strategy backtesting** platform.

> **No broker connectivity, no live order execution, no guaranteed signals.**
> Market data is pulled from [Twelve Data](https://twelvedata.com) (prices,
> OHLCV history, fundamentals) and [Marketaux](https://www.marketaux.com)
> (news & sentiment) when API keys are configured. Any symbol or feed that
> isn't configured, or whose request fails, automatically falls back to
> clearly-labelled **DEMO DATA** so the app always runs end-to-end.

---

## 1. Architecture

```
React + Vite frontend  (port 3000)
        │  relative /api calls (Vite proxy → :8001)
        ▼
FastAPI backend        (port 8001)
        ▼
Database (MongoDB in this deployment)
        ▼
Live market data (Twelve Data) + live news (Marketaux)   (backend/lib/livedata.py)
        │  falls back per-symbol/per-feed to →  backend/lib/demodata.py
        ▼
Analytics: indicators, screener, backtester
        ▼
Results rendered in React (charts, tables, KPI cards)
```

**Database note.** The original project brief specified PostgreSQL. This
environment ships MongoDB, so the same logical schema is used with identical
collection names (`users`, `assets`, `price_data`, `news`, `fundamentals`,
`backtest_results`, `sessions`) and indexes on the frequently-queried fields
(`symbol`, `market`, `asset_symbol`, `published_at`, `created_at`). All database
access is isolated in `backend/lib/db.py` + `backend/lib/store.py`, so porting to
PostgreSQL means rewriting those two files only.

---

## 2. Project structure

```
backend/
  server.py              FastAPI app; mounts every router on APIRouter(prefix="/api")
  seed.py                idempotent data seeder (live, with demo fallback; `--demo` forces synthetic)
  models/schemas.py      Pydantic v2 request/response models
  routers/
    auth.py              demo login / me / logout (httpOnly cookie session)
    market.py            markets, assets, price, volume, volume-scan, market-sessions
    research.py          news, fundamentals, screener, dashboard, analytics
    backtest.py          strategies, run backtest, backtest history
  lib/
    db.py                Mongo client + db handle
    analytics.py         calculate_rsi / calculate_ema / calculate_sma / calculate_average_volume
    store.py             data access + snapshot & Research Score computation
    backtester.py        long-only backtesting engine
    livedata.py           LIVE data client (Twelve Data + Marketaux), per-symbol demo fallback
    demodata.py           DEMO DATA generator, also used as livedata.py's fallback source
    dates.py             server-anchored "today"
frontend/
  src/
    App.tsx              route table
    components/
      brand/             TradeLens AI logo
      charts/            reusable recharts wrappers
      common/            shared widgets (cards, score bars, state blocks)
      layout/            sidebar + header shell
      ui/                shadcn/ui primitives
    hooks/useApp.ts      theme + current-user hooks
    lib/api.ts           typed fetch layer over /api
    lib/types.ts         TypeScript mirrors of the Pydantic models
    pages/               Dashboard, Markets, Screener, News, Fundamentals,
                         VolumeAnalysis, Backtesting, Analytics, Settings, Login
```

---

## 3. Setup and run (exact commands)

> **Running it in VS Code on your own laptop?** Follow [`LOCAL_SETUP.md`](LOCAL_SETUP.md)
> — it covers prerequisites, MongoDB options (local / Docker / Atlas), the bundled
> VS Code tasks and debug configs, and a troubleshooting table.

### Prerequisites
- Python 3.11+
- Node.js 20+ and Yarn
- A running MongoDB (this pod runs `mongod` locally)

### Backend

```bash
cd backend
cp .env.example .env          # then edit if your Mongo URL differs
pip install -r requirements.txt
python seed.py                # loads the DEMO dataset (36 assets × 400 bars)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

API docs: <http://localhost:8001/docs>

### Frontend

```bash
cd frontend
yarn install
yarn dev                      # http://localhost:3000
```

The Vite dev server proxies `/api/*` to `http://localhost:8001`, so the frontend
never needs an absolute backend URL.

### Demo login

| Email | Password |
|---|---|
| `demo@tradelens.ai` | `demo123` |
| `student@tradelens.ai` | `student123` |

---

## 4. API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/markets` | market list with asset counts |
| GET | `/api/assets` | asset snapshots (filter by `market`, `asset_type`, `search`) |
| GET | `/api/assets/{symbol}` | single asset snapshot with indicators + scores |
| GET | `/api/asset-directory` | plain symbol/name directory |
| GET | `/api/price/{symbol}` | OHLCV candles with EMA 21/50/200 and RSI |
| GET | `/api/volume/{symbol}` | volume series, average volume, spike count |
| GET | `/api/volume-scan` | assets bucketed by volume vs average |
| GET | `/api/news` | news feed + sentiment summary |
| GET | `/api/fundamentals` | fundamentals list with ratio filters |
| GET | `/api/fundamentals/{symbol}` | fundamentals for one asset |
| POST | `/api/screener` | multi-condition screen |
| GET | `/api/dashboard` | market summary, movers, trend, sentiment, AI Market Lens |
| GET | `/api/analytics` | market/sector/volume/sentiment/backtest analytics |
| GET | `/api/backtest/strategies` | available strategies |
| POST | `/api/backtest` | run a backtest, persist the result |
| GET | `/api/backtest/history` | recent stored backtests |
| GET | `/api/market-sessions` | India / London / New York / Tokyo session status |
| POST | `/api/auth/login`, GET `/api/auth/me`, POST `/api/auth/logout` | demo auth |

Errors: unknown symbols return `404`, invalid bodies return FastAPI's `422`
with a `{"detail": [...]}` payload.

---

## 5. Technical analysis

`backend/lib/analytics.py` exposes reusable functions:

- `calculate_rsi(values, period=14)` — Wilder's RSI
- `calculate_ema(values, period)` / `calculate_ema_series(...)`
- `calculate_sma(values, period)`
- `calculate_average_volume(volumes, period=20)`
- `max_drawdown(equity)`

## 6. Research Score (AI Market Lens)

A **descriptive** 0–100 composite of four sub-scores — technical, fundamental,
volume and news sentiment (`backend/lib/store.py`). It is a research aid, not a
prediction, recommendation or trading signal.

## 7. Backtesting

Long-only, one position at a time, three strategies (EMA+RSI+Volume, EMA
crossover, RSI reversal). Exits use a fixed percentage stop with a 1:R target;
open positions close on the final bar. Outputs total/winning/losing trades, win
rate, total return, net P/L, max drawdown, profit factor, average trade and the
full equity curve versus buy & hold. **Historical data only — past performance
does not indicate future results.**

## 8. Connecting real data later

Replace `backend/lib/demodata.py` with a provider client that returns the same
shapes, then re-run `seed.py` (or write an incremental ingest job). Nothing in
the frontend changes: it only speaks to `/api`.

## 9. Module division (two students)

-  dipanshu— Frontend & UX:** `frontend/` — pages, charts, components,
  responsive layout, API integration.
- Darshan  — Backend, data & analytics:** `backend/` — FastAPI routers,
  database, indicators, screener, news/fundamentals processing, backtesting.

Both sides meet only at the REST boundary: a Pydantic model in
`backend/models/schemas.py` and its hand-written mirror in
`frontend/src/lib/types.ts`.
