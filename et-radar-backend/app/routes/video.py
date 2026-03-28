"""Daily AI market video script endpoint."""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from sqlalchemy import Date, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.tables import OHLCV, Signal, Stock

router = APIRouter(prefix="/api/video", tags=["video"])
logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 30 * 60

DEMO_SCRIPT: dict[str, Any] = {
    "scenes": [
        {
            "id": 1,
            "duration_sec": 10,
            "visual_type": "nifty_summary",
            "headline": "Markets at a glance",
            "voiceover": "Indian markets closed mixed today. Nifty 50 gained 0.43% while broader markets showed selective buying in banking and energy sectors.",
        },
        {
            "id": 2,
            "duration_sec": 15,
            "visual_type": "race_chart",
            "headline": "Top gainers today",
            "voiceover": "TATAMOTORS led the gainers with a 2.1% surge following strong Q3 earnings. TCS and INFY also outperformed on renewed IT sector optimism.",
        },
        {
            "id": 3,
            "duration_sec": 12,
            "visual_type": "fii_dii",
            "headline": "Institutional flows",
            "voiceover": "Foreign investors bought 1,240 crore worth of equities today, their third consecutive day of buying. Domestic institutions were net sellers at 340 crores.",
        },
        {
            "id": 4,
            "duration_sec": 13,
            "visual_type": "signal_spotlight",
            "headline": "ET Radar signal of the day",
            "voiceover": "ET Radar's AI detected a high-confidence bullish trapezoid pattern on BAJFINANCE with 84% confidence. Institutional accumulation is supporting the setup.",
        },
        {
            "id": 5,
            "duration_sec": 10,
            "visual_type": "outro",
            "headline": "Powered by ET Radar",
            "voiceover": "That's your ET Radar market wrap. Upload your portfolio for personalized signals. Tomorrow's wrap generates automatically at market close.",
        },
    ],
    "data": {
        "nifty": {"value": 22847, "change_pct": 0.43},
        "sensex": {"value": 75200, "change_pct": 0.38},
        "top_gainers": [
            {"symbol": "TATAMOTORS", "change_pct": 2.1},
            {"symbol": "TCS", "change_pct": 1.8},
            {"symbol": "INFY", "change_pct": 1.4},
            {"symbol": "HDFCBANK", "change_pct": 0.9},
            {"symbol": "TITAN", "change_pct": 0.7},
        ],
        "fii_flow": 1240,
        "dii_flow": -340,
        "top_signal": {
            "symbol": "BAJFINANCE",
            "pattern": "Bullish Trapezoid",
            "confidence": 0.84,
        },
    },
}


def _strip_code_fences(text: str) -> str:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines:
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    return cleaned


def _normalize_confidence(raw_confidence: Any) -> float:
    try:
        value = float(raw_confidence)
    except (TypeError, ValueError):
        return 0.8

    if value > 1:
        value = value / 100.0

    return max(0.0, min(value, 1.0))


def _pattern_from_signal_type(signal_type: str | None) -> str:
    if not signal_type:
        return "Momentum Breakout"
    return signal_type.replace("_", " ").title()


async def _get_market_date(db: AsyncSession) -> dt.date | None:
    today = dt.date.today()
    has_today = await db.scalar(
        select(func.count())
        .select_from(OHLCV)
        .where(OHLCV.date == today)
    )
    if has_today:
        return today

    return await db.scalar(select(func.max(OHLCV.date).cast(Date)))


async def _get_top_gainers(db: AsyncSession, market_date: dt.date | None) -> list[dict[str, Any]]:
    if market_date is None:
        return DEMO_SCRIPT["data"]["top_gainers"]

    ohlcv_with_prev = select(
        OHLCV.stock_id.label("stock_id"),
        OHLCV.date.label("trade_date"),
        OHLCV.close.label("close"),
        func.lag(OHLCV.close)
        .over(partition_by=OHLCV.stock_id, order_by=OHLCV.date)
        .label("prev_close"),
    ).subquery()

    change_pct_expr = (
        (ohlcv_with_prev.c.close - ohlcv_with_prev.c.prev_close)
        / ohlcv_with_prev.c.prev_close
        * 100.0
    )

    result = await db.execute(
        select(
            Stock.symbol,
            change_pct_expr.label("change_pct"),
        )
        .select_from(ohlcv_with_prev)
        .join(Stock, Stock.id == ohlcv_with_prev.c.stock_id)
        .where(ohlcv_with_prev.c.trade_date == market_date)
        .where(ohlcv_with_prev.c.prev_close.is_not(None))
        .where(ohlcv_with_prev.c.prev_close != 0)
        .order_by(desc(change_pct_expr))
        .limit(5)
    )

    rows = result.all()
    if not rows:
        return DEMO_SCRIPT["data"]["top_gainers"]

    payload: list[dict[str, Any]] = []
    for row in rows:
        payload.append(
            {
                "symbol": row.symbol,
                "change_pct": round(float(row.change_pct), 2),
            }
        )
    return payload


async def _get_latest_signals(db: AsyncSession) -> list[dict[str, Any]]:
    result = await db.execute(
        select(Signal, Stock.symbol)
        .join(Stock, Stock.id == Signal.stock_id)
        .order_by(desc(Signal.created_at))
        .limit(3)
    )

    rows = result.all()
    signals: list[dict[str, Any]] = []
    for signal, symbol in rows:
        signals.append(
            {
                "symbol": symbol,
                "pattern": _pattern_from_signal_type(signal.signal_type),
                "confidence": _normalize_confidence(signal.confidence),
            }
        )

    return signals


def _build_prompt(
    nifty: dict[str, Any],
    sensex: dict[str, Any],
    top_gainers: list[dict[str, Any]],
    fii_flow: int,
    dii_flow: int,
    top_signal: dict[str, Any],
) -> str:
    gainers_list = [
        f"{g['symbol']} {'+' if g['change_pct'] >= 0 else ''}{g['change_pct']:.1f}%"
        for g in top_gainers
    ]

    return f"""Generate a 60-second market wrap video script based on today's Indian market data:

Index performance:
- Nifty 50: {nifty['value']} ({'+' if nifty['change_pct'] >= 0 else ''}{nifty['change_pct']}%)
- Sensex: {sensex['value']} ({'+' if sensex['change_pct'] >= 0 else ''}{sensex['change_pct']}%)

Top gaining stocks today: {gainers_list}

Institutional flows: FII {'+' if fii_flow >= 0 else ''}₹{fii_flow}Cr, DII {'+' if dii_flow >= 0 else ''}₹{dii_flow}Cr

Top AI signal: {top_signal['symbol']} - {top_signal['pattern']} - {top_signal['confidence'] * 100:.0f}% confidence

Return ONLY valid JSON with this exact structure, no markdown, no explanation:
{{
  "scenes": [
    {{"id": 1, "duration_sec": 10, "visual_type": "nifty_summary", "headline": "Markets at a glance", "voiceover": "2-3 sentences about index performance"}},
    {{"id": 2, "duration_sec": 15, "visual_type": "race_chart", "headline": "Top gainers today", "voiceover": "2-3 sentences about top gaining stocks"}},
    {{"id": 3, "duration_sec": 12, "visual_type": "fii_dii", "headline": "Institutional flows", "voiceover": "2 sentences about FII/DII activity"}},
    {{"id": 4, "duration_sec": 13, "visual_type": "signal_spotlight", "headline": "ET Radar signal of the day", "voiceover": "2-3 sentences about the top signal"}},
    {{"id": 5, "duration_sec": 10, "visual_type": "outro", "headline": "Powered by ET Radar", "voiceover": "1-2 sentences closing and call to action"}}
  ]
}}"""


async def _generate_scenes_with_groq(prompt: str) -> list[dict[str, Any]] | None:
    from groq import Groq

    system_prompt = (
        "You are a professional Indian financial news anchor for ET Markets. "
        "Write concise, factual, engaging 60-second market wrap scripts for retail investors. "
        "Use Indian financial terminology: crores not millions, ₹ not $, NSE/BSE not NYSE."
    )

    def _call_groq() -> str:
        client = Groq(api_key=settings.GROQ_API_KEY)
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            max_tokens=1000,
            temperature=0.7,
        )
        return completion.choices[0].message.content or ""

    raw = await asyncio.to_thread(_call_groq)
    cleaned = _strip_code_fences(raw)

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.exception("Failed to parse Groq JSON response", extra={"raw": raw})
        return None

    scenes = parsed.get("scenes") if isinstance(parsed, dict) else None
    if not isinstance(scenes, list) or not scenes:
        return None

    return scenes


@router.get("/daily-script")
async def get_daily_video_script(db: AsyncSession = Depends(get_db)):
    cache_key = f"video:daily_script:{dt.date.today().isoformat()}"
    redis_client = None

    try:
        redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        cached = await redis_client.get(cache_key)
        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                await redis_client.delete(cache_key)

        nifty = {"value": 22847, "change_pct": 0.43}
        sensex = {"value": 75200, "change_pct": 0.38}
        fii_flow = 1240
        dii_flow = -340

        market_date = await _get_market_date(db)
        top_gainers = await _get_top_gainers(db, market_date)
        latest_signals = await _get_latest_signals(db)
        top_signal = latest_signals[0] if latest_signals else DEMO_SCRIPT["data"]["top_signal"]

        prompt = _build_prompt(
            nifty=nifty,
            sensex=sensex,
            top_gainers=top_gainers,
            fii_flow=fii_flow,
            dii_flow=dii_flow,
            top_signal=top_signal,
        )

        scenes = await _generate_scenes_with_groq(prompt)
        if scenes is None:
            payload = DEMO_SCRIPT
        else:
            payload = {
                "scenes": scenes,
                "data": {
                    "nifty": nifty,
                    "sensex": sensex,
                    "top_gainers": top_gainers,
                    "fii_flow": fii_flow,
                    "dii_flow": dii_flow,
                    "top_signal": top_signal,
                },
            }

        await redis_client.setex(cache_key, CACHE_TTL_SECONDS, json.dumps(payload))
        return payload

    except Exception:
        logger.exception("Failed to generate daily video script")
        return DEMO_SCRIPT

    finally:
        if redis_client is not None:
            try:
                await redis_client.aclose()
            except Exception:
                pass