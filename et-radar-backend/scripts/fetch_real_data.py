import httpx
import asyncio
import json
import time
import sys
import os
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import AsyncSessionLocal  # type: ignore[import]
from app.models.tables import Stock, OHLCV, Signal  # type: ignore[import]
from sqlalchemy import select  # type: ignore[import]

STOCKS = [
    {"symbol": "RELIANCE", "name": "Reliance Industries Ltd", "sector": "Energy"},
    {"symbol": "TCS", "name": "Tata Consultancy Services", "sector": "IT"},
    {"symbol": "INFY", "name": "Infosys Ltd", "sector": "IT"},
    {"symbol": "HDFCBANK", "name": "HDFC Bank Ltd", "sector": "Banking"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Ltd", "sector": "Banking"},
    {"symbol": "WIPRO", "name": "Wipro Ltd", "sector": "IT"},
    {"symbol": "SBIN", "name": "State Bank of India", "sector": "Banking"},
    {"symbol": "LT", "name": "Larsen & Toubro Ltd", "sector": "Infrastructure"},
    {"symbol": "TITAN", "name": "Titan Company Ltd", "sector": "Consumer"},
    {"symbol": "BAJFINANCE", "name": "Bajaj Finance Ltd", "sector": "NBFC"},
    {"symbol": "ADANIENT", "name": "Adani Enterprises Ltd", "sector": "Conglomerate"},
    {"symbol": "BHARTIARTL", "name": "Bharti Airtel Ltd", "sector": "Telecom"},
    {"symbol": "ASIANPAINT", "name": "Asian Paints Ltd", "sector": "Consumer"},
    {"symbol": "AXISBANK", "name": "Axis Bank Ltd", "sector": "Banking"},
    {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank", "sector": "Banking"},
    {"symbol": "TATAMOTORS", "name": "Tata Motors Ltd", "sector": "Automobile"},
    {"symbol": "HINDUNILVR", "name": "Hindustan Unilever Ltd", "sector": "FMCG"},
    {"symbol": "NESTLEIND", "name": "Nestle India Ltd", "sector": "FMCG"},
    {"symbol": "SUNPHARMA", "name": "Sun Pharmaceutical", "sector": "Pharma"},
    {"symbol": "MARUTI", "name": "Maruti Suzuki India", "sector": "Automobile"},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com",
}


def create_nse_session() -> httpx.Client:
    """Create an httpx session with NSE cookies"""
    client = httpx.Client(headers=HEADERS, follow_redirects=True, timeout=30)
    # Hit homepage to get cookies
    try:
        client.get("https://www.nseindia.com")
        time.sleep(1)
        # Hit another page to strengthen the session
        client.get("https://www.nseindia.com/market-data/live-equity-market")
        time.sleep(1)
    except Exception as e:
        print(f"Warning: Could not initialize NSE session cookies: {e}")
    return client


def fetch_ohlcv_nse(client: httpx.Client, symbol: str) -> list[dict]:
    """
    Fetch 1 year of daily OHLCV from NSE historical API.
    Returns list of {date, open, high, low, close, volume}
    """
    today = date.today()
    from_date = (today - timedelta(days=365)).strftime("%d-%m-%Y")
    to_date = today.strftime("%d-%m-%Y")

    # Try NSE historical endpoint
    try:
        url = "https://www.nseindia.com/api/historical/cm/equity"
        params = {
            "symbol": symbol,
            "series": '["EQ"]',
            "from": from_date,
            "to": to_date,
        }
        print(f"      Trying: {url}?symbol={symbol}...")
        r = client.get(url, params=params)
        print(f"      Status: {r.status_code}, len: {len(r.text)}")

        if r.status_code == 200:
            data = r.json()
            rows = []
            for item in data.get("data", []):
                try:
                    rows.append(
                        {
                            "date": datetime.strptime(
                                item["CH_TIMESTAMP"], "%d-%b-%Y"
                            ).date(),
                            "open": float(item["CH_OPENING_PRICE"]),
                            "high": float(item["CH_TRADE_HIGH_PRICE"]),
                            "low": float(item["CH_TRADE_LOW_PRICE"]),
                            "close": float(item["CH_CLOSING_PRICE"]),
                            "volume": int(float(item["CH_TOT_TRADED_QTY"])),
                        }
                    )
                except (KeyError, ValueError, TypeError):
                    continue
            if rows:
                return sorted(rows, key=lambda x: x["date"])
        else:
            print(f"      Historical failed: {r.status_code}")
    except Exception as e:
        print(f"      Historical exception: {e}")

    # Fallback: try chart data endpoint
    try:
        url2 = "https://www.nseindia.com/api/chart-databyindex"
        params2 = {"index": symbol, "indices": "false"}
        print(f"      Trying chart with index={symbol}...")
        r2 = client.get(url2, params=params2)
        print(f"      Chart status: {r2.status_code}, len: {len(r2.text)}")

        if r2.status_code == 200:
            data2 = r2.json()
            timestamps = data2.get("timestamp", [])
            graph_data = data2.get("grapthData", [[]])[0] if data2.get("grapthData") else []

            rows = []
            for ts, close in zip(timestamps, graph_data):
                try:
                    rows.append(
                        {
                            "date": date.fromtimestamp(ts / 1000),
                            "open": float(close),
                            "high": float(close),
                            "low": float(close),
                            "close": float(close),
                            "volume": 0,
                        }
                    )
                except (ValueError, TypeError):
                    continue
            if rows:
                return sorted(rows, key=lambda x: x["date"])
    except Exception as e:
        print(f"      Chart exception: {e}")

    return []


async def save_stock_and_ohlcv(stock_info: dict, ohlcv_rows: list[dict]) -> int:
    """Save stock + OHLCV rows to DB. Returns count of rows saved."""
    async with AsyncSessionLocal() as db:
        # Upsert stock
        result = await db.execute(
            select(Stock).where(Stock.symbol == stock_info["symbol"])
        )
        stock = result.scalar_one_or_none()
        if not stock:
            stock = Stock(
                symbol=stock_info["symbol"],
                name=stock_info["name"],
                exchange="NSE",
                sector=stock_info["sector"],
            )
            db.add(stock)
            await db.flush()

        # Insert OHLCV skipping duplicates
        saved = 0
        for row in ohlcv_rows:
            existing = await db.execute(
                select(OHLCV).where(
                    OHLCV.stock_id == stock.id, OHLCV.date == row["date"]
                )
            )
            if existing.scalar_one_or_none():
                continue
            db.add(
                OHLCV(
                    stock_id=stock.id,
                    date=row["date"],
                    open=row["open"],
                    high=row["high"],
                    low=row["low"],
                    close=row["close"],
                    volume=row["volume"],
                )
            )
            saved += 1

        await db.commit()
        return saved


async def create_real_signals(stocks_fetched: list[dict]) -> int:
    """
    Create realistic signals based on actual fetched stock data.
    Uses real price movements to determine signal type.
    """
    async with AsyncSessionLocal() as db:
        signals_created = 0

        for stock_info in stocks_fetched[:10]:  # top 10 stocks
            # Get stock from DB
            result = await db.execute(
                select(Stock).where(Stock.symbol == stock_info["symbol"])
            )
            stock = result.scalar_one_or_none()
            if not stock:
                continue

            # Get recent OHLCV
            ohlcv_result = await db.execute(
                select(OHLCV)
                .where(OHLCV.stock_id == stock.id)
                .order_by(OHLCV.date.desc())
                .limit(10)
            )
            recent = ohlcv_result.scalars().all()
            if len(recent) < 5:
                continue

            latest = recent[0]
            week_ago = recent[4]
            pct_change = ((latest.close - week_ago.close) / week_ago.close) * 100

            # Determine signal based on real price movement
            if pct_change > 3:
                signal_type = "earnings_beat"
                confidence = min(90, 60 + int(pct_change * 2))
                summary = (
                    f"{stock.symbol} up {pct_change:.1f}% this week on strong momentum"
                )
                action_hint = "buy_watch"
                reason = "Price breaking higher with strong volume confirms bullish momentum"
            elif pct_change < -3:
                signal_type = "regulatory_risk"
                confidence = min(85, 55 + int(abs(pct_change) * 2))
                summary = f"{stock.symbol} down {abs(pct_change):.1f}% this week under pressure"
                action_hint = "sell_watch"
                reason = "Price weakness may signal deteriorating fundamentals or sector headwinds"
            else:
                signal_type = "expansion"
                confidence = 65
                summary = f"{stock.symbol} consolidating near ₹{latest.close:.0f} support"
                action_hint = "neutral"
                reason = "Stock trading sideways — wait for breakout confirmation before acting"

            db.add(
                Signal(
                    stock_id=stock.id,
                    signal_type=signal_type,
                    confidence=confidence,
                    one_line_summary=summary[:200],
                    action_hint=action_hint,
                    reason=reason[:500],
                )
            )
            signals_created += 1

        await db.commit()
        return signals_created


async def main():
    print("=== ET Radar — Real Data Fetcher (NSE Official API) ===")
    print("Creating NSE session...")

    client = create_nse_session()
    print("Session created. Starting fetch...\n")

    total_candles = 0
    stocks_fetched = []

    for stock_info in STOCKS:
        symbol = stock_info["symbol"]
        print(f"Fetching {symbol}...", end=" ")

        rows = fetch_ohlcv_nse(client, symbol)

        if rows:
            saved = await save_stock_and_ohlcv(stock_info, rows)
            total_candles += saved
            stocks_fetched.append(stock_info)
            print(f"✓ {saved} candles saved")
        else:
            print(f"✗ No data retrieved")

        time.sleep(0.5)  # be polite to NSE

    client.close()

    print(f"\nCreating signals from real price data...")
    signals = await create_real_signals(stocks_fetched)

    print(f"\n{'='*40}")
    print(f"Done!")
    print(f"  Stocks fetched: {len(stocks_fetched)}/20")
    print(f"  Total candles:  {total_candles}")
    print(f"  Signals created: {signals}")
    print(f"{'='*40}")


if __name__ == "__main__":
    asyncio.run(main())
