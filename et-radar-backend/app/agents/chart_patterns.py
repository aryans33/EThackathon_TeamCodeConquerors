import pandas as pd
import numpy as np
from groq import Groq
import json
from app.config import settings
from app.database import AsyncSessionLocal
from app.models.tables import OHLCV, Stock
from sqlalchemy import select

# Groq client
client = Groq(api_key=settings.GROQ_API_KEY)

# ── Manual RSI Calculation (Native replacement for pandas-ta) ─────────────────

def calculate_rsi(series: pd.Series, period: int = 14):
    delta = series.diff()
    gain = (delta.where(delta > 0, 0.0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0.0)).rolling(window=period).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))

# ── Pattern detection functions ──────────────────────────────────────────────

def detect_52w_breakout(df: pd.DataFrame) -> bool:
    if len(df) < 253: return False
    prev_252_max = df["close"].iloc[-252:-1].max()
    today_close = df["close"].iloc[-1]
    return float(today_close) > float(prev_252_max)

def detect_golden_cross(df: pd.DataFrame) -> bool:
    if len(df) < 201: return False
    df_temp = df.copy()
    df_temp["sma50"] = df_temp["close"].rolling(50).mean()
    df_temp["sma200"] = df_temp["close"].rolling(200).mean()
    yesterday = df_temp.iloc[-2]
    today = df_temp.iloc[-1]
    return (float(yesterday["sma50"]) <= float(yesterday["sma200"]) and
            float(today["sma50"]) > float(today["sma200"]))

def detect_death_cross(df: pd.DataFrame) -> bool:
    if len(df) < 201: return False
    df_temp = df.copy()
    df_temp["sma50"] = df_temp["close"].rolling(50).mean()
    df_temp["sma200"] = df_temp["close"].rolling(200).mean()
    yesterday = df_temp.iloc[-2]
    today = df_temp.iloc[-1]
    return (float(yesterday["sma50"]) >= float(yesterday["sma200"]) and
            float(today["sma50"]) < float(today["sma200"]))

def detect_rsi_bounce(df: pd.DataFrame) -> bool:
    if len(df) < 30: return False
    rsi = calculate_rsi(df["close"], period=14)
    return float(rsi.iloc[-2]) < 35 and float(rsi.iloc[-1]) > 40

def detect_support_bounce(df: pd.DataFrame) -> bool:
    if len(df) < 91: return False
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
    if len(df) < 252: return {"occurrences": 0, "success_rate": 0.0, "avg_return_pct": 0.0}
    results, returns = [], []
    end_idx = len(df) - forward_days - 1
    for i in range(200, end_idx):
        window = df.iloc[:i+1]
        try:
            if detect_fn(window):
                entry = float(df["close"].iloc[i])
                exit_p = float(df["close"].iloc[i + forward_days])
                results.append(exit_p > entry)
                returns.append(((exit_p - entry) / entry) * 100)
        except: continue
    if not results: return {"occurrences": 0, "success_rate": 0.0, "avg_return_pct": 0.0}
    return {
        "occurrences": len(results),
        "success_rate": round(sum(results) / len(results), 2),
        "avg_return_pct": round(float(np.mean(returns)), 1)
    }

# ── Explanation function ──────────────────────────────────────────────────────

EXPLAIN_SYSTEM = """You are a stock market educator for Indian retail investors. 
Explain chart patterns simply (2-3 sentences). No buy/sell advice. Hinglish allowed."""

async def explain_pattern(pattern_name: str, symbol: str, company_name: str, current_price: float, backtest: dict) -> str:
    label = PATTERN_LABELS.get(pattern_name, pattern_name)
    user_msg = f"""Pattern: {label}
Stock: {company_name} ({symbol})
Price: ₹{current_price}
History: Appeared {backtest['occurrences']} times, {int(backtest['success_rate']*100)}% 30-day success.
Explain this pattern for a retail investor."""

    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": EXPLAIN_SYSTEM},
                {"role": "user", "content": user_msg}
            ]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Pattern explain error: {e}")
        return f"{label} detected. Notable signal."

# ── Main analysis function ────────────────────────────────────────────────────

async def analyse_stock_patterns(symbol: str, db) -> list[dict]:
    stock_result = await db.execute(select(Stock).where(Stock.symbol == symbol))
    stock = stock_result.scalar_one_or_none()
    if not stock: return []

    ohlcv_result = await db.execute(select(OHLCV).where(OHLCV.stock_id == stock.id).order_by(OHLCV.date.asc()).limit(504))
    rows = ohlcv_result.scalars().all()
    if len(rows) < 100: return []

    df = pd.DataFrame([{"close": r.close, "low": r.low} for r in rows])
    current_price = float(df["close"].iloc[-1])
    results = []

    for pattern_key, detect_fn in PATTERN_FUNCTIONS.items():
        try:
            if detect_fn(df):
                bt = backtest_pattern(detect_fn, df)
                exp = await explain_pattern(pattern_key, symbol, stock.name, current_price, bt)
                results.append({"pattern_name": pattern_key, "detected_today": True, "explanation": exp, "backtest": bt})
        except: continue
    return results
