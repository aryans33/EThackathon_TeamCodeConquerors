from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, AsyncSessionLocal
from app.agents.rag_chat import (
    retrieve_relevant_signals, get_portfolio_summary,
    get_chat_history, get_top_signals_today,
    RAG_SYSTEM
)
from app.models.tables import ChatMessage
from app.config import settings
from groq import AsyncGroq
import asyncio

router = APIRouter(prefix="/api/chat")

# Groq Async Client
groq_client = AsyncGroq(api_key=settings.GROQ_API_KEY)

class ChatRequest(BaseModel):
    message: str
    session_id: str
    include_portfolio: bool = False

@router.post("/")
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    print(f"🔍 Chat Request: {request.message}")
    
    # Gather context sequentially
    print("📡 Step 1: Retrieving relevant signals (RAG)...")
    relevant_signals = await retrieve_relevant_signals(request.message, db)
    
    print("💬 Step 2: Fetching chat history...")
    chat_history = await get_chat_history(request.session_id, db)
    
    print("🔝 Step 3: Fetching top signals of the day...")
    top_signals = await get_top_signals_today(db)
    
    print("💼 Step 4: Checking portfolio (if enabled)...")
    portfolio_summary = await get_portfolio_summary(request.session_id, db) if request.include_portfolio else None

    # Save user message to DB
    print("💾 Saving user message to database...")
    user_msg_db = ChatMessage(session_id=request.session_id, role="user", content=request.message)
    db.add(user_msg_db)
    await db.commit()

    # Build system context
    context_parts = [RAG_SYSTEM]
    if top_signals:
        context_parts.append("TODAY'S TOP SIGNALS:\n" + "\n".join(top_signals))
    if relevant_signals:
        context_parts.append("RELEVANT SIGNALS:\n" + "\n".join([f"{s['symbol']}: {s['summary']}" for s in relevant_signals]))
    if portfolio_summary:
        context_parts.append(f"USER PORTFOLIO:\n{portfolio_summary}")
    
    full_system_context = "\n\n".join(context_parts)

    async def generate():
        full_response = ""
        try:
            # Build messages for Groq
            messages = [{"role": "system", "content": full_system_context}]
            # Add history
            for msg in chat_history:
                messages.append(msg)
            # Add current user message
            messages.append({"role": "user", "content": request.message})
            
            # Stream from Groq
            stream = await groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                stream=True
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    text = chunk.choices[0].delta.content
                    full_response += text
                    yield text
            
            # Save assistant response to DB
            async with AsyncSessionLocal() as save_db:
                save_db.add(ChatMessage(
                    session_id=request.session_id,
                    role="assistant",
                    content=full_response
                ))
                await save_db.commit()
                
        except Exception as e:
            print(f"Groq Chat Error: {str(e)}")
            yield f"\n[AI Error: {str(e)}]"

    return StreamingResponse(generate(), media_type="text/plain")
