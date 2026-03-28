# ET Radar Frontend

This app is the Next.js frontend for ET Radar. It renders dashboards, filings, stock detail views, portfolio analysis UI, AI chat, and the AI market video player.

## Quick Start

1. Start backend first on port 8000.
2. From this folder, install dependencies and run dev server.

```bash
cd et-radar-frontend
npm install
npm run dev
```

Open http://localhost:3000

## Frontend Routes

- `/` landing page
- `/auth` login and signup
- `/dashboard` opportunity radar dashboard
- `/stock/[symbol]` stock detail, patterns, and charts
- `/filings` filing feed with categories and confidence UI
- `/portfolio` mutual fund upload and analysis
- `/chat` streaming AI chat with session history
- `/video` AI Market Video Engine

## API Integration

- API helper: `lib/api.ts`
- Expected backend base: `http://localhost:8000/api`

The video page calls:

- `GET /api/video/daily-script`

The chat page uses streaming response from:

- `POST /api/chat/`

## Demo Notes

- UI is designed to be demo-resilient with fallback content in major views.
- The video page can render fallback script data if API generation is unavailable.
- Keep backend and worker running while judging for live radar/video behavior.

## Build

```bash
npm run build
npm run start
```

## Troubleshooting

- If frontend cannot fetch data, ensure backend is on port 8000.
- If charts/pages are empty, run backend seed scripts:
  - `scripts/seed_data.py`
  - `scripts/seed_ohlcv.py`
  - `scripts/seed_filings.py`
- If CORS issues appear, verify backend `FRONTEND_URL` in `.env`.
