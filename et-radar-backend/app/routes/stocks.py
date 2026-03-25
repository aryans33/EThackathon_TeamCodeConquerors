"""Stocks, OHLCV, filings, and bulk deals endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date, timedelta
from pydantic import BaseModel, ConfigDict
from app.database import get_db
from app.models.tables import Stock, OHLCV, Filing, BulkDeal

router = APIRouter(prefix="/api")


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class StockOut(BaseModel):
    id: int
    symbol: str
    name: str
    exchange: str
    sector: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class OHLCVOut(BaseModel):
    date: str      # MUST be str — TradingView breaks on datetime objects
    open: float
    high: float
    low: float
    close: float
    volume: int


class FilingOut(BaseModel):
    id: int
    date: str       # str not date object
    category: str
    raw_text: str
    source_url: Optional[str] = None


class StockSimpleOut(BaseModel):
    symbol: str
    name: str
    model_config = ConfigDict(from_attributes=True)


class BulkDealOut(BaseModel):
    id: int
    date: str       # str not date object
    client_name: str
    deal_type: str
    quantity: int
    price: float
    stock: Optional[StockSimpleOut] = None
    model_config = ConfigDict(from_attributes=True)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stocks", response_model=List[StockOut])
async def get_all_stocks(db: AsyncSession = Depends(get_db)):
    """GET /api/stocks — list all tracked stocks."""
    result = await db.execute(select(Stock))
    return result.scalars().all()


@router.get("/ohlcv", response_model=List[OHLCVOut])
async def get_ohlcv(
    symbol: str = Query(...),
    days: int = Query(365),
    db: AsyncSession = Depends(get_db)
):
    """GET /api/ohlcv?symbol=RELIANCE&days=365 — price history."""
    result = await db.execute(select(Stock).where(Stock.symbol == symbol.upper()))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    cutoff_date = date.today() - timedelta(days=days)
    result = await db.execute(
        select(OHLCV)
        .where(OHLCV.stock_id == stock.id, OHLCV.date >= cutoff_date)
        .order_by(OHLCV.date.asc())
    )
    history = result.scalars().all()

    return [
        OHLCVOut(
            date=row.date.strftime("%Y-%m-%d"),   # plain string
            open=row.open,
            high=row.high,
            low=row.low,
            close=row.close,
            volume=row.volume
        )
        for row in history
    ]


@router.get("/filings", response_model=List[FilingOut])
async def get_filings(
    symbol: Optional[str] = None,
    limit: int = Query(10),
    db: AsyncSession = Depends(get_db)
):
    """GET /api/filings?symbol=RELIANCE&limit=10 — corporate filings."""
    query = select(Filing).order_by(desc(Filing.date)).limit(limit)

    if symbol:
        stock_result = await db.execute(
            select(Stock).where(Stock.symbol == symbol.upper())
        )
        stock = stock_result.scalar_one_or_none()
        if stock:
            query = query.where(Filing.stock_id == stock.id)

    result = await db.execute(query)
    filings = result.scalars().all()

    return [
        FilingOut(
            id=f.id,
            date=f.date.strftime("%Y-%m-%d"),
            category=f.category,
            raw_text=(f.raw_text or "")[:500],   # truncated to 500 chars
            source_url=f.source_url,
        )
        for f in filings
    ]


@router.get("/bulk-deals", response_model=List[BulkDealOut])
async def get_bulk_deals(
    limit: int = Query(20),
    db: AsyncSession = Depends(get_db)
):
    """GET /api/bulk-deals?limit=20 — bulk deals with nested stock."""
    result = await db.execute(
        select(BulkDeal)
        .options(joinedload(BulkDeal.stock))
        .order_by(desc(BulkDeal.date))
        .limit(limit)
    )
    deals = result.scalars().all()

    return [
        BulkDealOut(
            id=d.id,
            date=d.date.strftime("%Y-%m-%d"),
            client_name=d.client_name,
            deal_type=d.deal_type,
            quantity=d.quantity,
            price=d.price,
            stock=StockSimpleOut(
                symbol=d.stock.symbol,
                name=d.stock.name
            ) if d.stock else None
        )
        for d in deals
    ]
