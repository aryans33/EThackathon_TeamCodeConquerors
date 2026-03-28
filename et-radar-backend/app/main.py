"""ET Radar FastAPI Application."""

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.routes import stocks, signals, patterns, portfolio, chat, status, filings, demo, auth, video


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Verify Groq connection
    try:
        from groq import Groq
        test_client = Groq(api_key=settings.GROQ_API_KEY)
        test = test_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "Say OK"}],
            max_tokens=5,
        )
        print(f"Groq connection OK: {test.choices[0].message.content}")
    except Exception as e:
        print(f"WARNING: Groq connection failed: {e}")

    key = settings.GROQ_API_KEY
    if not key:
        print("WARNING: GROQ_API_KEY is NOT set in .env!")
    else:
        print(f"GROQ_API_KEY detected: {key[:4]}...{key[-4:]}")

    print("ET Radar backend started.")
    yield


app = FastAPI(title="ET Radar API", lifespan=lifespan, version="1.0.0")

# ── CORS middleware — must be added BEFORE routers ────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", settings.FRONTEND_URL, "*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)


# ── Request logging middleware ────────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    ms = round((time.time() - start) * 1000)
    print(f"{request.method} {request.url.path} → {response.status_code} ({ms}ms)")
    return response


# ── Global exception handler ──────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Unhandled error on {request.url}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error — check logs"}
    )


# ── Health endpoint ───────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok"}


# ── Admin endpoints ───────────────────────────────────────────────────────────
@app.get("/api/admin/groq-usage")
async def get_groq_usage():
    """Track Groq API usage to monitor free-tier limits during hackathon."""
    import redis.asyncio as aioredis
    from datetime import datetime

    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        total = int(await r.get("groq:calls:total") or 0)
        today_key = f"groq:calls:{datetime.now().strftime('%Y-%m-%d')}"
        today = int(await r.get(today_key) or 0)
        await r.aclose()
        return {"total": total, "today": today}
    except Exception:
        return {"total": 0, "today": 0}


# ── Include Routers ───────────────────────────────────────────────────────────
app.include_router(stocks.router)
app.include_router(signals.router)
app.include_router(patterns.router)
app.include_router(portfolio.router)
app.include_router(chat.router)
app.include_router(status.router)
app.include_router(filings.router)
app.include_router(auth.router)
app.include_router(demo.router)
app.include_router(video.router)
