from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date, timedelta
from pydantic import BaseModel
from app.database import get_db
from app.models.tables import Stock, OHLCV, Filing, BulkDeal

router = APIRouter(prefix="/api/stocks")

# --- Schemas ---
class StockSchema(BaseModel):
    id: int
    symbol: str
    name: str
    exchange: str
    sector: str

    class Config:
        from_attributes = True

class OHLCVSchema(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: int

class FilingSchema(BaseModel):
    id: int
    date: date
    category: str
    raw_text: str
    source_url: Optional[str]

    class Config:
        from_attributes = True

class StockSimpleSchema(BaseModel):
    symbol: str
    name: str

class BulkDealSchema(BaseModel):
    id: int
    date: date
    client_name: str
    deal_type: str
    quantity: int
    price: float
    stock: Optional[StockSimpleSchema]

    class Config:
        from_attributes = True

# --- Endpoints ---

@router.get("/", response_model=List[StockSchema])
async def get_all_stocks(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Stock))
    return result.scalars().all()

@router.get("/ohlcv", response_model=List[OHLCVSchema])
async def get_ohlcv(
    symbol: str = Query(...), 
    days: int = Query(365), 
    db: AsyncSession = Depends(get_db)
):
    # Find stock first
    result = await db.execute(select(Stock).where(Stock.symbol == symbol))
    stock = result.scalar_one_or_none()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found")

    # Fetch last {days} records
    cutoff_date = date.today() - timedelta(days=days)
    result = await db.execute(
        select(OHLCV)
        .where(OHLCV.stock_id == stock.id, OHLCV.date >= cutoff_date)
        .order_by(OHLCV.date.asc())
    )
    history = result.scalars().all()
    
    return [
        OHLCVSchema(
            date=row.date.strftime("%Y-%m-%d"),
            open=row.open,
            high=row.high,
            low=row.low,
            close=row.close,
            volume=row.volume
        ) for row in history
    ]

@router.get("/filings", response_model=List[FilingSchema])
async def get_filings(
    symbol: Optional[str] = None, 
    limit: int = Query(10), 
    db: AsyncSession = Depends(get_db)
):
    query = select(Filing).order_by(desc(Filing.date)).limit(limit)
    
    if symbol:
        stock_result = await db.execute(select(Stock).where(Stock.symbol == symbol))
        stock = stock_result.scalar_one_or_none()
        if stock:
            query = query.where(Filing.stock_id == stock.id)

    result = await db.execute(query)
    filings = result.scalars().all()
    
    # Truncate raw_text to 500 chars for list view
    for filing in filings:
        if filing.raw_text:
            filing.raw_text = filing.raw_text[:500]
            
    return filings

@router.get("/bulk-deals", response_model=List[BulkDealSchema])
async def get_bulk_deals(limit: int = Query(20), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BulkDeal)
        .options(joinedload(BulkDeal.stock))
        .order_by(desc(BulkDeal.date))
        .limit(limit)
    )
    return result.scalars().all()
