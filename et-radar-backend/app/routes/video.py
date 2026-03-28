"""Daily AI market video script endpoint."""

from __future__ import annotations

import asyncio
import datetime as dt
import json
import logging
import random
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends
from sqlalchemy import Date, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.tables import Filing, OHLCV, Signal, Stock

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
            "duration_sec": 12,
            "visual_type": "ipo_tracker",
            "headline": "IPO Watch",
            "voiceover": "In IPO watch, Ather Energy is opening soon with strong gray market traction, while recently listed names remain mixed. Track price band discipline and listing momentum.",
        },
        {
            "id": 6,
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
        "latest_filing": {
            "symbol": "RELIANCE",
            "category": "Earnings",
            "title": "Board approves Q4 capex roadmap and retail expansion update",
            "date": dt.date.today().isoformat(),
            "summary": "Management highlighted strong refining margins and maintained FY growth guidance.",
        },
        "fii_dii": {
            "flows": [],
            "fii_10d_net": 1240,
            "dii_10d_net": -340,
            "fii_trend": "net buyers",
            "summary": "FIIs were net buyers with INR 1,240 Cr net over 10 days",
            "data_source": "NSDL/CDSL (seeded for demo)",
            "generated_at": dt.date.today().isoformat(),
        },
        "ipo_tracker": {
            "upcoming": [
                {
                    "company": "Ather Energy Ltd",
                    "open_date": (dt.date.today() + dt.timedelta(days=3)).strftime("%d %b %Y"),
                    "close_date": (dt.date.today() + dt.timedelta(days=5)).strftime("%d %b %Y"),
                    "price_band": "INR 304 - INR 321",
                    "lot_size": 46,
                    "issue_size": "INR 2,981 Cr",
                    "sector": "EV / Clean Energy",
                    "gmp": "+INR 45 (14% premium)",
                    "subscription": "Opening soon",
                    "rating": "Subscribe",
                }
            ],
            "recently_listed": [
                {
                    "company": "Hexaware Technologies",
                    "list_date": (dt.date.today() - dt.timedelta(days=14)).strftime("%d %b %Y"),
                    "issue_price": 708,
                    "list_price": 755,
                    "current_price": 812,
                    "return_pct": 14.7,
                    "sector": "IT Services",
                }
            ],
            "data_source": "NSE/BSE IPO Calendar (seeded for demo)",
            "generated_at": dt.date.today().isoformat(),
        },
    },
}


@router.get("/fii-dii-flows")
async def get_fii_dii_flows():
    """Seeded but realistic FII/DII flow data for the last 10 calendar days."""
    today = dt.date.today()
    rng = random.Random(int(today.strftime("%Y%m%d")))

    flows: list[dict[str, Any]] = []
    fii_cumulative = 0.0
    dii_cumulative = 0.0

    for i in range(10, 0, -1):
        day = today - dt.timedelta(days=i)
        if day.weekday() >= 5:
            continue

        fii_net = round(rng.uniform(-3500, 4200), 0)
        dii_net = round(rng.uniform(-1200, 3800), 0)
        fii_cumulative += fii_net
        dii_cumulative += dii_net

        flows.append(
            {
                "date": day.strftime("%d %b"),
                "fii_net": fii_net,
                "dii_net": dii_net,
                "fii_cumulative": round(fii_cumulative, 0),
                "dii_cumulative": round(dii_cumulative, 0),
                "market_mood": "bullish" if (fii_net + dii_net) > 0 else "bearish",
            }
        )

    trend = "net buyers" if fii_cumulative > 0 else "net sellers"
    return {
        "flows": flows,
        "fii_10d_net": round(fii_cumulative, 0),
        "dii_10d_net": round(dii_cumulative, 0),
        "fii_trend": trend,
        "summary": f"FIIs were {trend} with INR {abs(fii_cumulative):,.0f} Cr net over 10 days",
        "data_source": "NSDL/CDSL (seeded for demo)",
        "generated_at": today.isoformat(),
    }


@router.get("/ipo-tracker")
async def get_ipo_tracker():
    """Upcoming and recently listed IPO tracker (seeded demo payload)."""
    today = dt.date.today()
    return {
        "upcoming": [
            {
                "company": "Ather Energy Ltd",
                "open_date": (today + dt.timedelta(days=3)).strftime("%d %b %Y"),
                "close_date": (today + dt.timedelta(days=5)).strftime("%d %b %Y"),
                "price_band": "INR 304 - INR 321",
                "lot_size": 46,
                "issue_size": "INR 2,981 Cr",
                "sector": "EV / Clean Energy",
                "gmp": "+INR 45 (14% premium)",
                "subscription": "Opening soon",
                "rating": "Subscribe",
            },
            {
                "company": "Groww (Nextbillion Technology)",
                "open_date": (today + dt.timedelta(days=12)).strftime("%d %b %Y"),
                "close_date": (today + dt.timedelta(days=14)).strftime("%d %b %Y"),
                "price_band": "TBA",
                "lot_size": None,
                "issue_size": "INR 6,000-8,000 Cr (est.)",
                "sector": "Fintech",
                "gmp": "TBA",
                "subscription": "Filing stage",
                "rating": "Watch",
            },
        ],
        "recently_listed": [
            {
                "company": "Hexaware Technologies",
                "list_date": (today - dt.timedelta(days=14)).strftime("%d %b %Y"),
                "issue_price": 708,
                "list_price": 755,
                "current_price": 812,
                "return_pct": 14.7,
                "sector": "IT Services",
            },
            {
                "company": "Denta Water",
                "list_date": (today - dt.timedelta(days=21)).strftime("%d %b %Y"),
                "issue_price": 294,
                "list_price": 310,
                "current_price": 287,
                "return_pct": -2.4,
                "sector": "Infrastructure",
            },
        ],
        "data_source": "NSE/BSE IPO Calendar (seeded for demo)",
        "generated_at": today.isoformat(),
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


def _extract_filing_title(raw_text: str) -> str:
    first_line = (raw_text or "").strip().splitlines()[0] if raw_text else ""
    title = first_line.strip(" -:\t")
    return title[:140] if title else "Corporate disclosure update"


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


async def _get_latest_filing(db: AsyncSession) -> dict[str, Any]:
    result = await db.execute(
        select(Filing, Stock.symbol)
        .join(Stock, Stock.id == Filing.stock_id, isouter=True)
        .order_by(desc(Filing.date), desc(Filing.created_at))
        .limit(1)
    )

    row = result.first()
    if not row:
        return DEMO_SCRIPT["data"]["latest_filing"]

    filing, symbol = row
    summary = (filing.raw_text or "").strip().replace("\n", " ")
    return {
        "symbol": symbol or "NSE",
        "category": filing.category or "Corporate",
        "title": _extract_filing_title(filing.raw_text),
        "date": filing.date.isoformat() if filing.date else dt.date.today().isoformat(),
        "summary": summary[:220] if summary else "Regulatory filing available on exchange disclosure portal.",
    }


def _build_prompt(
    nifty: dict[str, Any],
    sensex: dict[str, Any],
    top_gainers: list[dict[str, Any]],
    fii_flow: int,
    dii_flow: int,
    top_signal: dict[str, Any],
    latest_filing: dict[str, Any],
    fii_dii: dict[str, Any],
    ipo_tracker: dict[str, Any],
) -> str:
    gainers_list = [
        f"{g['symbol']} {'+' if g['change_pct'] >= 0 else ''}{g['change_pct']:.1f}%"
        for g in top_gainers
    ]

    latest_mood = "neutral"
    if fii_dii.get("flows"):
        latest_mood = fii_dii["flows"][-1].get("market_mood", "neutral")

    upcoming_ipo_names = ", ".join([i["company"] for i in ipo_tracker.get("upcoming", [])])
    listed_ipo_snaps = ", ".join(
        [
            f"{i['company']} ({'+' if i['return_pct'] > 0 else ''}{i['return_pct']}%)"
            for i in ipo_tracker.get("recently_listed", [])
        ]
    )

    return f"""Generate a 60-second market wrap video script based on today's Indian market data:

Index performance:
- Nifty 50: {nifty['value']} ({'+' if nifty['change_pct'] >= 0 else ''}{nifty['change_pct']}%)
- Sensex: {sensex['value']} ({'+' if sensex['change_pct'] >= 0 else ''}{sensex['change_pct']}%)

Top gaining stocks today: {gainers_list}

Institutional flows: FII {'+' if fii_flow >= 0 else ''}₹{fii_flow}Cr, DII {'+' if dii_flow >= 0 else ''}₹{dii_flow}Cr

FII/DII FLOWS (10-day): FIIs {fii_dii.get('fii_trend', 'flat')} with INR {abs(float(fii_dii.get('fii_10d_net', 0))):,.0f} Cr net.
DIIs net: INR {float(fii_dii.get('dii_10d_net', 0)):,.0f} Cr.
Today mood: {latest_mood}.

IPO PIPELINE:
Upcoming: {upcoming_ipo_names or 'NA'}
Recent listings: {listed_ipo_snaps or 'NA'}

Top AI signal: {top_signal['symbol']} - {top_signal['pattern']} - {top_signal['confidence'] * 100:.0f}% confidence

LATEST FILING:
{latest_filing.get('symbol', 'NSE')} | {latest_filing.get('category', 'Corporate')} | {latest_filing.get('title', 'Corporate disclosure update')}
Summary: {latest_filing.get('summary', 'Regulatory filing available on exchange disclosure portal.')}

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
        latest_filing = await _get_latest_filing(db)
        fii_dii = await get_fii_dii_flows()
        ipo_tracker = await get_ipo_tracker()

        prompt = _build_prompt(
            nifty=nifty,
            sensex=sensex,
            top_gainers=top_gainers,
            fii_flow=fii_flow,
            dii_flow=dii_flow,
            top_signal=top_signal,
            latest_filing=latest_filing,
            fii_dii=fii_dii,
            ipo_tracker=ipo_tracker,
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
                    "latest_filing": latest_filing,
                    "fii_dii": fii_dii,
                    "ipo_tracker": ipo_tracker,
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