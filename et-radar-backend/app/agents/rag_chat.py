from groq import Groq
from sqlalchemy import select, desc
from sqlalchemy.orm import joinedload
from app.models.tables import Signal, ChatMessage, Portfolio, Stock
from app.database import AsyncSessionLocal
from app.config import settings
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import json
import os

# Groq client
client = Groq(api_key=settings.GROQ_API_KEY)

RAG_SYSTEM = """You are ET Radar AI — an intelligent Indian stock market assistant 
built into the Economic Times platform.

You have access to real-time NSE/BSE signals, corporate filings, bulk deals, 
and the user's mutual fund portfolio.

Rules:
- Always cite your data source naturally (e.g., "Based on today's BSE filing...", "The bulk deal data shows...")
- Never give explicit buy/sell recommendations — give analysis and let the user decide
- Use Indian financial terminology (Sensex, Nifty, SEBI, FII, DII, crore, lakh)
- Keep responses under 150 words unless the user asks for detail
- If asked about a specific stock, always mention confidence level from signals
- End financial analysis with: "This is analysis only, not investment advice."
- Be conversational and helpful, not robotic"""

async def retrieve_relevant_signals(query: str, db) -> list[dict]:
    """TF-IDF retrieval of top 5 signals relevant to query"""
    result = await db.execute(
        select(Signal)
        .options(joinedload(Signal.stock))
        .order_by(desc(Signal.created_at))
        .limit(100)
    )
    signals = result.scalars().all()

    if not signals:
        return []

    corpus = [f"{s.one_line_summary} {s.reason} {s.stock.symbol if s.stock else ''}" 
              for s in signals]
    
    try:
        vectorizer = TfidfVectorizer(stop_words="english", max_features=500)
        tfidf_matrix = vectorizer.fit_transform(corpus + [query])
        query_vec = tfidf_matrix[-1]
        doc_vecs = tfidf_matrix[:-1]
        similarities = cosine_similarity(query_vec, doc_vecs)[0]
        top_indices = np.argsort(similarities)[::-1][:5]
    except Exception:
        top_indices = list(range(min(5, len(signals))))
        similarities = [1.0] * len(signals)

    return [
        {
            "symbol": signals[i].stock.symbol if signals[i].stock else "Unknown",
            "signal_type": signals[i].signal_type,
            "summary": signals[i].one_line_summary,
            "confidence": signals[i].confidence,
            "action_hint": signals[i].action_hint,
            "reason": signals[i].reason
        }
        for i in top_indices
        if similarities[i] > 0.05
    ]

async def get_portfolio_summary(session_id: str, db) -> str | None:
    result = await db.execute(
        select(Portfolio)
        .where(Portfolio.session_id == session_id)
        .order_by(desc(Portfolio.created_at))
        .limit(1)
    )
    portfolio = result.scalar_one_or_none()
    if not portfolio:
        return None

    try:
        data = json.loads(portfolio.raw_json)
        fund_list = ", ".join(f["fund_name"] for f in data.get("funds", []))
        return (f"User portfolio: Total value ₹{data['total_value']:,.0f}, "
                f"XIRR {data.get('xirr', 'N/A')}%, "
                f"Funds: {fund_list}, "
                f"Expense drag: ₹{data.get('expense_drag', 0):,.0f}/year")
    except Exception:
        return None

async def get_chat_history(session_id: str, db) -> list[dict]:
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(desc(ChatMessage.created_at))
        .limit(6)
    )
    messages = result.scalars().all()
    # Format for OpenAI/Groq: {"role": "user/assistant", "content": "..."}
    history = []
    for m in reversed(messages):
        role = "user" if m.role == "user" else "assistant"
        history.append({"role": role, "content": m.content})
    return history

async def get_top_signals_today(db) -> list[str]:
    result = await db.execute(
        select(Signal)
        .options(joinedload(Signal.stock))
        .order_by(desc(Signal.confidence), desc(Signal.created_at))
        .limit(3)
    )
    signals = result.scalars().all()
    return [
        f"{s.stock.symbol if s.stock else '?'}: {s.one_line_summary} (confidence: {s.confidence}%)"
        for s in signals
    ]
