"""Chat route — SSE streaming with Groq via thread pool."""

from fastapi import APIRouter, Depends, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, AsyncSessionLocal
from app.agents.rag_chat import (
    retrieve_relevant_signals,
    retrieve_symbol_signals,
    get_portfolio_summary,
    get_chat_history,
    get_top_signals_today,
    stream_groq,
    RAG_SYSTEM,
)
from app.models.tables import ChatMessage

router = APIRouter(prefix="/api/chat")

CORS_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}


class ChatRequest(BaseModel):
    message: str
    session_id: str
    include_portfolio: bool = False


@router.options("/")
async def chat_options():
    """Handle CORS preflight for streaming endpoint."""
    return Response(
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "*",
        }
    )


@router.post("/")
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    if not request.message.strip():
        return Response(content="Message cannot be empty", status_code=400)

    # Gather context
    relevant_signals = await retrieve_relevant_signals(request.message, db)
    symbol_signals = await retrieve_symbol_signals(request.message, db)
    chat_history = await get_chat_history(request.session_id, db)
    top_signals = await get_top_signals_today(db)
    portfolio_summary = (
        await get_portfolio_summary(request.session_id, db)
        if request.include_portfolio
        else None
    )

    # Save user message
    user_msg_db = ChatMessage(
        session_id=request.session_id,
        role="user",
        content=request.message
    )
    db.add(user_msg_db)
    await db.commit()

    # Build system context
    context_parts = [RAG_SYSTEM]
    if top_signals:
        context_parts.append("TODAY'S TOP SIGNALS:\n" + "\n".join(top_signals))

    # Merge symbol-specific signals first, then general RAG signals
    all_signals = {s["symbol"]: s for s in (symbol_signals + relevant_signals)}.values()
    if all_signals:
        context_parts.append(
            "RELEVANT SIGNALS:\n" +
            "\n".join(f"{s['symbol']}: {s['summary']} (confidence: {s['confidence']}%)"
                      for s in all_signals)
        )
    if portfolio_summary:
        context_parts.append(f"USER PORTFOLIO:\n{portfolio_summary}")

    full_system_context = "\n\n".join(context_parts)

    # Build message history + current message
    messages = list(chat_history)
    messages.append({"role": "user", "content": request.message})

    # Collected full response text for DB save
    full_response_holder = {"text": ""}

    async def generate():
        async for token in stream_groq(messages, full_system_context):
            full_response_holder["text"] += token
            yield token

        # Save assistant response using a new DB session
        async with AsyncSessionLocal() as save_db:
            save_db.add(ChatMessage(
                session_id=request.session_id,
                role="assistant",
                content=full_response_holder["text"]
            ))
            await save_db.commit()

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers=CORS_HEADERS,
    )
