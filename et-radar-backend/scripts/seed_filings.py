import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select, insert
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.database import AsyncSessionLocal
from app.models.tables import Filing, Stock


CATEGORIES = {
    "Earnings Beat",
    "Earnings Miss",
    "Bulk Deal",
    "Expansion",
    "Management Change",
    "Regulatory",
    "Dividend",
}


def build_payloads(today):
    return [
        {
            "symbol": "TATAMOTORS",
            "category": "Earnings Beat",
            "raw_text": "Q3 PAT up 48% YoY, beats street estimates by 12%",
            "date": (today - timedelta(days=2)).date(),
            "source_url": "https://demo.et-radar.local/filings/tatamotors-q3-beat",
        },
        {
            "symbol": "HDFCBANK",
            "category": "Bulk Deal",
            "raw_text": "Goldman Sachs acquires 1.5 crore shares at ₹1,642 per share",
            "date": (today - timedelta(days=3)).date(),
            "source_url": "https://demo.et-radar.local/filings/hdfcbank-bulk-deal",
        },
        {
            "symbol": "RELIANCE",
            "category": "Expansion",
            "raw_text": "Board approves ₹75,000 crore green energy capex over 3 years",
            "date": (today - timedelta(days=1)).date(),
            "source_url": "https://demo.et-radar.local/filings/reliance-green-capex",
        },
        {
            "symbol": "SBIN",
            "category": "Earnings Miss",
            "raw_text": "Q3 NPA provisions surge 22%, net profit below analyst consensus",
            "date": (today - timedelta(days=4)).date(),
            "source_url": "https://demo.et-radar.local/filings/sbin-q3-miss",
        },
        {
            "symbol": "INFY",
            "category": "Management Change",
            "raw_text": "COO resignation announced post market hours, transition plan unclear",
            "date": (today - timedelta(days=2)).date(),
            "source_url": "https://demo.et-radar.local/filings/infy-management-change",
        },
        {
            "symbol": "TCS",
            "category": "Earnings Beat",
            "raw_text": "Q3 revenue up 5.6% QoQ, deal wins at $10.2 billion TCV",
            "date": (today - timedelta(days=5)).date(),
            "source_url": "https://demo.et-radar.local/filings/tcs-q3-beat",
        },
        {
            "symbol": "TITAN",
            "category": "Expansion",
            "raw_text": "Tanishq to open 50 new stores in Tier 2 cities by FY26",
            "date": (today - timedelta(days=3)).date(),
            "source_url": "https://demo.et-radar.local/filings/titan-expansion",
        },
        {
            "symbol": "BAJFINANCE",
            "category": "Regulatory",
            "raw_text": "RBI circular on NBFC liquidity norms impacts AUM growth guidance",
            "date": (today - timedelta(days=6)).date(),
            "source_url": "https://demo.et-radar.local/filings/bajfinance-rbi-circular",
        },
        {
            "symbol": "ADANIENT",
            "category": "Bulk Deal",
            "raw_text": "LIC increases stake by 2.1%, buys 3.2 crore shares at ₹2,410",
            "date": (today - timedelta(days=1)).date(),
            "source_url": "https://demo.et-radar.local/filings/adanient-bulk-deal",
        },
        {
            "symbol": "WIPRO",
            "category": "Dividend",
            "raw_text": "Board declares interim dividend of ₹5 per share, record date next month",
            "date": (today - timedelta(days=7)).date(),
            "source_url": "https://demo.et-radar.local/filings/wipro-dividend",
        },
    ]


async def seed_filings() -> None:
    now = datetime.now()
    payloads = build_payloads(now)

    async with AsyncSessionLocal() as session:
        # 1) Resolve stock IDs by symbol
        symbols = [p["symbol"] for p in payloads]
        stock_rows = await session.execute(select(Stock.id, Stock.symbol).where(Stock.symbol.in_(symbols)))
        symbol_to_id = {row.symbol: row.id for row in stock_rows.all()}

        missing = [sym for sym in symbols if sym not in symbol_to_id]
        if missing:
            raise ValueError(f"Missing stock symbols in DB: {', '.join(missing)}")

        # 2) Build filing rows
        filings_rows = []
        for p in payloads:
            if p["category"] not in CATEGORIES:
                raise ValueError(f"Invalid category: {p['category']}")

            filings_rows.append(
                {
                    "stock_id": symbol_to_id[p["symbol"]],
                    "date": p["date"],
                    "category": p["category"],
                    "raw_text": p["raw_text"],
                    "source_url": p["source_url"],
                }
            )

        # 3) Pre-check to avoid duplicates even if unique constraints are absent
        seeded_count = 0
        for row in filings_rows:
            exists_stmt = select(Filing.raw_text).where(
                Filing.stock_id == row["stock_id"],
                Filing.date == row["date"],
                Filing.category == row["category"],
            )
            existing = await session.execute(exists_stmt)
            existing_texts = [r.raw_text for r in existing.all()]

            # Normalize currency token so old "Rs" rows are treated as duplicates
            normalized_new = row["raw_text"].replace("₹", "Rs ")
            if any(t.replace("₹", "Rs ") == normalized_new for t in existing_texts):
                continue

            # Requirement: use ON CONFLICT DO NOTHING
            stmt = pg_insert(Filing).values(**row).on_conflict_do_nothing()
            await session.execute(stmt)
            seeded_count += 1

        await session.commit()
        print(f"Seeded {seeded_count} filings successfully")


if __name__ == "__main__":
    asyncio.run(seed_filings())
