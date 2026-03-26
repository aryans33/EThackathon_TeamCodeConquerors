"""Chart pattern endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.agents.chart_patterns import analyse_stock_patterns
from app.models.tables import Stock
from app.config import settings
import redis.asyncio as aioredis
import json

router = APIRouter(prefix="/api")


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


@router.get("/chart-patterns")
async def get_chart_patterns(
    symbol: str = Query(...),
    db: AsyncSession = Depends(get_db),
    r=Depends(get_redis),
):
    """
    GET /api/chart-patterns?symbol=RELIANCE
    Always returns ALL 5 patterns.
    detected_today=True for active patterns, False otherwise.
    Returns [] for unknown symbols (not 404, not 500).
    """
    sym = symbol.upper()
    cache_key = f"patterns:{sym}"
    cached = await cache_get(r, cache_key)
    if cached:
        return json.loads(cached)

    results = await analyse_stock_patterns(sym, db)
    await cache_setex(r, cache_key, 21600, json.dumps(results))  # 6 hour cache
    return results


@router.get("/chart-patterns/all")
async def get_all_patterns_today(
    db: AsyncSession = Depends(get_db),
    r=Depends(get_redis),
):
    """
    GET /api/chart-patterns/all
    Runs pattern detection across all tracked symbols.
    Returns only stocks where at least 1 pattern has detected_today=True.
    Response includes stock name (not just symbol).
    """
    cache_key = "patterns:all"
    cached = await cache_get(r, cache_key)
    if cached:
        return json.loads(cached)

    # Load all stocks for name lookup
    stocks_result = await db.execute(select(Stock))
    stocks = {s.symbol: s.name for s in stocks_result.scalars().all()}

    results = []
    import asyncio

    for symbol in settings.symbols_list:
        sym = symbol.upper()
        patterns = await analyse_stock_patterns(sym, db)
        if any(p["detected_today"] for p in patterns):
            results.append({
                "symbol": sym,
                "name": stocks.get(sym, sym),
                "patterns": patterns,
            })
        await asyncio.sleep(0.2)

    await cache_setex(r, cache_key, 21600, json.dumps(results))  # 6 hour cache
    return results
