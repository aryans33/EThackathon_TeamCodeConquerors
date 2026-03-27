import asyncio
import sys
import os
import datetime
import random
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.tables import Stock, OHLCV


# Starting prices for each stock
STOCK_PRICES = {
    "RELIANCE": 2800,
    "TCS": 3900,
    "INFY": 1800,
    "HDFCBANK": 1650,
    "ICICIBANK": 1200,
    "WIPRO": 480,
    "SBIN": 820,
    "LT": 3500,
    "TITAN": 3300,
    "BAJFINANCE": 7200,
    "ADANIENT": 2400,
    "BHARTIARTL": 1700,
    "ASIANPAINT": 2400,
    "AXISBANK": 1100,
    "KOTAKBANK": 1900,
    "TATAMOTORS": 720,
    "HINDUNILVR": 2500,
    "NESTLEIND": 2300,
    "SUNPHARMA": 1900,
    "MARUTI": 12000,
}


def generate_trading_dates(end_date: datetime.date, num_days: int) -> list[datetime.date]:
    """Generate trading dates (skip weekends) going backwards from end_date."""
    dates = []
    current_date = end_date
    
    while len(dates) < num_days:
        # Skip weekends (Saturday=5, Sunday=6)
        if current_date.weekday() < 5:
            dates.insert(0, current_date)
        current_date -= datetime.timedelta(days=1)
    
    return dates


def generate_ohlcv(start_price: float, dates: list[datetime.date]) -> list[dict]:
    """Generate OHLCV records using random walk model."""
    records = []
    prev_close = start_price
    
    for date in dates:
        # Random walk for close price
        close = prev_close * (1 + random.gauss(0.0002, 0.015))
        close = max(close, 1.0)  # Ensure price stays positive
        
        # Generate OHLC based on close
        high = close * random.uniform(1.001, 1.025)
        low = close * random.uniform(0.975, 0.999)
        open_price = prev_close * random.uniform(0.998, 1.002)
        
        # Ensure OHLC relationships
        high = max(high, close, open_price)
        low = min(low, close, open_price)
        
        volume = random.randint(500000, 5000000)
        
        records.append({
            "date": date,
            "open": round(open_price, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close, 2),
            "volume": volume,
        })
        
        prev_close = close
    
    return records


async def seed_ohlcv_for_stock(session, stock: Stock) -> int:
    """Seed OHLCV data for a single stock using conflict-safe upsert semantics."""
    symbol = stock.symbol
    start_price = STOCK_PRICES.get(symbol, 1000)  # Default if not found
    
    # Generate trading dates
    today = datetime.date.today()
    dates = generate_trading_dates(today, 400)
    
    # Generate OHLCV data
    ohlcv_records = generate_ohlcv(start_price, dates)
    
    rows = [
        {
            "stock_id": stock.id,
            "date": record["date"],
            "open": record["open"],
            "high": record["high"],
            "low": record["low"],
            "close": record["close"],
            "volume": record["volume"],
        }
        for record in ohlcv_records
    ]

    stmt = pg_insert(OHLCV).values(rows)
    stmt = stmt.on_conflict_do_nothing(index_elements=["stock_id", "date"])

    await session.execute(stmt)
    await session.commit()

    print(f"Inserted/skipped {len(rows)} OHLCV rows for {symbol}")
    return len(rows)


async def main():
    """Main function to seed OHLCV data for all stocks."""
    print("🚀 Generating synthetic OHLCV data for all stocks...")
    
    # First, get all stocks
    async with AsyncSessionLocal() as session:
        stmt = select(Stock)
        result = await session.execute(stmt)
        stocks = result.scalars().all()
        stock_list = [(s.id, s.symbol) for s in stocks]
    
    print(f"\nFound {len(stock_list)} stocks in database\n")
    
    total_rows = 0
    for stock_id, symbol in stock_list:
        # Create a new session for each stock
        async with AsyncSessionLocal() as session:
            stmt = select(Stock).where(Stock.id == stock_id)
            result = await session.execute(stmt)
            stock = result.scalar_one()
            
            try:
                rows = await seed_ohlcv_for_stock(session, stock)
                total_rows += rows
            except Exception as e:
                await session.rollback()
                print(f"Seed failed for {symbol}: {e}")
                raise SystemExit(1)
    
    print(f"\n✅ Done: {len(stock_list)} stocks, ~{total_rows} rows total")


if __name__ == "__main__":
    asyncio.run(main())
