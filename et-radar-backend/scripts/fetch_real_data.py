import asyncio
import sys
import os

# Ensure the root project directory is in the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import delete  # type: ignore[import]
from app.database import AsyncSessionLocal  # type: ignore[import]
from app.models.tables import OHLCV, Signal, Stock, Filing  # type: ignore[import]
from app.tasks.fetch_prices import _fetch_all_prices_async  # type: ignore[import]

async def clean_and_fetch():
    print("🧹 Cleaning old demo data...")
    async with AsyncSessionLocal() as db:
        await db.execute(delete(Signal))
        await db.execute(delete(Filing))
        await db.execute(delete(OHLCV))
        await db.execute(delete(Stock))
        await db.commit()
    
    print("📈 Fetching REAL historical data via yfinance (this takes a minute)...")
    await _fetch_all_prices_async()
    print("✅ Real data fetch complete!")

if __name__ == "__main__":
    asyncio.run(clean_and_fetch())
