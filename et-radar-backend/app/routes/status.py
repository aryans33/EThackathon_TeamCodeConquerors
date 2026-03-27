"""System status endpoint with DB health snapshot."""

from datetime import timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tables import OHLCV, Signal, Stock

router = APIRouter(prefix="/api", tags=["status"])


@router.get("/status")
async def get_status(db: AsyncSession = Depends(get_db)):
    """Always returns 200 with health status and key counts."""
    try:
        stocks_tracked = int(await db.scalar(select(func.count(Stock.id))) or 0)
        signals_generated = int(await db.scalar(select(func.count(Signal.id))) or 0)
        ohlcv_rows = int(await db.scalar(select(func.count(OHLCV.id))) or 0)

        latest_signal_at = await db.scalar(select(func.max(Signal.created_at)))

        # chart_patterns table may not exist in all deployments.
        try:
            patterns_detected = int(
                await db.scalar(text("SELECT COUNT(*) FROM chart_patterns")) or 0
            )
        except Exception:
            patterns_detected = 0

        latest_signal_iso = None
        if latest_signal_at is not None:
            latest_signal_iso = (
                latest_signal_at.astimezone(timezone.utc)
                .isoformat()
                .replace("+00:00", "Z")
            )

        return {
            "status": "online",
            "stocks_tracked": stocks_tracked,
            "signals_generated": signals_generated,
            "patterns_detected": patterns_detected,
            "latest_signal_at": latest_signal_iso,
            "ohlcv_rows": ohlcv_rows,
            "db_connected": True,
        }
    except Exception:
        return {
            "status": "degraded",
            "db_connected": False,
            "stocks_tracked": 0,
            "signals_generated": 0,
            "patterns_detected": 0,
            "latest_signal_at": None,
            "ohlcv_rows": 0,
        }
