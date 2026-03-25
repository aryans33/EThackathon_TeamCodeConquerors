"""
Chart Pattern Agent — uses Groq (llama-3.3-70b-versatile)
to detect and explain 5 technical patterns for Indian stocks.
"""

import pandas as pd
import numpy as np
from groq import Groq, RateLimitError
import time
from app.config import settings
from app.models.tables import OHLCV, Stock
from sqlalchemy import select

# Groq client
client = Groq(api_key=settings.GROQ_API_KEY)


# ── Manual RSI Calculation ────────────────────────────────────────────────────

def calculate_rsi(series: pd.Series, period: int = 14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0.0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


# ── Pattern detection functions ───────────────────────────────────────────────

def detect_52w_breakout(df: pd.DataFrame) -> bool:
    if len(df) < 253:
        return False
    prev_252_max = df["close"].iloc[-252:-1].max()
    today_close = df["close"].iloc[-1]
    return float(today_close) > float(prev_252_max)


def detect_golden_cross(df: pd.DataFrame) -> bool:
    if len(df) < 201:
        return False
    df_temp = df.copy()
    df_temp["sma50"] = df_temp["close"].rolling(50).mean()
    df_temp["sma200"] = df_temp["close"].rolling(200).mean()
    yesterday = df_temp.iloc[-2]
    today = df_temp.iloc[-1]
    return (float(yesterday["sma50"]) <= float(yesterday["sma200"]) and
            float(today["sma50"]) > float(today["sma200"]))


def detect_death_cross(df: pd.DataFrame) -> bool:
    if len(df) < 201:
        return False
    df_temp = df.copy()
    df_temp["sma50"] = df_temp["close"].rolling(50).mean()
    df_temp["sma200"] = df_temp["close"].rolling(200).mean()
    yesterday = df_temp.iloc[-2]
    today = df_temp.iloc[-1]
    return (float(yesterday["sma50"]) >= float(yesterday["sma200"]) and
            float(today["sma50"]) < float(today["sma200"]))


def detect_rsi_bounce(df: pd.DataFrame) -> bool:
    if len(df) < 30:
        return False
    rsi = calculate_rsi(df["close"], period=14)
    return float(rsi.iloc[-2]) < 35 and float(rsi.iloc[-1]) > 40


def detect_support_bounce(df: pd.DataFrame) -> bool:
    if len(df) < 91:
        return False
    low_90 = float(df["low"].iloc[-91:-1].min())
    today_close = float(df["close"].iloc[-1])
    return today_close > low_90 * 1.03 and df["low"].iloc[-5:].min() <= low_90 * 1.02


PATTERN_LABELS = {
    "52_week_breakout": "52-Week Breakout",
    "golden_cross": "Golden Cross",
    "death_cross": "Death Cross",
    "rsi_bounce": "RSI Oversold Bounce",
    "support_bounce": "Support Bounce",
}

PATTERN_FUNCTIONS = {
    "52_week_breakout": detect_52w_breakout,
    "golden_cross": detect_golden_cross,
    "death_cross": detect_death_cross,
    "rsi_bounce": detect_rsi_bounce,
    "support_bounce": detect_support_bounce,
}


# ── Back-test function ────────────────────────────────────────────────────────

def backtest_pattern(detect_fn, df: pd.DataFrame, forward_days: int = 30) -> dict:
    """Backtest pattern — excludes last 30 days to avoid lookahead bias."""
    if len(df) < 252:
        return {"occurrences": 0, "success_rate": 0.0, "avg_return_pct": 0.0}
    results, returns = [], []
    # Exclude last 30 days (no lookahead bias)
    end_idx = len(df) - forward_days - 30
    if end_idx <= 200:
        return {"occurrences": 0, "success_rate": 0.0, "avg_return_pct": 0.0}
    for i in range(200, end_idx):
        window = df.iloc[:i + 1]
        try:
            if detect_fn(window):
                entry = float(df["close"].iloc[i])
                exit_p = float(df["close"].iloc[i + forward_days])
                results.append(exit_p > entry)
                returns.append(((exit_p - entry) / entry) * 100)
        except Exception:
            continue
    if not results:
        return {"occurrences": 0, "success_rate": 0.0, "avg_return_pct": 0.0}
    return {
        "occurrences": len(results),
        "success_rate": round(sum(results) / len(results), 2),
        "avg_return_pct": round(float(np.mean(returns)), 1)
    }


# ── Explanation function ──────────────────────────────────────────────────────

EXPLAIN_SYSTEM = """You are a friendly stock market educator for Indian retail investors.
Respond in 2-3 plain English sentences only.
Do not use bullet points, headers, or markdown.
Never say 'buy' or 'sell'. Always mention a price level to watch."""


def explain_pattern_sync(pattern_name: str, symbol: str, company_name: str,
                         current_price: float, backtest: dict) -> str:
    """Synchronous Groq call to explain a pattern."""
    label = PATTERN_LABELS.get(pattern_name, pattern_name)
    n = backtest.get("occurrences", 0)
    pct = int(backtest.get("success_rate", 0) * 100)

    user_msg = f"""Pattern: {label} on {symbol} ({company_name}).
Price: ₹{current_price:,.2f}
History: appeared {n} times in 3 years, higher 30 days later {pct}% of the time.
Explain simply."""

    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": EXPLAIN_SYSTEM},
                    {"role": "user", "content": user_msg}
                ],
                max_tokens=120,
                temperature=0.4
            )
            return response.choices[0].message.content.strip()
        except RateLimitError:
            time.sleep(5)
            if attempt == 1:
                return f"{label} detected on {symbol}. Watch ₹{current_price:,.0f} as key level."
            continue
        except Exception as e:
            print(f"Pattern explain error (attempt {attempt + 1}): {e}")
            if attempt == 0:
                time.sleep(1)
                continue
            return f"{label} detected on {symbol}. Notable technical signal."

    return f"{label} detected on {symbol}. Notable technical signal."


async def explain_pattern(pattern_name: str, symbol: str, company_name: str,
                          current_price: float, backtest: dict) -> str:
    """Async wrapper — runs sync Groq call in a thread."""
    import asyncio
    return await asyncio.to_thread(
        explain_pattern_sync, pattern_name, symbol, company_name, current_price, backtest
    )


# ── Main analysis function ────────────────────────────────────────────────────

async def analyse_stock_patterns(symbol: str, db) -> list[dict]:
    """
    Always returns ALL 5 patterns.
    detected_today=True for patterns that fired, False otherwise.
    explanation is empty string when not detected.
    backtest is always populated.
    """
    stock_result = await db.execute(select(Stock).where(Stock.symbol == symbol))
    stock = stock_result.scalar_one_or_none()
    if not stock:
        return []

    ohlcv_result = await db.execute(
        select(OHLCV)
        .where(OHLCV.stock_id == stock.id)
        .order_by(OHLCV.date.asc())
        .limit(600)
    )
    rows = ohlcv_result.scalars().all()

    if len(rows) < 30:
        # Not enough data — return all 5 with detected=False
        return [
            {
                "pattern_name": key,
                "detected_today": False,
                "explanation": "Insufficient price history for this pattern.",
                "backtest": {"occurrences": 0, "success_rate": 0.0, "avg_return_pct": 0.0}
            }
            for key in PATTERN_FUNCTIONS.keys()
        ]

    df = pd.DataFrame([{"close": r.close, "low": r.low, "high": r.high} for r in rows])
    current_price = float(df["close"].iloc[-1])
    results = []

    for pattern_key, detect_fn in PATTERN_FUNCTIONS.items():
        try:
            detected = bool(detect_fn(df))
        except Exception:
            detected = False

        bt = backtest_pattern(detect_fn, df)

        if detected:
            try:
                exp = await explain_pattern(pattern_key, symbol, stock.name, current_price, bt)
            except Exception:
                exp = f"{PATTERN_LABELS.get(pattern_key, pattern_key)} detected on {symbol}."
        else:
            exp = f"{PATTERN_LABELS.get(pattern_key, pattern_key)} not currently active on {symbol}."

        results.append({
            "pattern_name": pattern_key,
            "detected_today": detected,
            "explanation": exp,
            "backtest": bt
        })

    return results
