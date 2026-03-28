import asyncio
import time
from datetime import date

import httpx
from nsetools import Nse
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.tables import OHLCV, Stock
from app.tasks import celery_app


nse = Nse()

@celery_app.task(name="app.tasks.fetch_prices.fetch_all_prices")
def fetch_all_prices():
    asyncio.run(_fetch_all_prices_async())


def _to_float(value, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    return float(str(value).replace(",", "").strip())


def _to_int(value, default: int = 0) -> int:
    if value is None or value == "":
        return default
    return int(float(str(value).replace(",", "").strip()))


def _fetch_with_nsetools(symbol: str):
    quote = nse.get_quote(symbol.lower())
    if quote and quote.get("lastPrice"):
        current_price = _to_float(quote.get("lastPrice"), 0.0)
        if current_price > 0:
            return {
                "open": _to_float(quote.get("open"), current_price),
                "high": _to_float(quote.get("dayHigh"), current_price),
                "low": _to_float(quote.get("dayLow"), current_price),
                "close": current_price,
                "volume": _to_int(quote.get("totalTradedVolume"), 0),
                "source": "nsetools",
            }
    return None


def _fetch_with_nse_api(symbol: str):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "*/*",
        "Referer": "https://www.nseindia.com",
    }

    with httpx.Client(headers=headers, follow_redirects=True, timeout=20.0) as c:
        c.get("https://www.nseindia.com")
        time.sleep(1)
        r = c.get(f"https://www.nseindia.com/api/quote-equity?symbol={symbol}")
        r.raise_for_status()
        data = r.json()

    price_info = data.get("priceInfo", {})
    last_price = _to_float(price_info.get("lastPrice"), 0.0)
    if last_price > 0:
        return {
            "open": _to_float(price_info.get("open"), last_price),
            "high": _to_float(price_info.get("intraDayHighLow", {}).get("max"), last_price),
            "low": _to_float(price_info.get("intraDayHighLow", {}).get("min"), last_price),
            "close": last_price,
            "volume": _to_int(data.get("securityWiseDP", {}).get("quantityTraded"), 0),
            "source": "nse_api",
        }
    return None

async def _fetch_all_prices_async():
    symbols = settings.symbols_list
    today = date.today()

    async with AsyncSessionLocal() as db:
        total = len(symbols)
        for idx, symbol in enumerate(symbols, start=1):
            try:
                print(f"[{idx}/{total}] Fetching {symbol}...")

                # Ensure stock exists (seed_ohlcv.py should have inserted base history/stocks).
                result = await db.execute(select(Stock).where(Stock.symbol == symbol.upper()))
                stock = result.scalar_one_or_none()
                if not stock:
                    print(f"WARN: {symbol} skipped (stock not found in DB)")
                    await asyncio.sleep(0.5)
                    continue

                payload = None

                # Method 1: nsetools
                try:
                    payload = await asyncio.to_thread(_fetch_with_nsetools, symbol)
                    if payload:
                        print(f"  -> {symbol}: nsetools OK")
                except Exception as e:
                    print(f"  -> {symbol}: nsetools failed ({e})")

                # Method 2: direct NSE API fallback
                if not payload:
                    try:
                        payload = await asyncio.to_thread(_fetch_with_nse_api, symbol)
                        if payload:
                            print(f"  -> {symbol}: NSE API fallback OK")
                    except Exception as e:
                        print(f"  -> {symbol}: NSE API fallback failed ({e})")

                if not payload:
                    print(f"WARN: {symbol} skipped")
                    await asyncio.sleep(0.5)
                    continue

                existing = await db.execute(
                    select(OHLCV).where(OHLCV.stock_id == stock.id, OHLCV.date == today)
                )
                today_row = existing.scalar_one_or_none()

                if today_row:
                    today_row.open = round(payload["open"], 2)
                    today_row.high = round(payload["high"], 2)
                    today_row.low = round(payload["low"], 2)
                    today_row.close = round(payload["close"], 2)
                    today_row.volume = int(payload["volume"])
                else:
                    db.add(
                        OHLCV(
                            stock_id=stock.id,
                            date=today,
                            open=round(payload["open"], 2),
                            high=round(payload["high"], 2),
                            low=round(payload["low"], 2),
                            close=round(payload["close"], 2),
                            volume=int(payload["volume"]),
                        )
                    )

                await db.commit()
                print(f"  -> {symbol}: today's OHLCV saved")
            except Exception as e:
                print(f"ERROR: {symbol} failed ({e})")
                await db.rollback()
            finally:
                await asyncio.sleep(0.5)
