import asyncio
from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.models.tables import Stock, OHLCV, Filing, Signal

async def check():
    async with AsyncSessionLocal() as db:
        stocks  = await db.scalar(select(func.count(Stock.id)))
        ohlcv   = await db.scalar(select(func.count(OHLCV.id)))
        filings = await db.scalar(select(func.count(Filing.id)))
        signals = await db.scalar(select(func.count(Signal.id)))
        print(f"Stocks:  {stocks}")
        print(f"OHLCV:   {ohlcv}")
        print(f"Filings: {filings}")
        print(f"Signals: {signals}")

asyncio.run(check())