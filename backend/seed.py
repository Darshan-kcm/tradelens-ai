"""Idempotent seeder for TradeLens AI.

By default this pulls LIVE data (Twelve Data prices, FMP fundamentals for
US stocks, Marketaux news) if the corresponding API keys are set in
backend/.env. Any symbol or feed that fails or isn't configured falls back
to clearly labelled DEMO data automatically, so the app never breaks.

Run:  cd backend && python seed.py            # live data (needs API keys)
Run:  cd backend && python seed.py --demo     # force demo/synthetic data
"""
import asyncio
import hashlib
import sys
import uuid

from lib.db import db
from lib import demodata

DEMO_USERS = [
    {"email": "demo@tradelens.ai", "password": "demo123", "name": "Demo Analyst", "role": "analyst"},
    {"email": "student@tradelens.ai", "password": "student123", "name": "Project Student", "role": "student"},
]


def hash_password(raw: str) -> str:
    return hashlib.sha256(f"tradelens::{raw}".encode()).hexdigest()


async def main() -> None:
    force_demo = "--demo" in sys.argv

    assets = demodata.build_assets()

    print("clearing previous collections...")
    for name in ("assets", "price_data", "news", "fundamentals", "users"):
        await db[name].delete_many({})

    print(f"inserting {len(assets)} assets...")
    await db.assets.insert_many([dict(a) for a in assets])
    await db.assets.create_index("symbol", unique=True)
    await db.assets.create_index("market")

    if force_demo:
        print("--demo flag set: seeding synthetic DEMO data only")
        prices = {a["symbol"]: demodata.build_price_history(a) for a in assets}
        fundamentals = [demodata.build_fundamentals(a) for a in assets]
        news = demodata.build_news(assets)
        price_is_live = {a["symbol"]: False for a in assets}
    else:
        from lib import livedata

        if not livedata.TWELVE_DATA_API_KEY:
            print("TWELVE_DATA_API_KEY not set in backend/.env — falling back to DEMO prices/fundamentals.")
        if not livedata.MARKETAUX_API_KEY:
            print("MARKETAUX_API_KEY not set in backend/.env — falling back to DEMO news.")
        print("fetching live data (this respects free-tier rate limits, may take a few minutes)...")
        prices, fundamentals, news, price_is_live = await livedata.build_all(assets)

    total_bars = 0
    for symbol, bars in prices.items():
        if not bars:
            continue
        await db.price_data.insert_many(bars)
        total_bars += len(bars)
    await db.price_data.create_index([("symbol", 1), ("timestamp", 1)])
    print(f"inserted {total_bars} price_data bars")

    await db.fundamentals.insert_many(fundamentals)
    await db.fundamentals.create_index("symbol", unique=True)
    print(f"inserted {len(fundamentals)} fundamentals rows")

    for item in news:
        item["id"] = str(uuid.uuid4())
    if news:
        await db.news.insert_many(news)
    await db.news.create_index("asset_symbol")
    await db.news.create_index("published_at")
    print(f"inserted {len(news)} news rows")

    users = [
        {
            "id": str(uuid.uuid4()),
            "email": u["email"],
            "name": u["name"],
            "role": u["role"],
            "password_hash": hash_password(u["password"]),
        }
        for u in DEMO_USERS
    ]
    await db.users.insert_many(users)
    await db.users.create_index("email", unique=True)
    await db.backtest_results.create_index("created_at")
    await db.verification_codes.create_index([("email", 1), ("purpose", 1), ("created_at", -1)])
    await db.verification_codes.create_index("expires_at", expireAfterSeconds=0)
    print(f"inserted {len(users)} demo users")

    live_symbols = [s for s, ok in price_is_live.items() if ok]
    demo_symbols = [s for s, ok in price_is_live.items() if not ok]
    print(f"\nprice data source — LIVE: {len(live_symbols)} symbols, DEMO fallback: {len(demo_symbols)} symbols")
    if demo_symbols:
        print(f"  fell back to demo: {', '.join(sorted(demo_symbols))}")
        print("  (check the warnings printed above for the exact API error per symbol)")

    mode = "DEMO (synthetic)" if force_demo else "LIVE where available, DEMO fallback otherwise"
    print(f"seed complete - data mode: {mode}.")


if __name__ == "__main__":
    asyncio.run(main())