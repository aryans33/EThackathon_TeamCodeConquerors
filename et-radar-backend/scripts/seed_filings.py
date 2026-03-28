import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select, text

from app.database import AsyncSessionLocal
from app.models.tables import Filing, Stock


TARGET_SYMBOLS = [
    "RELIANCE",
    "TCS",
    "INFY",
    "HDFCBANK",
    "ICICIBANK",
    "SBIN",
    "TATAMOTORS",
    "WIPRO",
    "LT",
    "BAJFINANCE",
]

COMPANY_MAP = {
    "RELIANCE": "Reliance Industries Limited",
    "TCS": "Tata Consultancy Services Limited",
    "INFY": "Infosys Limited",
    "HDFCBANK": "HDFC Bank Limited",
    "ICICIBANK": "ICICI Bank Limited",
    "SBIN": "State Bank of India",
    "TATAMOTORS": "Tata Motors Limited",
    "WIPRO": "Wipro Limited",
    "LT": "Larsen & Toubro Limited",
    "BAJFINANCE": "Bajaj Finance Limited",
}

FILING_TEMPLATES = [
    {
        "category": "Earnings",
        "title": "Board meeting to consider Q3 results",
        "summary": "Board meeting scheduled for quarterly results and margin outlook update with management commentary.",
        "slug": "board-meeting-q3-results",
    },
    {
        "category": "Management",
        "title": "Management change: CFO resignation announced",
        "summary": "Company disclosed CFO resignation with interim transition committee and search process details.",
        "slug": "management-change-cfo-resignation",
    },
    {
        "category": "Bulk Deals",
        "title": "Bulk deal: Goldman Sachs acquires 1.2cr shares",
        "summary": "Large institutional acquisition disclosed through exchange filing, indicating accumulation at current levels.",
        "slug": "bulk-deal-goldman-sachs",
    },
    {
        "category": "Expansion",
        "title": "Capex announcement: INR 8,000cr greenfield plant",
        "summary": "Board approved multi-year expansion capex for new capacity with phased commissioning timeline.",
        "slug": "capex-greenfield-plant",
    },
    {
        "category": "Earnings",
        "title": "Pre-quarter update indicates stable order book",
        "summary": "Company shared pre-quarter business update and reiterated guidance on revenue and operating margin.",
        "slug": "pre-quarter-update",
    },
    {
        "category": "Management",
        "title": "Board appoints new independent director",
        "summary": "Board approved appointment of independent director with sector expertise effective next month.",
        "slug": "new-independent-director",
    },
    {
        "category": "Bulk Deals",
        "title": "Block trade: domestic mutual fund raises stake",
        "summary": "Domestic institution disclosed block trade purchase in the company at a marginal premium.",
        "slug": "block-trade-domestic-mf",
    },
    {
        "category": "Expansion",
        "title": "New capacity addition approved for FY27",
        "summary": "Capacity expansion approved to meet demand growth with capex split across two financial years.",
        "slug": "capacity-addition-fy27",
    },
]


def build_payloads(today: datetime) -> list[dict]:
    payloads: list[dict] = []

    # Create 20 filings over the last 14 days, cycling symbols and templates.
    for i in range(20):
        symbol = TARGET_SYMBOLS[i % len(TARGET_SYMBOLS)]
        tpl = FILING_TEMPLATES[i % len(FILING_TEMPLATES)]
        filing_date = (today - timedelta(days=i % 14)).date()

        payloads.append(
            {
                "symbol": symbol,
                "company_name": COMPANY_MAP[symbol],
                "category": tpl["category"],
                "title": tpl["title"],
                "summary": tpl["summary"],
                "date": filing_date,
                "source_url": f"https://demo.et-radar.local/filings/{symbol.lower()}-{tpl['slug']}-{i + 1}",
            }
        )

    return payloads


async def seed_filings() -> None:
    now = datetime.now()
    payloads = build_payloads(now)

    async with AsyncSessionLocal() as session:
        # Clear existing rows to keep deterministic, non-duplicated demo output.
        await session.execute(text("TRUNCATE TABLE filings RESTART IDENTITY CASCADE"))

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
            filings_rows.append(
                {
                    "stock_id": symbol_to_id[p["symbol"]],
                    "date": p["date"],
                    "category": p["category"],
                    # Store title and summary in raw_text; API will split it cleanly.
                    "raw_text": f"{p['title']} || {p['summary']}",
                    "source_url": p["source_url"],
                }
            )

        # 3) Insert rows
        for row in filings_rows:
            session.add(Filing(**row))

        await session.commit()
        print(f"Seeded {len(filings_rows)} filings successfully")


if __name__ == "__main__":
    asyncio.run(seed_filings())
