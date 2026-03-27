import asyncio
import datetime as dt
import os
import random
import sys

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.tables import Signal, Stock


STOCKS = [
    {"symbol": "RELIANCE", "name": "Reliance Industries Ltd", "exchange": "NSE", "sector": "Energy"},
    {"symbol": "TCS", "name": "Tata Consultancy Services Ltd", "exchange": "NSE", "sector": "IT"},
    {"symbol": "INFY", "name": "Infosys Ltd", "exchange": "NSE", "sector": "IT"},
    {"symbol": "HDFCBANK", "name": "HDFC Bank Ltd", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "ICICIBANK", "name": "ICICI Bank Ltd", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "WIPRO", "name": "Wipro Ltd", "exchange": "NSE", "sector": "IT"},
    {"symbol": "SBIN", "name": "State Bank of India", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "LT", "name": "Larsen & Toubro Ltd", "exchange": "NSE", "sector": "Infrastructure"},
    {"symbol": "TITAN", "name": "Titan Company Ltd", "exchange": "NSE", "sector": "Consumer"},
    {"symbol": "BAJFINANCE", "name": "Bajaj Finance Ltd", "exchange": "NSE", "sector": "Financial Services"},
    {"symbol": "ADANIENT", "name": "Adani Enterprises Ltd", "exchange": "NSE", "sector": "Conglomerate"},
    {"symbol": "BHARTIARTL", "name": "Bharti Airtel Ltd", "exchange": "NSE", "sector": "Telecom"},
    {"symbol": "ASIANPAINT", "name": "Asian Paints Ltd", "exchange": "NSE", "sector": "Consumer"},
    {"symbol": "AXISBANK", "name": "Axis Bank Ltd", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "KOTAKBANK", "name": "Kotak Mahindra Bank Ltd", "exchange": "NSE", "sector": "Banking"},
    {"symbol": "TATAMOTORS", "name": "Tata Motors Ltd", "exchange": "NSE", "sector": "Automobile"},
    {"symbol": "HINDUNILVR", "name": "Hindustan Unilever Ltd", "exchange": "NSE", "sector": "Consumer"},
    {"symbol": "NESTLEIND", "name": "Nestle India Ltd", "exchange": "NSE", "sector": "Consumer"},
    {"symbol": "SUNPHARMA", "name": "Sun Pharmaceutical Industries Ltd", "exchange": "NSE", "sector": "Pharma"},
    {"symbol": "MARUTI", "name": "Maruti Suzuki India Ltd", "exchange": "NSE", "sector": "Automobile"},
]


SIGNAL_BLUEPRINTS = [
    ("earnings_beat", "buy_watch", "Earnings beat with margin expansion"),
    ("bulk_deal_activity", "buy_watch", "Institutional accumulation in block deal"),
    ("technical_breakout", "buy_watch", "Price breakout above key resistance"),
    ("insider_buying", "buy_watch", "Promoter/insider buying activity observed"),
    ("institutional_accumulation", "neutral", "Steady institutional accumulation trend"),
    ("earnings_miss", "sell_watch", "Quarterly miss versus consensus"),
    ("technical_breakdown", "sell_watch", "Breakdown below support zone"),
    ("management_change", "neutral", "Leadership change needs closer monitoring"),
]


async def _seed_chart_patterns_if_exists(session, stocks_by_symbol: dict[str, Stock]) -> int:
    """
    Optional chart_patterns seeding.
    Uses ON CONFLICT DO NOTHING on (stock_id, pattern_name, detected_date)
    if chart_patterns table exists.
    """
    table_exists = await session.scalar(text("SELECT to_regclass('public.chart_patterns') IS NOT NULL"))
    if not table_exists:
        return 0

    detected_date = dt.date.today()
    pattern_names = ["52_week_breakout", "golden_cross", "support_bounce", "rsi_bounce"]

    seeded = 0
    for idx, symbol in enumerate(list(stocks_by_symbol.keys())[:8]):
        stock = stocks_by_symbol[symbol]
        pattern_name = pattern_names[idx % len(pattern_names)]

        await session.execute(
            text(
                """
                INSERT INTO chart_patterns (stock_id, pattern_name, detected_date, detected_today, explanation, occurrences, success_rate, avg_return_pct)
                VALUES (:stock_id, :pattern_name, :detected_date, :detected_today, :explanation, :occurrences, :success_rate, :avg_return_pct)
                ON CONFLICT (stock_id, pattern_name, detected_date) DO NOTHING
                """
            ),
            {
                "stock_id": stock.id,
                "pattern_name": pattern_name,
                "detected_date": detected_date,
                "detected_today": True,
                "explanation": f"{symbol} shows {pattern_name.replace('_', ' ')} setup.",
                "occurrences": random.randint(10, 80),
                "success_rate": round(random.uniform(0.45, 0.78), 2),
                "avg_return_pct": round(random.uniform(1.2, 6.5), 2),
            },
        )
        seeded += 1

    return seeded


async def main() -> None:
    print("🚀 Starting idempotent base seeding...")

    async with AsyncSessionLocal() as session:
        try:
            # Stocks: ON CONFLICT DO NOTHING on unique symbol
            stock_stmt = pg_insert(Stock).values(STOCKS)
            stock_stmt = stock_stmt.on_conflict_do_nothing(index_elements=["symbol"])
            await session.execute(stock_stmt)

            stock_rows = (await session.execute(select(Stock).order_by(Stock.symbol.asc()))).scalars().all()
            stocks_by_symbol = {s.symbol: s for s in stock_rows}

            # Signals: intentionally additive (no dedup requested)
            now = dt.datetime.now(dt.timezone.utc)
            signals_added = 0
            symbols = list(stocks_by_symbol.keys())
            for i in range(min(8, len(symbols))):
                symbol = symbols[i]
                signal_type, action_hint, reason = SIGNAL_BLUEPRINTS[i % len(SIGNAL_BLUEPRINTS)]
                signal = Signal(
                    stock_id=stocks_by_symbol[symbol].id,
                    filing_id=None,
                    signal_type=signal_type,
                    confidence=random.randint(55, 90),
                    one_line_summary=f"{symbol} flagged for {signal_type.replace('_', ' ')}",
                    action_hint=action_hint,
                    reason=reason,
                    created_at=now - dt.timedelta(hours=random.randint(1, 48)),
                )
                session.add(signal)
                signals_added += 1

            # Chart patterns: conflict-safe insert if table exists.
            patterns_seeded = await _seed_chart_patterns_if_exists(session, stocks_by_symbol)

            await session.commit()
            print(
                f"Seeded {len(STOCKS)} stock upsert candidates, "
                f"added {signals_added} signals, "
                f"attempted {patterns_seeded} chart pattern rows"
            )
        except Exception as e:
            await session.rollback()
            print(f"Seed failed: {e}")
            raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
