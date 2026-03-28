# ET Radar

## Quick Demo Setup (Run In Order)

```bash
# Quick demo setup (run in order)
cd et-radar-backend
pip install -r requirements.txt --break-system-packages
alembic upgrade head
PYTHONPATH=. python scripts/seed_data.py
PYTHONPATH=. python scripts/seed_ohlcv.py
PYTHONPATH=. python scripts/seed_filings.py   # NEW - adds filing demo data
uvicorn app.main:app --reload &

cd ../et-radar-frontend
npm install
npm run dev
# Open http://localhost:3000
```

Windows PowerShell equivalent for `PYTHONPATH=.` commands:

```powershell
$env:PYTHONPATH='.'; python scripts/seed_data.py
$env:PYTHONPATH='.'; python scripts/seed_ohlcv.py
$env:PYTHONPATH='.'; python scripts/seed_filings.py
```

ET Radar is a full-stack market intelligence platform for Indian equities. It combines structured market data, filing/event insights, technical pattern detection, and LLM-powered reasoning so users can scan opportunities faster and ask portfolio-aware questions in plain language.

## Architecture At A Glance

1. Data layer:

- PostgreSQL stores stocks, OHLCV, filings, signals, chat history, and portfolio reports.
- Redis is used for API caching and Celery broker/result backend.

2. Backend layer (FastAPI + workers):

- FastAPI serves market, filings, patterns, radar, portfolio, chat, and video APIs.
- Celery runs async ingestion/radar jobs (`fetch_prices`, `fetch_filings`, `fetch_bulk_deals`, `run_opportunity_radar`).
- Groq powers chat reasoning and daily video script generation.

3. Frontend layer (Next.js):

- Dashboard, stock detail, filings, portfolio analyzer, AI chat, and AI market video pages.
- Consumes backend APIs via `http://localhost:8000/api`.

## What This Project Does

ET Radar is built as a monorepo with:

- A FastAPI backend for data APIs, AI/radar logic, and async background processing
- A Next.js frontend for dashboards, charting, and chat
- PostgreSQL for persistent market data, signals, and chat history
- Redis for caching and queue/broker support

Core product flows:

1. Ingest stock and event data
2. Generate AI-assisted opportunity signals
3. Detect technical chart patterns from OHLCV history
4. Generate AI market wrap video scenes from live DB context + LLM
5. Expose results to UI and to an SSE-based chat endpoint

## Repository Structure

```text
EThackathon_TeamCodeConquerors/
  et-radar-backend/   # FastAPI, SQLAlchemy, Celery, scripts, migrations
  et-radar-frontend/  # Next.js app (React + TypeScript)
  README.md
```

## Detailed Feature Breakdown

### 1. Opportunity Radar (Signals)

- Aggregates signal records with confidence scoring
- Supports pagination and optional filtering by action hint
- Uses Redis caching for frequently accessed radar payloads

Key API routes:

- `GET /api/opportunity-radar`
- `GET /api/opportunity-radar/{signal_id}`
- `GET /api/demo/seed` (demo signal seeding)

### 2. Chart Pattern Detection

- Runs pattern detection on individual symbols or across all tracked symbols
- Caches symbol/all-pattern responses in Redis
- Returns normalized payloads designed for frontend rendering

Key API routes:

- `GET /api/chart-patterns?symbol=RELIANCE`
- `GET /api/chart-patterns/all`

### 3. Stock, OHLCV, Filings, and Bulk Deals APIs

- Lists tracked stocks
- Returns historical OHLCV for charting and analytics
- Serves filings and bulk deal views for signal context

Key API routes:

- `GET /api/stocks`
- `GET /api/ohlcv?symbol=RELIANCE&days=365`
- `GET /api/filings?symbol=RELIANCE&limit=10`
- `GET /api/bulk-deals?limit=20`

### 4. Portfolio Analysis

- Uploads CAMS/KFintech PDF statements
- Extracts and analyzes holdings
- Returns metrics like XIRR, overlap, and rebalancing suggestions

Key API routes:

- `POST /api/portfolio/upload`
- `GET /api/portfolio/history?session_id=...`
- `GET /api/portfolio/{portfolio_id}`

### 5. AI Chat (RAG + Streaming)

- Uses contextual retrieval from signals, symbol mentions, and optional portfolio context
- Streams model output via Server-Sent Events (SSE)
- Persists user/assistant messages for session continuity

Key API route:

- `POST /api/chat/`

### 6. Health, Status, and Ops

- Health endpoint for uptime checks
- Status endpoint for stock/signal counters and latest signal timestamp
- Admin endpoint for Groq call usage counters

Key API routes:

- `GET /health`
- `GET /api/status`
- `GET /api/admin/groq-usage`

### 7. AI Market Video Engine

- Builds a daily market-wrap script using database context + Groq
- Enriches script context with FII/DII flows, IPO tracker data, and latest filing fallback details
- Uses Redis caching (30-minute TTL) to avoid repeated LLM calls during demos
- Always returns valid script JSON with fallback payload on generation/parsing errors

Key API route:

- `GET /api/video/daily-script`
- `GET /api/video/fii-dii-flows`
- `GET /api/video/ipo-tracker`

## Technology Stack

Backend:

- Python 3.10+
- FastAPI
- SQLAlchemy (async) + asyncpg
- Alembic
- Redis + Celery
- Groq SDK

Frontend:

- Next.js 14
- React 18 + TypeScript
- Tailwind CSS
- Recharts and Lightweight Charts

Infrastructure:

- PostgreSQL (local or managed, for example Neon)
- Redis (local or managed, for example Upstash)

## Local Development Setup

## 1. Clone and Enter Repo

```bash
git clone https://github.com/aryans33/EThackathon_TeamCodeConquerors.git
cd EThackathon_TeamCodeConquerors
```

## 2. Backend Setup

```bash
cd et-radar-backend
python -m venv venv
```

Windows PowerShell:

```bash
venv\Scripts\Activate.ps1
```

Install backend dependencies:

```bash
pip install -r requirements.txt
```

Create `.env` in `et-radar-backend` with at least:

```env
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
GROQ_API_KEY=your_groq_api_key
NSE_SYMBOLS=RELIANCE,TCS,INFY,HDFCBANK,ICICIBANK,WIPRO,SBIN,LT,TITAN,BAJFINANCE,ADANIENT,BHARTIARTL,ASIANPAINT,AXISBANK,KOTAKBANK,TATAMOTORS,HINDUNILVR,NESTLEIND,SUNPHARMA,MARUTI
FRONTEND_URL=http://localhost:3000
```

Run migrations:

```bash
alembic upgrade head
```

Run backend API:

```bash
uvicorn app.main:app --reload
```

Run Celery worker in another terminal:

```bash
celery -A app.tasks.celery_app worker --loglevel=info -P solo
```

Notes:

- For local Windows demos, `-P solo` is recommended.
- Upstash Redis is used via TLS (`rediss://`) in Celery worker config.

## 3. Frontend Setup

From repository root:

```bash
cd et-radar-frontend
npm install
npm run dev
```

Frontend default URL:

- `http://localhost:3000`

## Data Scripts

Inside `et-radar-backend`:

```bash
python scripts/seed_data.py
python scripts/seed_ohlcv.py
python scripts/seed_filings.py
python scripts/fetch_real_data.py
python scripts/test_chat.py
```

What they do:

- `seed_data.py`: inserts baseline/demo records
- `seed_ohlcv.py`: generates synthetic OHLCV history for tracked stocks
- `seed_filings.py`: inserts deterministic demo filings (idempotent)
- `fetch_real_data.py`: attempts market data ingestion for configured symbols
- `test_chat.py`: basic chat route/system check

## OHLCV Verification Checklist

After running `python scripts/seed_ohlcv.py`, verify record counts:

```bash
python -c "
import asyncio
from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.models.tables import OHLCV, Signal, Stock

async def check():
  async with AsyncSessionLocal() as db:
    stocks = await db.scalar(select(func.count(Stock.id)))
    rows = await db.scalar(select(func.count(OHLCV.id)))
    sigs = await db.scalar(select(func.count(Signal.id)))
    print(f'Stocks: {stocks}')
    print(f'OHLCV rows: {rows}')
    print(f'Signals: {sigs}')

asyncio.run(check())
"
```

Typical local expectations:

- `Stocks: 20`
- `OHLCV rows: 7000+`
- `Signals: 10+` (after radar/demo signal generation)

## Typical Run Order

1. Start PostgreSQL and Redis
2. Run migrations (`alembic upgrade head`)
3. Seed data (`seed_data.py`, `seed_ohlcv.py`, `seed_filings.py`)
4. Start backend API (`uvicorn`)
5. Start Celery worker
6. Start frontend (`npm run dev`)

## API Quick Reference

- `GET /health`
- `GET /api/status`
- `GET /api/stocks`
- `GET /api/ohlcv?symbol=RELIANCE&days=365`
- `GET /api/filings?limit=10`
- `GET /api/bulk-deals?limit=20`
- `GET /api/opportunity-radar`
- `GET /api/opportunity-radar/{signal_id}`
- `GET /api/chart-patterns?symbol=RELIANCE`
- `GET /api/chart-patterns/all`
- `POST /api/portfolio/upload`
- `GET /api/portfolio/history?session_id=abc`
- `GET /api/portfolio/{portfolio_id}`
- `POST /api/chat/`
- `GET /api/video/daily-script`
- `GET /api/video/fii-dii-flows`
- `GET /api/video/ipo-tracker`

## Troubleshooting

- If chat fails on startup, verify `GROQ_API_KEY` is valid and active.
- If worker cannot connect, verify `REDIS_URL`, `CELERY_BROKER_URL`, and `CELERY_RESULT_BACKEND`.
- If CORS issues appear, verify `FRONTEND_URL` matches your frontend origin.
- If no data appears in charts, check DB connectivity and run a data script.
- If `python scripts/seed_ohlcv.py` fails with `duplicate key value violates unique constraint "uq_ohlcv_stock_date"`, you likely have pre-existing OHLCV rows from a prior run or an older script version.
- Run commands from the backend directory and ensure `PYTHONPATH=.` is set for that shell before seeding.
- If you need a clean reseed, truncate only OHLCV data first, then rerun seeding:

```sql
TRUNCATE TABLE ohlcv RESTART IDENTITY;
```

- Frontend pages should call backend APIs through `et-radar-frontend/lib/api.ts` (base `http://localhost:8000/api` by default). Avoid using Next-local paths like `/api/portfolio/history` unless a Next route handler exists.

## Disclaimer

ET Radar is intended for educational and research use. It does not provide financial advice, investment recommendations, or guarantees of returns.
