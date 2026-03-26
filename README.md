# ET Radar

ET Radar is a full-stack market intelligence platform for Indian equities. It combines structured market data, filing/event insights, technical pattern detection, and LLM-powered reasoning so users can scan opportunities faster and ask portfolio-aware questions in plain language.

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
4. Expose results to UI and to an SSE-based chat endpoint

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
celery -A app.tasks.celery_app worker --loglevel=info -P eventlet
```

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
python scripts/fetch_real_data.py
python scripts/test_chat.py
```

What they do:

- `seed_data.py`: inserts baseline/demo records
- `fetch_real_data.py`: attempts market data ingestion for configured symbols
- `test_chat.py`: basic chat route/system check

## Typical Run Order

1. Start PostgreSQL and Redis
2. Start backend API (`uvicorn`)
3. Start Celery worker
4. Start frontend (`npm run dev`)
5. Seed/fetch data scripts as needed

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

## Troubleshooting

- If chat fails on startup, verify `GROQ_API_KEY` is valid and active.
- If worker cannot connect, verify `REDIS_URL`, `CELERY_BROKER_URL`, and `CELERY_RESULT_BACKEND`.
- If CORS issues appear, verify `FRONTEND_URL` matches your frontend origin.
- If no data appears in charts, check DB connectivity and run a data script.

## Disclaimer

ET Radar is intended for educational and research use. It does not provide financial advice, investment recommendations, or guarantees of returns.
