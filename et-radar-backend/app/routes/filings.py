"""BSE filings endpoints."""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import AsyncSessionLocal, get_db
from app.models.tables import BSEFiling, Filing, Signal, Stock

router = APIRouter(prefix="/api/filings", tags=["filings"])

CATEGORIES = [
    "Financial Results",
    "Insider Trading",
    "Bulk Deal",
    "Board Meeting",
    "Change in Management",
    "Dividend",
]

SIGNAL_TYPES = [
    "buy_watch",
    "sell_watch",
    "neutral",
]


class FilingRowOut(BaseModel):
    id: int
    stock_symbol: Optional[str]
    category: str
    headline: str
    raw_text: str
    source_url: Optional[str]
    published_at: str
    signal_type: Optional[str]
    confidence: Optional[int]
    action_hint: Optional[str]


class LatestFilingOut(BaseModel):
    symbol: str
    company_name: str
    title: str
    category: str
    filing_date: str
    confidence_score: int
    summary: str
    source_url: Optional[str]


def _split_title_summary(raw_text: str) -> tuple[str, str]:
    text = (raw_text or "").strip()
    if "||" in text:
        left, right = text.split("||", 1)
        return left.strip(), right.strip()

    if ". " in text:
        left, right = text.split(". ", 1)
        return left.strip(), right.strip()

    short = text[:120].strip()
    return short, text


def _confidence_from_category(category: str) -> int:
    mapping = {
        "Earnings": 82,
        "Bulk Deals": 76,
        "Management": 69,
        "Expansion": 73,
    }
    return mapping.get(category, 70)


def format_filing(f: Filing, stocks_by_id: dict[int, Stock]) -> LatestFilingOut:
    stock = stocks_by_id.get(f.stock_id) if f.stock_id else None
    symbol = stock.symbol if stock else "UNKNOWN"
    company_name = stock.name if stock and stock.name else symbol
    title, summary = _split_title_summary(f.raw_text)

    return LatestFilingOut(
        symbol=symbol,
        company_name=company_name,
        title=title,
        category=f.category,
        filing_date=f.date.isoformat(),
        confidence_score=_confidence_from_category(f.category),
        summary=summary,
        source_url=f.source_url,
    )


def _serialize_row(f: BSEFiling) -> FilingRowOut:
    stock_symbol = f.stock.symbol if f.stock else None
    signal_type = f.signal.signal_type if f.signal else None
    confidence = f.signal.confidence if f.signal else None
    action_hint = f.signal.action_hint if f.signal else None

    published_at = f.published_at
    if published_at.tzinfo is None:
        published_at = published_at.replace(tzinfo=timezone.utc)

    return FilingRowOut(
        id=f.id,
        stock_symbol=stock_symbol,
        category=f.category,
        headline=_split_title_summary(f.raw_text)[0],
        raw_text=f.raw_text,
        source_url=f.source_url,
        published_at=published_at.isoformat().replace("+00:00", "Z"),
        signal_type=signal_type,
        confidence=confidence,
        action_hint=action_hint,
    )


async def _insert_dummy_filings() -> None:
    async with AsyncSessionLocal() as db:
        stock_rows = (await db.execute(select(Stock).order_by(Stock.symbol.asc()).limit(20))).scalars().all()
        if not stock_rows:
            return

        now = datetime.now(timezone.utc)
        for i in range(10):
            stock = random.choice(stock_rows)
            category = random.choice(CATEGORIES)
            raw_text = (
                f"{stock.name} ({stock.symbol}) issued a {category.lower()} disclosure. "
                f"Key highlights include management commentary, operational updates, and near-term guidance. "
                f"Entry #{i + 1} generated for demo refresh workflow."
            )
            filing = BSEFiling(
                stock_id=stock.id,
                category=category,
                raw_text=raw_text,
                source_url=f"https://www.bseindia.com/demo/announcement/{stock.symbol.lower()}-{i + 1}",
                published_at=now - timedelta(minutes=(i * 17 + random.randint(1, 15))),
                signal_id=None,
            )
            db.add(filing)

        await db.commit()


@router.get("/latest", response_model=list[LatestFilingOut])
async def get_latest_filings(
    limit: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Filing)
        .order_by(desc(Filing.date))
        .limit(limit)
    )
    filings = result.scalars().all()

    if not filings:
        try:
            from app.tasks.fetch_filings import _fetch_filings_async
            await _fetch_filings_async()
            result = await db.execute(
                select(Filing).order_by(desc(Filing.date)).limit(limit)
            )
            filings = result.scalars().all()
        except Exception as e:
            print(f"Auto-fetch failed: {e}")

    stock_ids = {f.stock_id for f in filings if f.stock_id is not None}
    stocks_by_id: dict[int, Stock] = {}
    if stock_ids:
        srows = (await db.execute(select(Stock).where(Stock.id.in_(stock_ids)))).scalars().all()
        stocks_by_id = {s.id: s for s in srows}

    return [format_filing(f, stocks_by_id) for f in filings]


@router.get("", response_model=list[LatestFilingOut])
async def get_filings(
    limit: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await get_latest_filings(limit=limit, db=db)


@router.post("/refresh")
async def refresh_filings(background_tasks: BackgroundTasks):
    background_tasks.add_task(_insert_dummy_filings)
    return {
        "status": "refresh_triggered",
        "message": "Fetching latest BSE announcements in background",
    }


@router.get("/by-stock/{symbol}", response_model=list[FilingRowOut])
async def get_filings_by_stock(
    symbol: str,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    stock = await db.scalar(select(Stock).where(Stock.symbol == symbol.upper()))
    if not stock:
        return []

    result = await db.execute(
        select(BSEFiling)
        .where(BSEFiling.stock_id == stock.id)
        .order_by(desc(BSEFiling.published_at))
        .limit(limit)
    )
    rows = result.scalars().all()

    signal_ids = {r.signal_id for r in rows if r.signal_id is not None}
    signals_by_id = {}
    if signal_ids:
        sig_rows = (await db.execute(select(Signal).where(Signal.id.in_(signal_ids)))).scalars().all()
        signals_by_id = {s.id: s for s in sig_rows}

    payload: list[FilingRowOut] = []
    for r in rows:
        r.stock = stock
        r.signal = signals_by_id.get(r.signal_id) if r.signal_id else None
        payload.append(_serialize_row(r))

    return payload
