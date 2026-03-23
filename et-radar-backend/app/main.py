from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from app.database import get_db
from app.routes import stocks, signals, patterns, portfolio, chat

from contextlib import asynccontextmanager
from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Debug Groq Key
    key = settings.GROQ_API_KEY
    if not key:
        print("❌ WARNING: GROQ_API_KEY is NOT set in .env!")
    else:
        # Show first/last chars for safety
        print(f"✅ GROQ_API_KEY detected: {key[:4]}...{key[-4:]}")
    yield

app = FastAPI(title="ET Radar API", lifespan=lifespan, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Unhandled error on {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error — check logs"}
    )

# Health & Status Endpoint
@app.get("/api/status")
async def get_system_status(db: AsyncSession = Depends(get_db)):
    from app.models.tables import Signal, Stock
    
    stock_count = await db.scalar(select(func.count(Stock.id)))
    signal_count = await db.scalar(select(func.count(Signal.id)))
    latest_signal_result = await db.execute(
        select(Signal.created_at).order_by(Signal.created_at.desc()).limit(1)
    )
    latest_signal = latest_signal_result.scalar_one_or_none()
    
    return {
        "status": "ok",
        "stocks_tracked": stock_count,
        "signals_generated": signal_count,
        "latest_signal_at": latest_signal.isoformat() if latest_signal else None
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

# Include Routers
app.include_router(stocks.router)
app.include_router(signals.router)
app.include_router(patterns.router)
app.include_router(portfolio.router)
app.include_router(chat.router)
