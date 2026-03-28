"""
Portfolio Analyser Agent

Parses a CAMS/KFintech PDF statement using pdfplumber,
calculates XIRR, overlap, expense drag, and generates
AI-powered rebalancing advice using Groq.
"""

import json
import logging
import re
from io import BytesIO
from typing import Any, Optional

import pdfplumber
from groq import Groq, RateLimitError
from fastapi import HTTPException

from app.config import settings
from app.utils.xirr import compute_xirr

logger = logging.getLogger(__name__)

# Groq client
client = Groq(api_key=settings.GROQ_API_KEY)

REBALANCE_SYSTEM = """You are a SEBI-registered mutual fund advisor.
Give exactly 4 bullet points of portfolio advice.
Each bullet starts with •
Be specific — mention fund names and percentages.
Last line: 'Note: This is analysis only, not SEBI-registered investment advice.'
No other text."""

# Approximate expense ratios for common categories (%)
EXPENSE_RATIO_MAP = {
    "large cap": 1.1,
    "mid cap": 1.5,
    "small cap": 1.8,
    "flexi cap": 1.3,
    "elss": 1.5,
    "index": 0.2,
    "liquid": 0.3,
    "debt": 0.5,
    "hybrid": 1.2,
    "default": 1.0,
}


def extract_json_array(text: str) -> list:
    text = text.strip()
    if "```" in text:
        parts = text.split("```")
        for part in parts:
            part = part.strip()
            if part.startswith("json"):
                part = part[4:].strip()
            if part.startswith("["):
                text = part
                break
    start = text.find("[")
    end = text.rfind("]")
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)


def get_expense_ratio(fund_name: str) -> float:
    """Estimate expense ratio by matching fund name to category."""
    name_lower = fund_name.lower()
    for key, ratio in EXPENSE_RATIO_MAP.items():
        if key in name_lower:
            return ratio
    return EXPENSE_RATIO_MAP["default"]


def parse_pdf_statement(pdf_bytes: bytes) -> tuple[str, list[dict]]:
    """
    Extract text + fund data from a CAMS/KFintech PDF.
    Returns (full_text, list of funds).
    """
    full_text = ""
    funds = []

    try:
        with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                full_text += text + "\n"
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail="Could not parse PDF - ensure it is a CAMS or KFintech statement"
        )

    # Regex patterns for CAMS-style statements
    # Pattern: Fund name followed by NAV/units/value lines
    fund_pattern = re.compile(
        r"([A-Z][^\n]{10,80}(?:Fund|Scheme|Plan)[^\n]*)\n"
        r".*?Units?\s*:\s*([\d,]+\.?\d*)"
        r".*?NAV\s*(?:as on[^\n]*)?\s*:?\s*₹?\s*([\d,]+\.?\d*)"
        r".*?(?:Market Value|Current Value|Value)\s*:?\s*₹?\s*([\d,]+\.?\d*)",
        re.IGNORECASE | re.DOTALL
    )

    for match in fund_pattern.finditer(full_text[:8000]):
        try:
            fund_name = match.group(1).strip()
            
            # Filter out invalid fund names
            if any(invalid in fund_name for invalid in ["$", "USD", "Russell", "Growth of"]):
                continue
            if len(fund_name) < 5 or fund_name.replace(" ", "").isdigit():
                continue
            
            units = float(match.group(2).replace(",", ""))
            nav = float(match.group(3).replace(",", ""))
            value = float(match.group(4).replace(",", ""))
            if value > 0:
                funds.append({
                    "fund_name": fund_name,
                    "units": round(units, 3),
                    "current_nav": round(nav, 4),
                    "current_value": round(value, 2),
                })
        except (ValueError, IndexError):
            continue

    # Simple fallback: look for NAV lines
    if not funds:
        lines = full_text.split("\n")
        for i, line in enumerate(lines):
            if "current value" in line.lower() or "market value" in line.lower():
                val_match = re.search(r"[\d,]+\.?\d+", line)
                if val_match:
                    value = float(val_match.group().replace(",", ""))
                    if value > 1000:
                        # Find fund name in preceding lines
                        for j in range(max(0, i - 5), i):
                            if len(lines[j].strip()) > 15 and any(
                                kw in lines[j].lower()
                                for kw in ["fund", "scheme", "plan", "folio"]
                            ):
                                funds.append({
                                    "fund_name": lines[j].strip(),
                                    "units": 0,
                                    "current_nav": 0,
                                    "current_value": round(value, 2),
                                })
                                break

    return full_text, funds


def groq_parse_funds(full_text: str) -> list[dict]:
    """Fallback: use Groq to extract fund data from statement text."""
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "Extract mutual fund data from this statement text. Return ONLY a JSON array: [{\"fund_name\":str,\"current_value\":float,\"units\":float,\"current_nav\":float}]. No other text."
                },
                {
                    "role": "user",
                    "content": f"Statement text:\n{full_text[:3000]}"
                }
            ],
            max_tokens=500,
            temperature=0.1
        )
        raw = response.choices[0].message.content
        return extract_json_array(raw)
    except Exception as e:
        logger.error(f"Groq PDF fallback failed: {e}")
        return []


def compute_overlap(funds: list[dict]) -> list[dict]:
    """
    Estimate fund overlap using category comparison.
    Returns list of {fund_a, fund_b, overlap_pct}.
    """
    overlaps = []
    categories = {}

    for fund in funds:
        name = fund["fund_name"].lower()
        if "large cap" in name or "bluechip" in name or "nifty 50" in name:
            categories[fund["fund_name"]] = "large_cap"
        elif "mid cap" in name:
            categories[fund["fund_name"]] = "mid_cap"
        elif "small cap" in name:
            categories[fund["fund_name"]] = "small_cap"
        elif "flexi" in name or "multi cap" in name:
            categories[fund["fund_name"]] = "flexi"
        elif "index" in name or "nifty" in name or "sensex" in name:
            categories[fund["fund_name"]] = "index"
        else:
            categories[fund["fund_name"]] = "other"

    fund_names = list(categories.keys())
    for i in range(len(fund_names)):
        for j in range(i + 1, len(fund_names)):
            a, b = fund_names[i], fund_names[j]
            cat_a, cat_b = categories[a], categories[b]
            if cat_a == cat_b and cat_a != "other":
                overlap = 62  # high overlap for same category
            elif {cat_a, cat_b} <= {"large_cap", "flexi", "index"}:
                overlap = 45  # moderate overlap
            elif cat_a != "other" and cat_b != "other":
                overlap = 20  # low overlap
            else:
                continue
            overlaps.append({
                "fund_a": a,
                "fund_b": b,
                "overlap_pct": overlap
            })

    return overlaps[:5]  # max 5 pairs


def generate_rebalancing_advice(funds: list[dict], total_value: float,
                                xirr: Optional[float]) -> str:
    """Use Groq to generate 4-bullet rebalancing advice."""
    fund_lines = []
    for f in funds:
        alloc = (f["current_value"] / total_value * 100) if total_value > 0 else 0
        fund_lines.append(f"- {f['fund_name']}: ₹{f['current_value']:,.0f} ({alloc:.1f}%)")

    xirr_str = f"{xirr:.1f}%" if xirr is not None else "N/A"
    user_msg = f"""Portfolio total: ₹{total_value:,.0f}, XIRR: {xirr_str}
Funds:
{chr(10).join(fund_lines)}

Give 4 specific rebalancing suggestions."""

    for attempt in range(2):
        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": REBALANCE_SYSTEM},
                    {"role": "user", "content": user_msg}
                ],
                max_tokens=300,
                temperature=0.3
            )
            return response.choices[0].message.content.strip()
        except RateLimitError:
            import time
            time.sleep(5)
            if attempt == 1:
                return ("• Review your asset allocation regularly.\n"
                        "• Ensure diversification across market caps.\n"
                        "• Consider index funds for core allocation.\n"
                        "• Note: This is analysis only, not SEBI-registered investment advice.")
            continue
        except Exception as e:
            logger.error(f"Rebalancing advice failed (attempt {attempt + 1}): {e}")
            if attempt == 0:
                import time
                time.sleep(1)
                continue
            return ("• Review your asset allocation regularly.\n"
                    "• Ensure diversification across market caps.\n"
                    "• Consider index funds for core allocation.\n"
                    "• Note: This is analysis only, not SEBI-registered investment advice.")

    return "• Note: This is analysis only, not SEBI-registered investment advice."


async def analyse_mutual_fund_pdf(
    pdf_bytes: bytes,
    session_id: str,
    db,
) -> dict[str, Any]:
    """
    Main entry point: parse PDF, compute metrics, generate AI advice.
    Raises HTTPException 400 for bad PDF, 413 for >10MB, 500 for failures.
    """
    import asyncio
    from app.models.tables import Portfolio

    # Size check
    if len(pdf_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large — maximum 10MB allowed")

    # Parse PDF in thread to not block event loop
    try:
        full_text, funds = await asyncio.to_thread(parse_pdf_statement, pdf_bytes)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail="Could not parse PDF - ensure it is a CAMS or KFintech statement"
        )

    # Validate that this is an Indian MF statement
    indian_keywords = ['ISIN', 'Folio', 'NAV', 'Units', 'SIP',
                       'CAMS', 'KFintech', 'Karvy', 'AMFI',
                       'Mutual Fund', 'Scheme']
    keyword_count = sum(1 for kw in indian_keywords
                        if kw.lower() in full_text.lower())
    
    if keyword_count < 2:
        raise HTTPException(
            status_code=400,
            detail="This does not appear to be a CAMS or KFintech statement. "
                   "Please upload an Indian mutual fund consolidated statement. "
                   "Download it from camsonline.com or kfintech.com"
        )

    # If no funds found, use Groq fallback
    if not funds:
        try:
            funds = await asyncio.to_thread(groq_parse_funds, full_text)
        except Exception:
            funds = []

    # Validate minimum funds
    if not funds:
        raise HTTPException(
            status_code=400,
            detail="Could not extract fund data from this PDF. "
                   "Ensure it is a text-based CAMS or KFintech statement "
                   "and not a scanned image."
        )

    # Calculate totals
    total_value = sum(f.get("current_value", 0) for f in funds)

    # Compute allocations
    for f in funds:
        f["allocation_pct"] = round(
            (f["current_value"] / total_value * 100) if total_value > 0 else 0, 1
        )

    # XIRR — simplified: use total value as single inflow, no purchase history in PDF
    # Return None if can't compute
    xirr_value = None  # Would need purchase dates from PDF for real XIRR

    # Expense drag
    expense_drag = sum(
        f["current_value"] * get_expense_ratio(f["fund_name"]) / 100
        for f in funds
    )

    # Overlap
    overlap = compute_overlap(funds)

    # Rebalancing advice
    rebalancing = await asyncio.to_thread(
        generate_rebalancing_advice, funds, total_value, xirr_value
    )

    result = {
        "session_id": session_id,
        "total_value": round(total_value, 2),
        "xirr": xirr_value,
        "funds": funds,
        "overlap": overlap,
        "expense_drag": round(expense_drag, 2),
        "rebalancing_suggestion": rebalancing,
    }

    # Save to Portfolio table
    try:
        portfolio = Portfolio(
            session_id=session_id,
            raw_json=json.dumps(result),
            total_value=total_value,
            xirr=xirr_value,
        )
        db.add(portfolio)
        await db.commit()
    except Exception as e:
        logger.error(f"Portfolio save failed: {e}")

    return result
