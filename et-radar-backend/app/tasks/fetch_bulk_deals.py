import httpx
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.tables import Stock, BulkDeal
from app.tasks import celery_app
from datetime import date
import asyncio

@celery_app.task(name="app.tasks.fetch_bulk_deals.fetch_bulk_deals")
def fetch_bulk_deals():
    asyncio.run(_fetch_bulk_deals_async())

async def _fetch_bulk_deals_async():
    url = "https://www.nseindia.com/api/bulk-deals"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Referer": "https://www.nseindia.com"
    }
    async with httpx.AsyncClient(timeout=20) as client:
        try:
            # NSE requires a session cookie — first hit the homepage
            await client.get("https://www.nseindia.com", headers=headers)
            res = await client.get(url, headers=headers)
            data = res.json()
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
