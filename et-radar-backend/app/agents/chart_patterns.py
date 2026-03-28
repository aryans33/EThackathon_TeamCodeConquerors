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
    if len(df) < 10:
        return False
    prev_252_max = df["close"].iloc[-min(252, len(df)-1):-1].max()
    today_close = df["close"].iloc[-1]
    return float(today_close) > float(prev_252_max)


def detect_golden_cross(df: pd.DataFrame) -> bool:
    if len(df) < 10:
        return False
    short_ma = min(50, len(df)//3)
    long_ma = min(200, len(df)-1)
    if short_ma >= long_ma:
        return False
    df_temp = df.copy()
    df_temp["sma50"] = df_temp["close"].rolling(short_ma).mean()
    df_temp["sma200"] = df_temp["close"].rolling(long_ma).mean()
    yesterday = df_temp.iloc[-2]
    today = df_temp.iloc[-1]
    return (float(yesterday["sma50"]) <= float(yesterday["sma200"]) and
            float(today["sma50"]) > float(today["sma200"]))


def detect_death_cross(df: pd.DataFrame) -> bool:
    if len(df) < 10:
        return False
    short_ma = min(50, len(df)//3)
    long_ma = min(200, len(df)-1)
    if short_ma >= long_ma:
        return False
    df_temp = df.copy()
    df_temp["sma50"] = df_temp["close"].rolling(short_ma).mean()
    df_temp["sma200"] = df_temp["close"].rolling(long_ma).mean()
    yesterday = df_temp.iloc[-2]
    today = df_temp.iloc[-1]
    return (float(yesterday["sma50"]) >= float(yesterday["sma200"]) and
            float(today["sma50"]) < float(today["sma200"]))


def detect_rsi_bounce(df: pd.DataFrame) -> bool:
    if len(df) < 15:
        return False
    rsi = calculate_rsi(df["close"], period=14)
    return float(rsi.iloc[-2]) < 35 and float(rsi.iloc[-1]) > 40


def detect_support_bounce(df: pd.DataFrame) -> bool:
    if len(df) < 10:
        return False
    lookback = min(90, len(df)-1)
    low_90 = float(df["low"].iloc[-lookback:-1].min())
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

def _empty_backtest(note: str, forward_days: int = 10) -> dict:
    return {
        "occurrences": 0,
        "success_rate": 0.0,
        "avg_return_pct": 0.0,
        "win_rate": None,
        "avg_return": None,
        "best_return": None,
        "worst_return": None,
        "sample_size": 0,
        "forward_days": forward_days,
        "note": note,
    }


def _find_historical_signals(df: pd.DataFrame, pattern_type: str) -> list[int]:
    """Lightweight historical pattern occurrence finder over OHLCV windows."""
    signals: list[int] = []
    closes = df["close"].to_numpy(dtype=float)
    highs = df["high"].to_numpy(dtype=float)
    lows = df["low"].to_numpy(dtype=float)
    vols = df["volume"].to_numpy(dtype=float)
    n = len(closes)

    if pattern_type == "52_week_breakout":
        for i in range(252, n):
            resistance = float(np.max(highs[i - 252:i]))
            avg_vol = float(np.mean(vols[max(0, i - 20):i]))
            if closes[i] > resistance * 1.01 and (avg_vol == 0 or vols[i] >= avg_vol * 1.2):
                signals.append(i)

    elif pattern_type == "support_bounce":
        for i in range(20, n):
            support = float(np.min(lows[i - 20:i]))
            if lows[i] <= support * 1.01 and closes[i] >= support * 1.02:
                signals.append(i)

    elif pattern_type == "golden_cross":
        ma20 = pd.Series(closes).rolling(20).mean().to_numpy()
        ma50 = pd.Series(closes).rolling(50).mean().to_numpy()
        for i in range(51, n):
            if ma20[i - 1] <= ma50[i - 1] and ma20[i] > ma50[i]:
                signals.append(i)

    elif pattern_type == "death_cross":
        ma20 = pd.Series(closes).rolling(20).mean().to_numpy()
        ma50 = pd.Series(closes).rolling(50).mean().to_numpy()
        for i in range(51, n):
            if ma20[i - 1] >= ma50[i - 1] and ma20[i] < ma50[i]:
                signals.append(i)

    elif pattern_type == "rsi_bounce":
        delta = pd.Series(closes).diff()
        gain = delta.clip(lower=0).rolling(14).mean()
        loss = (-delta.clip(upper=0)).rolling(14).mean()
        rs = gain / loss.replace(0, 1e-9)
        rsi = (100 - 100 / (1 + rs)).to_numpy()
        for i in range(15, n):
            if rsi[i - 1] < 30 and rsi[i] > 30:
                signals.append(i)

    return signals


def _backtest_pattern_from_df(df: pd.DataFrame, pattern_type: str, symbol: str, forward_days: int = 10) -> dict:
    if len(df) < forward_days + 20:
        return _empty_backtest("Insufficient history", forward_days)

    signal_indices = _find_historical_signals(df, pattern_type)
    outcomes: list[float] = []

    for idx in signal_indices:
        future_idx = idx + forward_days
        if future_idx < len(df):
            entry_price = float(df["close"].iloc[idx])
            exit_price = float(df["close"].iloc[future_idx])
            pct_return = (exit_price - entry_price) / max(entry_price, 1e-9) * 100
            outcomes.append(float(pct_return))

    if not outcomes:
        return _empty_backtest("No historical signals found", forward_days)

    wins = [r for r in outcomes if r > 0]
    win_rate = round(len(wins) / len(outcomes) * 100, 1)
    avg_return = round(float(np.mean(outcomes)), 2)
    best_return = round(float(np.max(outcomes)), 2)
    worst_return = round(float(np.min(outcomes)), 2)

    return {
        "occurrences": len(outcomes),
        "success_rate": round(win_rate / 100.0, 2),
        "avg_return_pct": avg_return,
        "win_rate": win_rate,
        "avg_return": avg_return,
        "best_return": best_return,
        "worst_return": worst_return,
        "sample_size": len(outcomes),
        "forward_days": forward_days,
        "note": f"Based on {len(outcomes)} historical occurrences on {symbol}",
    }


async def backtest_pattern(db, symbol: str, pattern_type: str, forward_days: int = 10) -> dict:
    """Backtest a specific pattern against existing OHLCV history for one symbol."""
    stock_result = await db.execute(select(Stock).where(Stock.symbol == symbol.upper()))
    stock = stock_result.scalar_one_or_none()
    if not stock:
        return _empty_backtest("Unknown symbol", forward_days)

    result = await db.execute(
        select(OHLCV)
        .where(OHLCV.stock_id == stock.id)
        .order_by(OHLCV.date.asc())
    )
    rows = result.scalars().all()

    if len(rows) < forward_days + 20:
        return _empty_backtest("Insufficient history", forward_days)

    df = pd.DataFrame([
        {
            "date": r.date,
            "close": float(r.close),
            "high": float(r.high),
            "low": float(r.low),
            "volume": float(r.volume),
        }
        for r in rows
    ]).set_index("date")

    return _backtest_pattern_from_df(df, pattern_type, symbol.upper(), forward_days)


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

    if len(rows) < 10:
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

        bt = _backtest_pattern_from_df(df, pattern_key, symbol, forward_days=10)

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
