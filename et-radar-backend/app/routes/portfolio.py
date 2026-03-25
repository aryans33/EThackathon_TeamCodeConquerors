"""Portfolio analysis endpoints — matches frontend contract exactly."""

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tables import Portfolio
from app.agents.portfolio_analyser import analyse_mutual_fund_pdf

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


class PortfolioOut(BaseModel):
    session_id: str
    total_value: float
    xirr: Optional[float]
    funds: list
    overlap: list
    expense_drag: float
    rebalancing_suggestion: str


@router.post("/upload", response_model=PortfolioOut)
async def upload_portfolio(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a CAMS or KFintech PDF statement.
    Multipart form: file (PDF) + session_id (string).
    Returns portfolio analysis with XIRR, fund breakdown, overlap, expense drag.
    """
    # Size check
    pdf_bytes = await file.read()
    if len(pdf_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large — maximum 10MB allowed")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Could not parse PDF - ensure it is a CAMS or KFintech statement"
        )

    result = await analyse_mutual_fund_pdf(pdf_bytes, session_id, db)
    return result


@router.get("/history")
async def portfolio_history(
    session_id: str,
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
        "data": json.loads(portfolio.raw_json),
        "total_value": portfolio.total_value,
        "xirr": portfolio.xirr,
        "created_at": portfolio.created_at.isoformat(),
    }
