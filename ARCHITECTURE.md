# ET Radar: System Architecture

## High-Level Overview

ET Radar is a **three-tier full-stack application** with decoupled frontend, backend, and data layers communicating via REST APIs and asynchronous job queues.

```
┌──────────────────────────────────────────────────────────┐
│                   USER INTERFACE LAYER                   │
│                   (Next.js 13 Frontend)                  │
│  Landing ─ Auth ─ Dashboard ─ Stock ─ Portfolio ─ Chat  │
└──────────────────────────────────────────────────────────┘
                            ▲
                    HTTP/REST │ (Axios)
                            │
┌──────────────────────────────────────────────────────────┐
│                  API GATEWAY LAYER                       │
│              (FastAPI + CORS Middleware)                │
│              Port 8000 | Rate Limiting                   │
└──────────────────────────────────────────────────────────┘
           │              │              │
    ┌──────▼──────┬──────▼──────┬──────▼──────┐
    │   Routers   │   Routers   │   Routers   │
    ├─────────────┼─────────────┼─────────────┤
    │ auth.py     │ stocks.py   │ portfolio.py│
    │ signals.py  │ patterns.py │ chat.py     │
    │ filings.py  │ demo.py     │ status.py   │
    └──────┬──────┴──────┬──────┴──────┬──────┘
           │             │             │
    ┌──────▼──────────────▼─────────────▼──────┐
    │      BUSINESS LOGIC LAYER (Agents)       │
    ├───────────────────────────────────────────┤
    │ ✓ chart_patterns.py (GRU model + heuristics)
    │ ✓ opportunity_radar.py (signal aggregation)
    │ ✓ portfolio_analyser.py (PDF parsing, XIRR)
    │ ✓ rag_chat.py (context + Groq LLM)       │
    └──────┬──────────────────────────────────┘
           │
           ├─► Groq LLM │ (API call)
           │            │
           │   ┌────────────────────┐
           │   │ llama-3.3-70b      │
           │   │ Recommendations    │
           │   │ Chat responses     │
           │   └────────────────────┘
           │
    ┌──────▼──────────────────────────────────┐
    │   DATA PERSISTENCE & CACHING LAYER      │
    ├──────────────────────────────────────────┤
    │  PostgreSQL  │  Redis      │ File Store │
    │  ────────────┼─────────────┼────────────│
    │  • User      │ • Session   │ • PDFs     │
    │  • Stock     │   tokens    │ • Cache    │
    │  • OHLCV     │ • Queue     │ • Logs     │
    │  • Signal    │   (Celery)  │            │
    │  • Pattern   │ • Cache     │            │
    │  • Filing    │   (TTL)     │            │
    │  • Portfolio │             │            │
    └─────────────────────────────────────────┘
           ▲              ▲
           │ SQL          │ Pub/Sub
           │              │
    ┌──────┴────────────────────────────────┐
    │  ASYNC TASK LAYER (Celery Workers)   │
    ├─────────────────────────────────────────┤
    │ Job Type     │ Frequency  │ Purpose    │
    ├──────────────┼────────────┼──────────────┤
    │ fetch_prices │ 5 min      │ NSE + yf API│
    │ run_radar    │ Hourly     │ Pattern scan│
    │ fetch_filings│ Daily 5 PM │ BSE scrape  │
    │ bulk_deals   │ 2 hourly   │ Event track │
    └─────────────────────────────────────────┘
```

---

## Component Deep-Dive

### 1. Frontend Tier (Next.js 13 + React)

**Key Modules:**

| Module                        | Purpose                                        | Tech                         |
| ----------------------------- | ---------------------------------------------- | ---------------------------- |
| `app/page.tsx`                | Landing page with 3D hero animation            | Framer Motion, Three.js      |
| `app/auth/page.tsx`           | Signup/login with JWT persistence              | localStorage, Axios          |
| `app/dashboard/page.tsx`      | Main hub: watchlist, patterns, recommendations | React hooks, Axios           |
| `app/stock/[symbol]/page.tsx` | Individual stock chart + patterns              | lightweight-charts, Recharts |
| `app/portfolio/page.tsx`      | MF portfolio upload & analysis                 | pdfplumber, XIRR             |
| `lib/api.ts`                  | Axios client with token injection              | JWT interceptor              |
| `hooks/useApi.ts`             | Data fetching hook with caching & retry        | SWR pattern, ref-backed      |
| `context/ToastContext.tsx`    | Global notifications                           | React Context API            |

**State Management:**

- ✅ Client-side: React hooks (useState, useEffect, useContext)
- ✅ Server-side: Next.js App Router with automatic caching
- ✅ Auth: localStorage + JWT token validation
- ✅ No Redux/Zustand needed for MVP scope

**Styling:**

- Blue theme with Tailwind CSS (`#7dd3fc`, `#0d1117` base)
- Dark mode optimized for financial dashboards
- Responsive: mobile, tablet, desktop

---

### 2. API Gateway (FastAPI)

**CORS & Middleware:**

```python
# Allow localhost:3000 + env FRONTEND_URL
CORSMiddleware(allow_origins=[...])

# Request logging middleware
@app.middleware("http")
async def log_requests(request, call_next)

# Global exception handler
@app.exception_handler(Exception)
```

**Router Architecture (9 routers):**

| Router         | Endpoints                                     | Auth                |
| -------------- | --------------------------------------------- | ------------------- |
| `auth.py`      | POST /signup, POST /login                     | None (public)       |
| `stocks.py`    | GET /stocks, GET /prices, GET /{symbol}/ohlcv | None (public)       |
| `signals.py`   | GET /signals, GET signals/by-confidence       | None (public)       |
| `patterns.py`  | GET /patterns, GET /active                    | None (public)       |
| `portfolio.py` | POST /analyze-pdf, GET /{user_id}             | JWT required        |
| `chat.py`      | POST /message, GET /history                   | JWT required        |
| `filings.py`   | GET /latest, GET /{symbol}                    | None (public)       |
| `status.py`    | GET /health                                   | None (public)       |
| `demo.py`      | POST /seed                                    | Dev-only (DEV=true) |

**Response Format (Pydantic):**

```python
class StockOut(BaseModel):
    id: int
    symbol: str
    name: str
    model_config = ConfigDict(from_attributes=True)  # ORM mode

# All responses: 200 OK or proper error status
```

---

### 3. Business Logic (Agents)

#### A. **chart_patterns.py** - Pattern Detection

```python
detect_bullish_trapezoid(symbol: str) → PatternList
  ├─ Fetch last 400 days OHLCV
  ├─ Apply GRU neural net (trained on historical patterns)
  ├─ Score confidence 0-1
  └─ Return pattern metadata + backtest stats

detect_death_cross(symbol: str) → SignalOut
  ├─ Calculate SMA_50 & SMA_200
  ├─ Detect crossover (50 below 200)
  ├─ Flag as bearish signal
  └─ Add to notification queue
```

#### B. **opportunity_radar.py** - Signal Aggregation

```python
aggregate_signals(timeframe: str) → RadarPayload
  ├─ Query all signals from last N days
  ├─ Group by confidence level
  ├─ Sort by timestamp
  └─ Cache in Redis (TTL 5 min)
```

#### C. **portfolio_analyser.py** - MF PDF Analysis

```python
analyse_mutual_fund_pdf(file: UploadFile) → PortfolioOut
  ├─ Extract text via pdfplumber
  ├─ Validate Indian MF keywords (ISIN, Folio, NAV, etc.)
  ├─ Parse fund names (filter $, USD, Russell)
  ├─ Calculate XIRR via Newton's method
  ├─ Fallback to Groq if regex fails
  └─ Return normalized portfolio
```

#### D. **rag_chat.py** - Retrieval-Augmented Chat

```python
chat_with_groq(user_msg: str, user_id: int) → ChatOut
  ├─ Fetch user portfolio context
  ├─ Get last 5 market signals
  ├─ Construct system prompt: "You are a portfolio advisor..."
  ├─ Call Groq llama-3.3-70b
  ├─ Stream or return full response
  └─ Save to chat_history table
```

---

### 4. Data Persistence (PostgreSQL)

**Schema:**

```sql
-- Auth
users (id PK, name, email UNIQUE, password_hash, created_at)

-- Market Data
stocks (id, symbol UNIQUE, name, sector, isin)
ohlcv (id, stock_id FK, date, open, high, low, close, volume, UNIQUE(stock_id, date))
signals (id, stock_id FK, type, confidence, created_at)
patterns (id, stock_id FK, name, start_date, end_date, return_pct)

-- Events
filings (id, stock_id FK, date, category, headline, source_url)
bulk_deals (id, stock_id FK, date, buyer, seller, qty, price)

-- User Data
portfolios (id, user_id FK, stock_id FK, quantity, avg_price)
mutual_funds (id, user_id FK, scheme_name, units, nav, invested_value, XIRR)
```

**Migrations (Alembic):**

```bash
alembic init alembic
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

---

### 5. Caching & Queue (Redis + Celery)

**Redis Usage:**

| Key                   | Purpose              | TTL      |
| --------------------- | -------------------- | -------- |
| `stocks:prices:*`     | Cached stock prices  | 5 min    |
| `patterns:active:*`   | Active patterns      | 1 hr     |
| `user:{id}:portfolio` | User portfolio cache | 30 min   |
| `groq:calls:total`    | API usage counter    | 365 days |
| `session:{token}`     | Auth session         | 7 days   |

**Celery Tasks (Async Jobs):**

```python
@app.task
def fetch_all_prices():
    # Every 5 min: calls NSE API, falls back to yfinance
    # Updates all 20 tracked stocks

@app.task
def run_radar_scan():
    # Every hourly: detect patterns across all stocks
    # Generate signals if confidence > 0.7

@app.task
def fetch_filings_daily():
    # Schedule: 5 PM IST (after BSE close)
    # Scrape bulk deals, save to db

# Start Celery worker:
celery -A app.tasks worker --loglevel=info
celery -A app.tasks beat --loglevel=info  # Scheduler
```

---

### 6. External Integrations

#### **Groq LLM API**

```
Endpoint: https://api.groq.com/v1/messages
Model: llama-3.3-70b-versatile
Limits: 30 req/min (free tier, perfect for MVP)
Latency: ~2 sec avg response time
Use: Chat, recommendations, portfolio advice
```

#### **NSE API**

```
Data: Live stock prices, indices
Fallback: yfinance (Yahoo Finance)
Frequency: Every 5 minutes
Error Rate: ~5%, handled gracefully
```

#### **BSE Scraper**

```
Target: www.bseindia.com/markets
Data: Bulk deals, corporate actions
Frequency: Daily at 5 PM IST
Method: Selenium + BeautifulSoup
```

---

## Data Flow Diagrams

### Flow 1: User Signup → Dashboard

```
┌─────────────┐
│  User Signs │
│     Up      │
└──────┬──────┘
       │
       ▼
┌──────────────────────────────────┐
│ Frontend: POST /auth/signup      │
│ {name, email, password}          │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Backend: auth.py                 │
│ ├─ Hash pwd (bcrypt)             │
│ ├─ Save user to db               │
│ ├─ Generate JWT token            │
│ └─ Return token + user           │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Frontend: localStorage.setItem    │
│ ('et_radar_token', jwt)          │
│ Redirect to /dashboard           │
└──────────────────────────────────┘
       │
       ├─────────► Fetch stocks/prices
       ├─────────► Fetch patterns/active
       └─────────► Render dashboard
```

### Flow 2: Portfolio PDF Upload → Analysis

```
┌──────────────────┐
│  User Uploads    │
│     MF PDF       │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Frontend: FormData + JWT header  │
│ POST /api/portfolio/analyze-pdf  │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Backend: portfolio.py            │
│ ├─ Save file temp                │
│ ├─ Call portfolio_analyser.py    │
│ └─ Stream response               │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Analyser: parse_pdf_statement    │
│ ├─ pdfplumber extract text       │
│ ├─ Regex validate (ISIN, etc)    │
│ ├─ Fund name normalization       │
│ ├─ xirr calculation              │
│ └─ Fallback to Groq if fail      │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ Frontend: Display portfolio      │
│ ├─ Fund table                    │
│ ├─ XIRR metrics                  │
│ └─ AI recommendations            │
└──────────────────────────────────┘
```

### Flow 3: Real-time Pattern Detection

```
Celery Beat (scheduler)
    │
    └─► Every 1 hour
        │
        ▼
    Celery Task: run_radar.py
    │
    ├─► For each of 20 stocks:
    │   ├─ Fetch last 400 days OHLCV
    │   ├─ Apply GRU model
    │   ├─ Detect bullish trapezoid
    │   └─ Calculate confidence
    │
    └─► Aggregate signals
        │
        ├─ Save to patterns table
        ├─ Cache in Redis (1 hr)
        └─ Notify users (optional: email/push)
        │
        ▼
    Frontend: GET /api/patterns/active
    │
    └─► Render "Today's Patterns" section
        with backtest stats
```

---

## Deployment Architecture

### Local Development

```
localhost:3000 ────► localhost:8000
(Next.js dev)       (FastAPI uvicorn --reload)
                            │
                     ┌──────┴──────┐
                     │             │
              localhost:5432   localhost:6379
              (Postgres)        (Redis)
```

### Production (Docker Compose)

```
docker-compose up -d

Services:
├─ web (next:3000)
├─ api (fastapi:8000)
├─ db (postgres:5432)
├─ cache (redis:6379)
└─ worker (celery)
```

### Cloud Deployment (Railway/Vercel)

```
┌──────────────────────┐
│  Vercel Frontend     │  (Next.js auto-deploys from main branch)
│  et-radar.vercel.app │
└──────────┬───────────┘
           │
           ▼
┌─────────────────────────────────┐
│  Railway Backend                │  (FastAPI + uvicorn)
│  et-radar-api.up.railway.app    │
└──────────┬──────────────────────┘
           │
           ├───► Railway DB (PostgreSQL)
           ├───► Railway Redis
           └───► Railway Cron (Celery Beat)
```

---

## Error Handling & Resilience

### Backend Error Handling

```python
# Global exception catch
@app.exception_handler(Exception)
async def global_handler(request, exc):
    return JSONResponse(500, {"detail": "Internal error"})

# Endpoint-level try-catch
try:
    data = await getStocks()
except DatabaseError:
    raise HTTPException(500, "DB unavailable, check logs")
```

### Frontend Error Handling

```typescript
// API interceptor catches errors
api.interceptors.response.use(
  res => res,
  err => {
    console.error('API Error:', err.response?.status)
    // Show toast notification
    return Promise.reject(err)
  }
)

// Component error boundary
<ErrorBanner error={error} onRetry={refetch} />
```

### Fallback Chains

```
Fetch prices:
  1. Try NSE API
  2. Fallback: yfinance
  3. Fallback: return cached price
  4. Fallback: return null (UI handles)

Portfolio analysis:
  1. Try regex parsing
  2. Fallback: Groq LLM
  3. Fallback: manual user input form
```

---

## Performance & Scalability

### Optimization Techniques

- ✅ **Database indexes** on stock_id, date, user_id
- ✅ **Redis caching** (5-60 min TTL)
- ✅ **Query pagination** (limit 50 per page)
- ✅ **Frontend ref-backed memoization** (useRef for chart instances)
- ✅ **Lazy loading** (dynamic imports for heavy components)
- ✅ **Image optimization** (Next.js Image component)

### Load Testing

```bash
# With vegeta (HTTP load tester)
echo "GET http://localhost:8000/api/stocks" | vegeta attack -duration=30s | vegeta report

# Expected: 100+ req/sec on single uvicorn worker
```

---

## Monitoring & Observability

### Logging

```python
# FastAPI request logging
logger.info(f"{request.method} {request.url.path} → {status_code}")

# Error logging
logger.error(f"Chart pattern failed: {exc}", exc_info=True)
```

### Metrics

- Groq API calls: `groq:calls:total` (Redis key)
- Response times: middleware timing
- Error rate: 5xx responses

### Health Check

```bash
curl http://localhost:8000/health
# {"status": "ok", "timestamp": "2026-03-28T..."}
```

---

## Security Considerations

| Component    | Protection | Method                                       |
| ------------ | ---------- | -------------------------------------------- |
| **Auth**     | Password   | Bcrypt (cost=12)                             |
| **Tokens**   | Expiry     | 7-day JWT                                    |
| **API**      | CORS       | Whitelist frontend URL                       |
| **SQL**      | Injection  | SQLAlchemy parameterized queries             |
| **XLSX/PDF** | Validation | pdfplumber sandbox + file size limit (10 MB) |
| **Env Vars** | Secrets    | .env file (gitignored)                       |

---

## Future Scaling

**v2 Features:**

- WebSocket for real-time price updates
- Multi-user portfolio sharing
- Mobile app (React Native)
- ML-based signal confidence ranking
- User analytics (Mixpanel)

**Infrastructure:**

- Kubernetes (from Docker Compose)
- CDN for static assets
- Rate limiting (Redis-backed)
- Request queuing (Bull queue)

---

**Diagram Legend:**

- `→` = HTTP/REST call
- `◄►` = Bidirectional communication
- `⬆⬇` = Data flow
- `[ ]` = Component / Service
