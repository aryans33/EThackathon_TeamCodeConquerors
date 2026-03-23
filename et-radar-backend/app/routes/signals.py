from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.database import get_db
from app.models.tables import Signal, Stock
from app.config import settings
import redis.asyncio as aioredis
import json

router = APIRouter(prefix="/api/signals")

# --- Schemas ---
class StockInfo(BaseModel):
    symbol: str
    name: str
    sector: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class SignalResponse(BaseModel):
    id: int
    stock: StockInfo
    signal_type: str
    confidence: int
    one_line_summary: str
    action_hint: str
    reason: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

async def get_redis():
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield r
    finally:
        await r.aclose()

# --- Endpoints ---

@router.get("/", response_model=List[SignalResponse])
async def get_opportunity_radar(
    limit: int = Query(20),
    action_hint: Optional[str] = Query(None, description="Filter by buy_watch, sell_watch, or neutral"),
    db: AsyncSession = Depends(get_db)
):
    query = (
        select(Signal)
        .options(joinedload(Signal.stock))
        .order_by(desc(Signal.confidence), desc(Signal.created_at))
        .limit(limit)
    )
    
    if action_hint:
        query = query.where(Signal.action_hint == action_hint)

    result = await db.execute(query)
    return result.scalars().all()

@router.get("/demo/seed")
async def seed_demo_signals(db: AsyncSession = Depends(get_db), r = Depends(get_redis)):
    """
    Seeds 10 realistic demo signals into DB if signals table is empty.
    """
    from sqlalchemy import func

    count = await db.scalar(select(func.count(Signal.id)))
    if count > 0:
        return {"message": f"Already have {count} signals, skipping seed"}

    demo_stocks = [
        {"symbol": "TATAMOTORS", "name": "Tata Motors Ltd", "sector": "Automobile"},
        {"symbol": "HDFCBANK", "name": "HDFC Bank", "sector": "Banking"},
        {"symbol": "INFY", "name": "Infosys Ltd", "sector": "IT"},
        {"symbol": "RELIANCE", "name": "Reliance Industries Ltd", "sector": "Energy"},
        {"symbol": "SBIN", "name": "State Bank of India", "sector": "Banking"},
    ]
    demo_signals = [
        {"signal_type": "earnings_beat", "confidence": 84, "one_line_summary": "Q3 PAT up 48% YoY beats estimates", "action_hint": "buy_watch", "reason": "Strong EV sales drove margin expansion beyond analyst consensus"},
        {"signal_type": "bulk_deal_buy", "confidence": 76, "one_line_summary": "Goldman Sachs buys 1.5cr shares at 1642", "action_hint": "buy_watch", "reason": "Institutional accumulation at support level signals confidence"},
        {"signal_type": "management_change", "confidence": 61, "one_line_summary": "COO resignation announced post market hours", "action_hint": "sell_watch", "reason": "Key leadership exit may signal strategic uncertainty"},
        {"signal_type": "expansion", "confidence": 71, "one_line_summary": "New green energy capex of 75000 cr announced", "action_hint": "buy_watch", "reason": "Large capex signals long term revenue visibility"},
        {"signal_type": "earnings_miss", "confidence": 68, "one_line_summary": "NPA provisions rise 22% dragging Q3 profit", "action_hint": "sell_watch", "reason": "Asset quality deterioration worse than street estimates"},
    ]

    for i, stock_data in enumerate(demo_stocks):
        # Use simple get/create logic
        stock_res = await db.execute(select(Stock).where(Stock.symbol == stock_data["symbol"]))
        stock = stock_res.scalar_one_or_none()
        if not stock:
            stock = Stock(**stock_data, exchange="NSE")
            db.add(stock)
            await db.flush()
        
        sig_data = demo_signals[i]
        db.add(Signal(stock_id=stock.id, **sig_data))
        
        # Invalidate pattern cache for this symbol and global list
        await r.delete(f"patterns:{stock.symbol}")

    await r.delete("patterns:all")
    await db.commit()
    return {"message": "Demo signals seeded successfully", "count": len(demo_signals)}

@router.get("/{signal_id}", response_model=SignalResponse)
async def get_signal_detail(signal_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Signal)
        .options(joinedload(Signal.stock))
        .where(Signal.id == signal_id)
    )
    signal = result.scalar_one_or_none()
    
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
        
    return signal
