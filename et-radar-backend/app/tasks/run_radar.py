"""Celery task: run the opportunity radar on recent unprocessed filings."""

import asyncio
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, and_
from sqlalchemy.orm import joinedload

from app.database import AsyncSessionLocal
from app.models.tables import Filing, Signal, Alert, Stock
from app.agents.opportunity_radar import analyze_filing
from app.tasks import celery_app
from app.config import settings
import redis.asyncio as aioredis


@celery_app.task(name="app.tasks.run_radar.run_opportunity_radar")
def run_opportunity_radar():
    asyncio.run(_run_radar_async())


async def _run_radar_async():
    async with AsyncSessionLocal() as db:
        # Get filings from last 24 hours that have no signal yet
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

        existing_signals_query = select(Signal.filing_id).where(Signal.filing_id.isnot(None))

        filings_result = await db.execute(
            select(Filing)
            .options(joinedload(Filing.stock))
            .where(
                and_(
                    Filing.created_at >= cutoff,
                    ~Filing.id.in_(existing_signals_query)
                )
            )
            .limit(50)
        )
        filings = filings_result.scalars().all()

        for i, filing in enumerate(filings):
            if filing.stock is None:
                continue

            # Rate limit: 0.2s between calls (Groq RPM limit)
            if i > 0:
                time.sleep(0.2)

            # Run sync analyze_filing in thread (it does sync Groq call)
            signal = await asyncio.to_thread(analyze_filing, filing, filing.stock)

            if signal is None:
                continue

            db.add(signal)
            await db.flush()  # get signal.id

            # Create alert for high confidence signals
            if signal.confidence >= 70:
                db.add(Alert(signal_id=signal.id, sent=False))

        await db.commit()

        # Invalidate Redis caches
        try:
            r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            # Invalidate radar signal cache
            async for key in r.scan_iter("signals:radar:*"):
                await r.delete(key)
            # Invalidate pattern caches
            async for key in r.scan_iter("patterns:*"):
                await r.delete(key)
            await r.aclose()
        except Exception as e:
            print(f"Redis cache invalidate failed: {e}")
