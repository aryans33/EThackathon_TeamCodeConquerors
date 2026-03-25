"""
Opportunity Radar Agent — uses Groq (llama-3.3-70b-versatile)
to classify corporate filings into actionable trading signals.
"""

from groq import Groq, RateLimitError  # type: ignore[import]
import json
import time
from app.config import settings  # type: ignore[import]
from app.models.tables import Filing, Signal, Stock  # type: ignore[import]

# Groq client
client = Groq(api_key=settings.GROQ_API_KEY)

SYSTEM_PROMPT = """You are a SEBI-trained financial signal analyst specialising in Indian equity markets (NSE/BSE).

Analyse the corporate filing and return ONLY a valid JSON object.
Return ONLY the JSON object. No explanation, no markdown, no backticks.

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


def extract_json(text: str) -> dict:
    """Robust JSON extractor — handles markdown fences and noise."""
    text = text.strip()
    # Remove markdown fences
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part.removeprefix("json").strip()
            if part.startswith("{"):
                text = part
                break
    # Find first { to last }
    idx_open = text.find("{")
    idx_close = text.rfind("}")
    if idx_open != -1 and idx_close != -1:
        text = "".join(list(text)[idx_open : idx_close + 1])  # type: ignore[misc]
    return json.loads(text)


def extract_json_array(text: str) -> list:
    """Robust JSON array extractor."""
    text = text.strip()
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part.removeprefix("json").strip()
            if part.startswith("["):
                text = part
                break
    idx_open = text.find("[")
    idx_close = text.rfind("]")
    if idx_open != -1 and idx_close != -1:
        text = "".join(list(text)[idx_open : idx_close + 1])  # type: ignore[misc]
    return json.loads(text)


def analyze_filing(filing: Filing, stock: Stock) -> Signal | None:
    """Synchronous filing analyser (called from async context via run_in_executor)."""
    user_message = f"""Company: {stock.name} ({stock.symbol})
Sector: {stock.sector or 'Unknown'}
Filing category: {filing.category}
Filing date: {filing.date}
Filing text:
{filing.raw_text[:2500]}"""

    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=300,
                temperature=0.1
            )

            raw = response.choices[0].message.content.strip()
            data = extract_json(raw)

            signal = Signal(
                stock_id=stock.id,
                filing_id=filing.id,
                signal_type=data.get("signal_type", "expansion"),
                confidence=max(0, min(100, int(data.get("confidence", 30)))),
                one_line_summary=data.get("one_line_summary", "Filing analysed")[:200],
                action_hint=data.get("action_hint", "neutral"),
                reason=data.get("reason", "")[:500]
            )
            # Rate limit: sleep 0.2s between calls
            time.sleep(0.2)
            return signal

        except RateLimitError:
            print(f"Groq rate limit hit for filing {filing.id}, sleeping 5s...")
            time.sleep(5)
            if attempt == 1:
                return None
            continue
        except Exception as e:
            print(f"Radar agent error for filing {filing.id} (attempt {attempt + 1}): {e}")
            if attempt == 0:
                time.sleep(1)
                continue
            # Return low-confidence neutral signal on final failure
            return Signal(
                stock_id=stock.id,
                filing_id=filing.id,
                signal_type="expansion",
                confidence=20,
                one_line_summary="Filing received — pending detailed analysis",
                action_hint="neutral",
                reason="Analysis failed or model busy. Review raw filing manually."
            )

    return None
