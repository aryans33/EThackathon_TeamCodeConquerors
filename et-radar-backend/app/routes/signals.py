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


