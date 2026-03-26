"""Signals / Opportunity Radar endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, desc, func
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from app.database import get_db
from app.models.tables import Signal, Stock
from app.config import settings
import redis.asyncio as aioredis
import json

router = APIRouter(prefix="/api")


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class StockInfo(BaseModel):
    symbol: str
    name: str
    sector: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class SignalOut(BaseModel):
    id: int
    stock: StockInfo
    signal_type: str
    confidence: int
    one_line_summary: str
    action_hint: str
    reason: str
    created_at: str   # ISO string, not datetime object
    model_config = ConfigDict(from_attributes=True)


class RadarPage(BaseModel):
    data: List[SignalOut]
    total: int
    page: int
    pages: int


async def get_redis():
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield r
    finally:
        try:
            await r.aclose()
        except Exception:
            pass


async def cache_get(r, key: str):
    try:
        return await r.get(key)
    except Exception:
        return None


async def cache_setex(r, key: str, ttl: int, payload: str):
    try:
        await r.setex(key, ttl, payload)
    except Exception:
        pass


async def cache_delete(r, key: str):
    try:
        await r.delete(key)
    except Exception:
        pass


async def cache_keys(r, pattern: str):
    try:
        return await r.keys(pattern)
    except Exception:
        return []


def signal_to_dict(s: Signal) -> dict:
    return {
        "id": s.id,
        "stock": {
            "symbol": s.stock.symbol if s.stock else "UNKNOWN",
            "name": s.stock.name if s.stock else "Unknown",
            "sector": s.stock.sector if s.stock else None,
        },
        "signal_type": s.signal_type,
        "confidence": s.confidence,
        "one_line_summary": s.one_line_summary,
        "action_hint": s.action_hint,
        "reason": s.reason,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/opportunity-radar")
async def get_opportunity_radar(
    limit: int = Query(20, le=50),
    page: int = Query(1, ge=1),
    action_hint: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    r=Depends(get_redis),
):
    """
    GET /api/opportunity-radar
    Returns signals sorted by confidence desc.
    Supports action_hint filter (buy_watch, sell_watch, neutral).
    Supports pagination via page + limit.
    """
    cache_key = f"signals:radar:{limit}:{page}:{action_hint or 'all'}"
    cached = await cache_get(r, cache_key)
    if cached:
        return json.loads(cached)

    # Count total
    count_query = select(func.count(Signal.id))
    if action_hint:
        count_query = count_query.where(Signal.action_hint == action_hint)
    total = await db.scalar(count_query)

    offset = (page - 1) * limit
    query = (
        select(Signal)
        .options(joinedload(Signal.stock))
        .order_by(desc(Signal.confidence), desc(Signal.created_at))
        .offset(offset)
        .limit(limit)
    )
    if action_hint:
        query = query.where(Signal.action_hint == action_hint)

    result = await db.execute(query)
    signals = result.scalars().all()

    data = [signal_to_dict(s) for s in signals]
    pages = max(1, (total + limit - 1) // limit)

    response = {
        "data": data,
        "total": total,
        "page": page,
        "pages": pages,
    }
    await cache_setex(r, cache_key, 300, json.dumps(response))   # 5-min cache
    return response


@router.get("/opportunity-radar/{signal_id}")
async def get_signal_detail(signal_id: int, db: AsyncSession = Depends(get_db)):
    """GET /api/opportunity-radar/{id} — single signal detail."""
    result = await db.execute(
        select(Signal)
        .options(joinedload(Signal.stock))
        .where(Signal.id == signal_id)
    )
    signal = result.scalar_one_or_none()
    if not signal:
        raise HTTPException(status_code=404, detail="Signal not found")
    return signal_to_dict(signal)


@router.get("/demo/seed")
async def seed_demo_signals(db: AsyncSession = Depends(get_db), r=Depends(get_redis)):
    """
    Seeds 5 demo signals into DB.
    First call: inserts. Subsequent calls: skips if >=5 signals exist.
    """
    count = await db.scalar(select(func.count(Signal.id)))
    if count >= 5:
        return {"message": f"Already have {count} signals, skipping seed"}

    demo_stocks = [
        {"symbol": "TATAMOTORS", "name": "Tata Motors Ltd", "sector": "Automobile"},
        {"symbol": "HDFCBANK", "name": "HDFC Bank", "sector": "Banking"},
        {"symbol": "INFY", "name": "Infosys Ltd", "sector": "IT"},
        {"symbol": "RELIANCE", "name": "Reliance Industries Ltd", "sector": "Energy"},
        {"symbol": "SBIN", "name": "State Bank of India", "sector": "Banking"},
    ]
    demo_signals = [
        {"signal_type": "earnings_beat", "confidence": 84,
         "one_line_summary": "Q3 PAT up 48% YoY beats estimates",
         "action_hint": "buy_watch",
         "reason": "Strong EV sales drove margin expansion beyond analyst consensus"},
        {"signal_type": "bulk_deal_buy", "confidence": 76,
         "one_line_summary": "Goldman Sachs buys 1.5cr shares at 1642",
         "action_hint": "buy_watch",
         "reason": "Institutional accumulation at support level signals confidence"},
        {"signal_type": "management_change", "confidence": 61,
         "one_line_summary": "COO resignation announced post market hours",
         "action_hint": "sell_watch",
         "reason": "Key leadership exit may signal strategic uncertainty"},
        {"signal_type": "expansion", "confidence": 71,
         "one_line_summary": "New green energy capex of 75000 cr announced",
         "action_hint": "buy_watch",
         "reason": "Large capex signals long term revenue visibility"},
        {"signal_type": "earnings_miss", "confidence": 68,
         "one_line_summary": "NPA provisions rise 22% dragging Q3 profit",
         "action_hint": "sell_watch",
         "reason": "Asset quality deterioration worse than street estimates"},
    ]

    for i, stock_data in enumerate(demo_stocks):
        stock_res = await db.execute(
            select(Stock).where(Stock.symbol == stock_data["symbol"])
        )
        stock = stock_res.scalar_one_or_none()
        if not stock:
            stock = Stock(**stock_data, exchange="NSE")
            db.add(stock)
            await db.flush()

        db.add(Signal(stock_id=stock.id, **demo_signals[i]))
        await cache_delete(r, f"patterns:{stock_data['symbol']}")

    # Invalidate radar cache
    for key in await cache_keys(r, "signals:radar:*"):
        await cache_delete(r, key)
    await cache_delete(r, "patterns:all")
    await db.commit()
    return {"message": "Demo signals seeded successfully", "count": len(demo_signals)}
