"""Chat route — SSE streaming with Groq via thread pool."""

import json

from fastapi import APIRouter, Depends, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, AsyncSessionLocal
from app.agents.rag_chat import (
    get_chat_history,
    build_context_with_citations,
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
    context, citations = await build_context_with_citations(
        db=db,
        user_message=request.message,
        session_id=request.session_id,
        include_portfolio=request.include_portfolio,
    )
    chat_history = await get_chat_history(request.session_id, db)

    # Save user message
    user_msg_db = ChatMessage(
        session_id=request.session_id,
        role="user",
        content=request.message
    )
    db.add(user_msg_db)
    await db.commit()

    full_system_context = (
        f"{RAG_SYSTEM}\n\n"
        "IMPORTANT: When referencing context facts, include citation tags in text using [CITE:id]. "
        "Only use citation ids provided in the context section below. Do not invent ids.\n\n"
        f"CONTEXT WITH SOURCE IDS:\n{context}"
    )

    # Build message history + current message
    messages = list(chat_history)
    messages.append({"role": "user", "content": request.message})

    # Collected full response text for DB save
    full_response_holder = {"text": ""}

    async def generate():
        # Send citations metadata first so frontend can render source panel.
        yield f"data: {json.dumps({'type': 'citations', 'citations': citations})}\n\n"

        async for token in stream_groq(messages, full_system_context):
            full_response_holder["text"] += token
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        yield "data: [DONE]\n\n"

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
