"""
RAG Chat Agent — uses Groq (llama-3.3-70b-versatile) with streaming.
TF-IDF retrieval of relevant signals, portfolio context injection.
"""

import json
import re
from datetime import datetime
from typing import AsyncGenerator

from groq import Groq, RateLimitError
from sqlalchemy import select, desc
from sqlalchemy.orm import joinedload
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

from app.models.tables import Signal, ChatMessage, Portfolio, Stock, Filing
from app.config import settings

# Groq sync client (AsyncGroq has issues with streaming in thread pools)
client = Groq(api_key=settings.GROQ_API_KEY)

RAG_SYSTEM = f"""You are ET Radar AI — an intelligent Indian stock market assistant.
Today: {datetime.now().strftime('%d %B %Y')}. Market hours: 9:15 AM - 3:30 PM IST.

You have access to live NSE/BSE signals, corporate filings, bulk deals, and portfolio data.

Rules:
- Cite sources naturally ("Based on today's BSE filing...", "The bulk deal data shows...")
- Never explicitly say buy or sell — give analysis, let user decide
- Use Indian terminology: Sensex, Nifty, SEBI, FII, DII, crore, lakh, ₹
- Keep responses under 120 words unless user asks for detail
- End financial analysis with: "This is analysis only, not investment advice."
- If you don't have data for something, say so honestly"""


async def retrieve_relevant_signals(query: str, db) -> list[dict]:
    """TF-IDF retrieval of top 5 signals relevant to query."""
    result = await db.execute(
        select(Signal)
        .options(joinedload(Signal.stock))
        .order_by(desc(Signal.created_at))
        .limit(100)
    )
    signals = result.scalars().all()

    if not signals:
        return []

    corpus = [
        f"{s.one_line_summary} {s.reason} {s.stock.symbol if s.stock else ''}"
        for s in signals
    ]

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


async def retrieve_symbol_signals(query: str, db) -> list[dict]:
    """Auto-detect mentioned stock symbols and fetch their recent signals."""
    mentioned = re.findall(r'\b[A-Z]{2,8}\b', query)
    extra = []
    for sym in mentioned[:3]:
        try:
            sym_result = await db.execute(
                select(Signal)
                .join(Stock)
                .options(joinedload(Signal.stock))
                .where(Stock.symbol == sym)
                .order_by(desc(Signal.created_at))
                .limit(2)
            )
            sym_signals = sym_result.scalars().all()
            for s in sym_signals:
                extra.append({
                    "symbol": s.stock.symbol if s.stock else sym,
                    "signal_type": s.signal_type,
                    "summary": s.one_line_summary,
                    "confidence": s.confidence,
                    "action_hint": s.action_hint,
                    "reason": s.reason
                })
        except Exception:
            continue
    return extra


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
    """Returns last 6 messages in chronological order (oldest first)."""
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(desc(ChatMessage.created_at))
        .limit(6)
    )
    messages = result.scalars().all()
    history = []
    for m in reversed(messages):  # chronological order
        history.append({
            "role": "user" if m.role == "user" else "assistant",
            "content": m.content
        })
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


def _extract_symbols(query: str) -> list[str]:
    return list(dict.fromkeys(re.findall(r"\b[A-Z]{2,12}\b", query.upper())))


async def build_context_with_citations(
    db,
    user_message: str,
    session_id: str,
    include_portfolio: bool,
) -> tuple[str, list[dict]]:
    """Build prompt context and normalized source citations for chat responses."""
    context_parts: list[str] = []
    citations: list[dict] = []

    top_signals = await get_top_signals_today(db)
    if top_signals:
        context_parts.append("TODAY'S TOP SIGNALS:\n" + "\n".join(top_signals))

    relevant_signals = await retrieve_relevant_signals(user_message, db)
    symbol_signals = await retrieve_symbol_signals(user_message, db)
    all_signals = list({f"{s['symbol']}::{s['summary']}": s for s in (symbol_signals + relevant_signals)}.values())

    if all_signals:
        signal_lines: list[str] = []
        for idx, s in enumerate(all_signals[:8], start=1):
            cite_id = f"sig_{idx}"
            signal_lines.append(
                f"[{cite_id}] {s['symbol']} - {s['summary']} "
                f"(confidence {s['confidence']}%, action {s['action_hint']})"
            )
            citations.append({
                "id": cite_id,
                "type": "signal",
                "label": f"{s['symbol']} opportunity signal",
                "date": "recent",
                "source": "ET Radar Opportunity Engine",
            })
        context_parts.append("RELEVANT SIGNALS:\n" + "\n".join(signal_lines))

    mentioned_symbols = _extract_symbols(user_message)
    if mentioned_symbols:
        filings_result = await db.execute(
            select(Filing, Stock.symbol)
            .join(Stock, Stock.id == Filing.stock_id)
            .where(Stock.symbol.in_(mentioned_symbols))
            .order_by(desc(Filing.date))
            .limit(6)
        )
        filings = filings_result.all()

        filing_lines: list[str] = []
        for idx, (filing, symbol) in enumerate(filings, start=1):
            cite_id = f"fil_{idx}"
            snippet = " ".join((filing.raw_text or "").split())[:120] or f"{symbol} filing update"
            filing_lines.append(
                f"[{cite_id}] {symbol} filing on {filing.date.strftime('%d %b %Y')} "
                f"({filing.category}): {snippet}"
            )
            citations.append({
                "id": cite_id,
                "type": "filing",
                "label": snippet,
                "date": filing.date.strftime("%d %b %Y"),
                "source": "NSE / BSE Filing Database",
            })
        if filing_lines:
            context_parts.append("RELEVANT FILINGS:\n" + "\n".join(filing_lines))

    if include_portfolio:
        portfolio_summary = await get_portfolio_summary(session_id, db)
        if portfolio_summary:
            context_parts.append(f"USER PORTFOLIO:\n{portfolio_summary}")
            citations.append({
                "id": "portfolio",
                "type": "portfolio",
                "label": "User portfolio analysis",
                "date": "current",
                "source": "Uploaded CAMS/KFintech statement",
            })

    return "\n\n".join(context_parts), citations


def _run_groq_stream_sync(messages: list, system: str) -> str:
    """Synchronous Groq streaming — collects full response."""
    result = ""
    stream = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "system", "content": system}] + messages,
        max_tokens=400,
        temperature=0.5,
        stream=True
    )
    for chunk in stream:
        token = chunk.choices[0].delta.content or ""
        result += token
    return result


async def stream_groq(messages: list, system: str) -> AsyncGenerator[str, None]:
    """
    Async generator that runs Groq sync streaming in a thread pool,
    then yields word-by-word to simulate streaming for the frontend.
    """
    import asyncio

    try:
        tokens = await asyncio.to_thread(_run_groq_stream_sync, messages, system)
    except RateLimitError:
        import time
        time.sleep(5)
        try:
            tokens = await asyncio.to_thread(_run_groq_stream_sync, messages, system)
        except Exception:
            tokens = "I'm experiencing high load. Please try again in a moment."
    except Exception as e:
        tokens = f"Error generating response: {str(e)}"

    # Simulate streaming word by word
    words = tokens.split(" ")
    for i, word in enumerate(words):
        yield word + (" " if i < len(words) - 1 else "")
        await asyncio.sleep(0.02)
