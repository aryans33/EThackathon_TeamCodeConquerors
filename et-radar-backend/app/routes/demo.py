"""Demo data seeding endpoints."""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tables import BSEFiling, Signal, Stock

router = APIRouter(prefix="/api/demo", tags=["demo"])

DEMO_SIGNAL_TYPES = [
    "earnings_beat",
    "bulk_deal_activity",
    "technical_breakout",
    "insider_buying",
    "institutional_accumulation",
]
DEMO_ACTIONS = ["buy_watch", "sell_watch", "neutral"]
DEMO_FILING_CATEGORIES = [
    "Financial Results",
    "Insider Trading",
    "Bulk Deal",
    "Board Meeting",
    "Change in Management",
    "Dividend",
]


@router.get("/seed")
async def seed_demo(db: AsyncSession = Depends(get_db)):
    existing_signal_count = int(await db.scalar(select(func.count(Signal.id))) or 0)
    if existing_signal_count > 0:
        return {
            "seeded": False,
            "message": "Data already exists",
            "signal_count": existing_signal_count,
        }

    stocks = (await db.execute(select(Stock).order_by(Stock.symbol.asc()))).scalars().all()
    if not stocks:
        return {
            "seeded": False,
            "message": "No stocks available to seed demo data",
            "signal_count": 0,
        }

    now = datetime.now(timezone.utc)

    selected_stocks = stocks[:8] if len(stocks) >= 8 else [stocks[i % len(stocks)] for i in range(8)]

    created_signals: list[Signal] = []
    for idx, stock in enumerate(selected_stocks):
        signal = Signal(
            stock_id=stock.id,
            filing_id=None,
            signal_type=DEMO_SIGNAL_TYPES[idx % len(DEMO_SIGNAL_TYPES)],
            confidence=random.randint(55, 90),
            one_line_summary=f"{stock.symbol} shows {DEMO_SIGNAL_TYPES[idx % len(DEMO_SIGNAL_TYPES)].replace('_', ' ')} setup",
            action_hint=DEMO_ACTIONS[idx % len(DEMO_ACTIONS)],
            reason=(
                f"Demo signal for {stock.symbol} generated from synthetic market context "
                f"with momentum and event overlays."
            ),
            created_at=now - timedelta(hours=random.randint(1, 48)),
        )
        db.add(signal)
        created_signals.append(signal)

    await db.flush()

    for i in range(10):
        stock = stocks[i % len(stocks)]
        category = DEMO_FILING_CATEGORIES[i % len(DEMO_FILING_CATEGORIES)]
        filing = BSEFiling(
            stock_id=stock.id,
            category=category,
            raw_text=(
                f"{stock.name} ({stock.symbol}) issued a {category.lower()} update with "
                "material disclosures relevant for market participants."
            ),
            source_url=f"https://www.bseindia.com/demo/filing/{stock.symbol.lower()}-{i + 1}",
            published_at=now - timedelta(hours=random.randint(1, 48), minutes=random.randint(0, 59)),
            signal_id=created_signals[i % len(created_signals)].id if created_signals else None,
        )
        db.add(filing)

    await db.commit()

    return {
        "seeded": True,
        "message": "Demo data loaded",
        "signal_count": 8,
    }
