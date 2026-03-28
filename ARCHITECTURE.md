# ET Radar Architecture

## 1. System Overview

ET Radar is a full-stack market intelligence platform with:

- Next.js frontend for dashboard, filings, stock detail, portfolio analysis, chat, and AI video playback.
- FastAPI backend exposing market and AI endpoints.
- PostgreSQL for persistent market and user data.
- Redis for caching and Celery broker/result backend.
- Celery workers for asynchronous ingestion and radar generation.
- Groq LLM for chat and video script generation.

## 2. Runtime Topology

```text
Browser (localhost:3000)
        |
        v
Next.js Frontend (et-radar-frontend)
        |
        v
FastAPI (localhost:8000)
  |- Routers: auth, stocks, signals, patterns, filings, portfolio, chat, status, demo, video
  |- Agents: chart_patterns, opportunity_radar, portfolio_analyser, rag_chat
  |
  +--> PostgreSQL (stocks, ohlcv, filings, signals, users, chat, reports)
  +--> Redis (cache keys + Celery broker/result)
  +--> Groq API (llama-3.3-70b-versatile)

Celery Worker + Beat
  |- fetch_prices
  |- fetch_filings
  |- fetch_bulk_deals
  |- run_opportunity_radar
```

## 3. Backend Architecture

### 3.1 API Layer

- Framework: FastAPI with CORS middleware and global exception handling.
- Database access: SQLAlchemy async sessions.
- Router pattern: each domain feature has isolated route module.

Primary routes:

- `/api/stocks`
- `/api/ohlcv`
- `/api/opportunity-radar`
- `/api/chart-patterns`
- `/api/filings` and `/api/filings/latest`
- `/api/portfolio/*`
- `/api/chat/` (streaming)
- `/api/video/daily-script`
- `/api/video/fii-dii-flows`
- `/api/video/ipo-tracker`
- `/api/status`, `/api/admin/groq-usage`, `/health`

### 3.2 AI and Analytics Layer

- `rag_chat.py`: retrieval-augmented chat using recent signals, symbol context, and optional portfolio context.
- `chart_patterns.py`: technical pattern detection and normalized outputs for UI cards.
- `portfolio_analyser.py`: PDF parsing, Indian MF validation, overlap and rebalancing analysis, robust XIRR fallback.
- Video script generator route:
  - fetches top gainers and latest signal from DB,
  - fetches latest filing context with hardcoded fallback,
  - adds index, flow, and IPO context,
  - calls Groq for structured scene JSON,
  - falls back to deterministic demo script if parsing or LLM fails.

### 3.3 Worker Layer

- Celery app in `app/tasks/__init__.py`.
- Broker and result backend configured from environment.
- Upstash compatibility:
  - Redis URL normalization to TLS for hosted Redis.
  - Startup retry enabled for Celery 6 forward compatibility.
- Recommended local worker mode on Windows: `-P solo`.

## 4. Data Layer

### 4.1 PostgreSQL Entities

Core entities include:

- `stocks`
- `ohlcv`
- `signals`
- `filings` and `bse_filings`
- `bulk_deals`
- `users`
- `chat_messages`
- `portfolios` and `portfolio_reports`

Alembic manages schema migrations.

### 4.2 Redis Usage

Redis is used for:

- API response caching (radar, patterns, video script).
- Groq usage counters.
- Celery transport and task state backend.

Notable cache policy:

- Daily video script cache key format: `video:daily_script:YYYY-MM-DD`
- TTL: 30 minutes

## 5. Frontend Architecture

### 5.1 App Structure

Key routes in `et-radar-frontend/app`:

- `page.tsx` landing
- `dashboard/page.tsx`
- `stock/[symbol]/page.tsx`
- `filings/page.tsx`
- `portfolio/page.tsx`
- `chat/page.tsx`
- `video/page.tsx`

### 5.2 UX and Data Strategy

- API integration centralized in `lib/api.ts`.
- Defensive rendering with fallback demo data for critical demo paths.
- Persistent client-side UX state for chat sessions and onboarding.
- AI video page supports scene playback and optional speech synthesis narration.

## 6. Core Flows

### 6.1 Opportunity Radar Flow

1. Ingestion tasks update market and event tables.
2. Radar and pattern logic generates candidate signals.
3. Signals are read via `/api/opportunity-radar`.
4. Frontend dashboard renders confidence and action cards with refresh loop.

### 6.2 Portfolio Analysis Flow

1. User uploads CAMS or KFintech statement.
2. Backend parses PDF and extracts likely Indian MF holdings.
3. Metrics and recommendations are generated.
4. Report is returned and optionally persisted for session history.

### 6.3 AI Video Flow

1. Frontend requests `/api/video/daily-script`.
2. Backend checks Redis cache.
3. On miss, backend builds market context from DB plus constants.
4. Groq generates JSON scene script.
5. Backend sanitizes and parses response; fallback on any error.
6. Payload includes six scene support (`ipo_tracker` before `outro`) and latest filing context.
7. Payload cached and returned to frontend player.

## 7. Deployment and Demo Notes

- Backend and frontend run as separate processes in development.
- Worker should run concurrently with API for ingestion and radar tasks.
- For hackathon demo reliability, seed scripts should be run before presentation:
  - `seed_data.py`
  - `seed_ohlcv.py`
  - `seed_filings.py`

## 8. Security and Reliability Notes

- Auth is JWT-based for protected user workflows.
- Public demo endpoints remain unauthenticated where required.
- Video endpoint and chat flows include fallback behavior to avoid blank states.
- System is designed to return valid payloads instead of hard failures for demo-critical flows.
