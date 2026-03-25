"""Fetch bulk deals from NSE using stdlib urllib (no httpx dependency)."""

import asyncio
import json
import urllib.request
from datetime import date
from sqlalchemy import select  # type: ignore[import]
from app.database import AsyncSessionLocal  # type: ignore[import]
from app.models.tables import Stock, BulkDeal  # type: ignore[import]
from app.tasks import celery_app  # type: ignore[import]


@celery_app.task(name="app.tasks.fetch_bulk_deals.fetch_bulk_deals")
def fetch_bulk_deals():
    asyncio.run(_fetch_bulk_deals_async())


def _nse_get(url: str) -> bytes:
    """Sync NSE fetch with session cookie workaround."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://www.nseindia.com",
    }
    # Hit homepage first to get session cookie
    opener = urllib.request.build_opener()
    opener.addheaders = list(headers.items())
    opener.open("https://www.nseindia.com", timeout=10).read()
    with opener.open(url, timeout=20) as resp:
        return resp.read()


async def _fetch_bulk_deals_async():
    url = "https://www.nseindia.com/api/bulk-deals"
    try:
        raw = await asyncio.to_thread(lambda: _nse_get(url))  # type: ignore[arg-type]
        data = json.loads(raw)
    except Exception as e:
        print(f"Bulk deal fetch error: {e}")
        return

    async with AsyncSessionLocal() as db:
        stocks_result = await db.execute(select(Stock))
        symbol_map = {s.symbol: s.id for s in stocks_result.scalars().all()}

        for deal in data.get("data", []):
            symbol = deal.get("symbol", "").upper().replace(".NS", "")
            stock_id = symbol_map.get(symbol)
            deal_type = "buy" if str(deal.get("buySell", "")).upper().startswith("B") else "sell"

            try:
                db.add(BulkDeal(
                    stock_id=stock_id,
                    date=date.today(),
                    client_name=deal.get("clientName", "Unknown"),
                    deal_type=deal_type,
                    quantity=int(float(deal.get("quantityTraded", 0))),
                    price=float(deal.get("tradePrice", 0))
                ))
            except Exception:
                continue
        await db.commit()
