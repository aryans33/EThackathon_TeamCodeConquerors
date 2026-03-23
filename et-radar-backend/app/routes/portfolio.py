"""Portfolio analysis API endpoints."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tables import Portfolio
from app.agents.portfolio_analyser import analyse_portfolio

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


class PortfolioInput(BaseModel):
    session_id: str
    holdings: list[dict]  # [{symbol, qty, avg_price, buy_date}, ...]


@router.post("/analyse")
async def analyse(payload: PortfolioInput, db: AsyncSession = Depends(get_db)):
    """Analyse a user-submitted portfolio and return insights."""
    result = await analyse_portfolio(payload.holdings)

    # Persist to DB
    portfolio = Portfolio(
        session_id=payload.session_id,
        raw_json=json.dumps(payload.holdings),
        total_value=result.get("total_value", 0),
        xirr=result.get("xirr"),
    )
    db.add(portfolio)
    await db.commit()
    await db.refresh(portfolio)

    return {
        "portfolio_id": portfolio.id,
        **result,
    }


@router.get("/history")
async def portfolio_history(
    session_id: str = Query(..., description="Session ID to fetch history for"),
    db: AsyncSession = Depends(get_db),
):
    """Get portfolio analysis history for a session."""
    stmt = (
        select(Portfolio)
        .where(Portfolio.session_id == session_id)
        .order_by(Portfolio.created_at.desc())
    )
    result = await db.execute(stmt)
    portfolios = result.scalars().all()
    return [
        {
            "id": p.id,
            "total_value": p.total_value,
            "xirr": p.xirr,
            "created_at": p.created_at.isoformat(),
        }
        for p in portfolios
    ]


@router.get("/{portfolio_id}")
async def get_portfolio(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific portfolio analysis by ID."""
    stmt = select(Portfolio).where(Portfolio.id == portfolio_id)
    result = await db.execute(stmt)
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {
        "id": portfolio.id,
        "session_id": portfolio.session_id,
        "holdings": json.loads(portfolio.raw_json),
        "total_value": portfolio.total_value,
        "xirr": portfolio.xirr,
        "created_at": portfolio.created_at.isoformat(),
    }
