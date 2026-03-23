import yfinance as yf
import pandas as pd
from sqlalchemy import select, insert
from app.database import AsyncSessionLocal
from app.models.tables import Stock, OHLCV
from app.config import settings
from app.tasks import celery_app
import asyncio

@celery_app.task(name="app.tasks.fetch_prices.fetch_all_prices")
def fetch_all_prices():
    asyncio.run(_fetch_all_prices_async())

async def _fetch_all_prices_async():
    symbols = settings.symbols_list
    async with AsyncSessionLocal() as db:
        for symbol in symbols:
            try:
                ticker = yf.Ticker(f"{symbol}.NS")
                hist = ticker.history(period="2y")
                if hist.empty:
                    continue

                # Ensure stock exists
                result = await db.execute(select(Stock).where(Stock.symbol == symbol))
                stock = result.scalar_one_or_none()
                if not stock:
                    stock = Stock(symbol=symbol, name=ticker.info.get("longName", symbol),
                                  exchange="NSE", sector=ticker.info.get("sector", "Unknown"))
                    db.add(stock)
                    await db.flush()

                # Upsert OHLCV rows
                for date, row in hist.iterrows():
                    date_only = date.date()
                    existing = await db.execute(
                        select(OHLCV).where(OHLCV.stock_id == stock.id, OHLCV.date == date_only)
                    )
                    if existing.scalar_one_or_none():
                        continue
                    db.add(OHLCV(
                        stock_id=stock.id, date=date_only,
                        open=round(float(row["Open"]), 2),
                        high=round(float(row["High"]), 2),
                        low=round(float(row["Low"]), 2),
                        close=round(float(row["Close"]), 2),
                        volume=int(row["Volume"])
                    ))
                await db.commit()
            except Exception as e:
                print(f"Error fetching {symbol}: {e}")
                await db.rollback()
