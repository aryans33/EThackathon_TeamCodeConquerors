import httpx
from bs4 import BeautifulSoup
from rapidfuzz import process, fuzz
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.tables import Stock, Filing
from app.tasks import celery_app
from datetime import date
import asyncio

@celery_app.task(name="app.tasks.fetch_filings.fetch_filings")
def fetch_filings():
    asyncio.run(_fetch_filings_async())

async def _fetch_filings_async():
    url = "https://www.bseindia.com/corporates/ann.html"
    headers = {"User-Agent": "Mozilla/5.0 (compatible; ETRadar/1.0)"}

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            res = await client.get(url, headers=headers)
            soup = BeautifulSoup(res.text, "html.parser")
        except Exception as e:
            print(f"Filing fetch error: {e}")
            return

    async with AsyncSessionLocal() as db:
        # Load all stock names for fuzzy matching
        stocks_result = await db.execute(select(Stock))
        all_stocks = stocks_result.scalars().all()
        stock_names = {s.name: s.id for s in all_stocks}
        stock_symbols = {s.symbol: s.id for s in all_stocks}

        rows = soup.select("table tr")[1:50]  # grab latest 50
        for row in rows:
            cols = row.find_all("td")
            if len(cols) < 4:
                continue
            company_raw = cols[0].get_text(strip=True)
            category = cols[2].get_text(strip=True)
            text = cols[3].get_text(strip=True)[:5000]
            link_tag = cols[3].find("a")
            source_url = link_tag["href"] if link_tag and link_tag.get("href") else None

            # Fuzzy match company name to stock
            stock_id = None
            if company_raw:
                match = process.extractOne(company_raw, list(stock_names.keys()),
                                           scorer=fuzz.token_sort_ratio, score_cutoff=70)
                if match:
                    stock_id = stock_names[match[0]]

            # Skip if already stored today
            existing = await db.execute(
                select(Filing).where(
                    Filing.stock_id == stock_id,
                    Filing.category == category,
                    Filing.date == date.today()
                )
            )
            if existing.scalar_one_or_none():
                continue

            db.add(Filing(
                stock_id=stock_id,
                date=date.today(),
                category=category,
                raw_text=text,
                source_url=source_url
            ))
        await db.commit()
