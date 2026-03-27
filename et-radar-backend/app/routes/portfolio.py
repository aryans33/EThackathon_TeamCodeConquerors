"""Portfolio analysis endpoints — matches frontend contract exactly."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tables import PortfolioReport
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


async def _analyse_and_store(
    *,
    pdf_bytes: bytes,
    filename: str,
    session_id: str,
    db: AsyncSession,
) -> dict:
    if len(pdf_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large — maximum 10MB allowed")

    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Could not parse PDF - ensure it is a CAMS or KFintech statement"
        )

    result = await analyse_mutual_fund_pdf(pdf_bytes, session_id, db)

    report = PortfolioReport(
        session_id=session_id,
        raw_result=result,
        total_value=result.get("total_value"),
        xirr=result.get("xirr"),
        fund_count=len(result.get("funds", [])),
    )
    db.add(report)
    await db.commit()

    return result


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
    pdf_bytes = await file.read()
    return await _analyse_and_store(
        pdf_bytes=pdf_bytes,
        filename=file.filename or "",
        session_id=session_id,
        db=db,
    )


@router.post("/analyse", response_model=PortfolioOut)
async def analyse_portfolio(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """Alias endpoint used by some frontend flows."""
    pdf_bytes = await file.read()
    return await _analyse_and_store(
        pdf_bytes=pdf_bytes,
        filename=file.filename or "",
        session_id=session_id,
        db=db,
    )


@router.get("/history")
async def portfolio_history(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get portfolio analysis history for a session."""
    stmt = (
        select(PortfolioReport)
        .where(PortfolioReport.session_id == session_id)
        .order_by(PortfolioReport.created_at.desc())
    )
    result = await db.execute(stmt)
    reports = result.scalars().all()
    return [
        {
            "id": r.id,
            "session_id": r.session_id,
            "created_at": r.created_at.isoformat(),
            "total_value": r.total_value,
            "xirr": r.xirr,
            "fund_count": r.fund_count,
            "fund_names": [
                f.get("fund_name")
                for f in (r.raw_result.get("funds") or [])
                if isinstance(f, dict) and f.get("fund_name")
            ],
            "expense_drag": r.raw_result.get("expense_drag"),
        }
        for r in reports
    ]


@router.get("/{portfolio_id}")
async def get_portfolio(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific portfolio analysis by ID."""
    stmt = select(PortfolioReport).where(PortfolioReport.id == portfolio_id)
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {
        "id": report.id,
        "session_id": report.session_id,
        "data": report.raw_result,
        "total_value": report.total_value,
        "xirr": report.xirr,
        "created_at": report.created_at.isoformat(),
    }
