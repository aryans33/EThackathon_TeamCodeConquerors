from groq import Groq
import json
from app.config import settings
from app.models.tables import Filing, Signal, Alert, Stock
from app.database import AsyncSessionLocal
from sqlalchemy import select

# Groq client initialization
client = Groq(api_key=settings.GROQ_API_KEY)

SYSTEM_PROMPT = """You are a SEBI-trained financial signal analyst specialising in Indian equity markets (NSE/BSE).

Analyse the corporate filing and return ONLY a valid JSON object — no preamble, no explanation, no markdown.

Return this exact JSON structure:
{
  "signal_type": "<one of: earnings_beat, earnings_miss, insider_buy, insider_sell, bulk_deal_buy, bulk_deal_sell, regulatory_risk, management_change, expansion, fundraise, debt_reduction>",
  "confidence": <integer 0-100>,
  "one_line_summary": "<max 12 words describing the key event>",
  "action_hint": "<one of: buy_watch, sell_watch, neutral>",
  "reason": "<max 25 words explaining why this matters for investors>"
}

Scoring rules:
- confidence 80-100: genuinely material, market-moving event
- confidence 60-79: notable but not immediately actionable  
- confidence 30-59: routine disclosure, low impact
- confidence 0-29: boilerplate, no signal value

Be conservative — most filings are routine (score 20-40).
Only score >70 for earnings surprises, large insider trades, major capex, or regulatory actions.
For ambiguous filings, default to neutral action_hint and confidence 35.
Never hallucinate financial figures not present in the text."""

async def analyze_filing(filing: Filing, stock: Stock) -> Signal | None:
    user_message = f"""Company: {stock.name} ({stock.symbol})
Sector: {stock.sector or 'Unknown'}
Filing category: {filing.category}
Filing date: {filing.date}
Filing text:
{filing.raw_text[:2500]}"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"}
        )

        raw = response.choices[0].message.content
        data = json.loads(raw)

        signal = Signal(
            stock_id=stock.id,
            filing_id=filing.id,
            signal_type=data.get("signal_type", "expansion"),
            confidence=max(0, min(100, int(data.get("confidence", 30)))),
            one_line_summary=data.get("one_line_summary", "Filing analysed")[:200],
            action_hint=data.get("action_hint", "neutral"),
            reason=data.get("reason", "")[:500]
        )
        return signal

    except Exception as e:
        print(f"Radar agent error for filing {filing.id}: {e}")
        # Return fallback signal
        return Signal(
            stock_id=stock.id,
            filing_id=filing.id,
            signal_type="expansion",
            confidence=20,
            one_line_summary="Filing received — pending detailed analysis",
            action_hint="neutral",
            reason="Analysis failed or model busy. Review raw filing manually."
        )
