from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.agents.chart_patterns import analyse_stock_patterns
from app.config import settings
import redis.asyncio as aioredis
import json
import asyncio

router = APIRouter(prefix="/api/patterns")

async def get_redis():
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    try:
        yield r
    finally:
        await r.aclose()

@router.get("/")
async def get_chart_patterns(
    symbol: str, 
    db: AsyncSession = Depends(get_db),
    r = Depends(get_redis)
):
    """
    Returns all pattern analysis for a single stock symbol.
    """
    cache_key = f"patterns:{symbol.upper()}"
    cached = await r.get(cache_key)
    if cached:
        return json.loads(cached)

    results = await analyse_stock_patterns(symbol.upper(), db)
    # Cache for 6 hours
    await r.setex(cache_key, 21600, json.dumps(results))
    return results

@router.get("/all")
async def get_all_patterns_today(
    db: AsyncSession = Depends(get_db),
    r = Depends(get_redis)
):
    """
    Runs pattern detection across all tracked symbols.
    Returns only stocks with at least 1 pattern detected_today=True.
    """
    cache_key = "patterns:all"
    cached = await r.get(cache_key)
    if cached:
        return json.loads(cached)

    results = []
    # Using the symbols list from config
    for symbol in settings.symbols_list:
        patterns = await analyse_stock_patterns(symbol, db)
        if patterns:
            # We already only return detected_today=True from the agent logic
            results.append({"symbol": symbol, "patterns": patterns})
        # Micro-sleep to avoid hitting LLM rate limits
        await asyncio.sleep(0.3)

    await r.setex(cache_key, 21600, json.dumps(results))
    return results
