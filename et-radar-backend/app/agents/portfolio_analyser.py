"""
Portfolio Analyser Agent

Analyses a user's holdings: calculates total value, P&L,
sector weights, XIRR, and generates AI-powered insights.
"""

import logging
from datetime import date
from typing import Any

import yfinance as yf

from app.config import settings
from app.utils.xirr import compute_xirr

logger = logging.getLogger(__name__)


async def analyse_portfolio(
    holdings: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Analyse portfolio holdings.

    Args:
        holdings: list of dicts with keys: symbol, qty, avg_price, buy_date

    Returns:
        Dict with total_value, total_invested, pnl, pnl_pct, xirr, per_stock analysis.
    """
    results = []
    total_invested = 0.0
    total_current = 0.0
    cashflows = []  # For XIRR: (date, amount)

    for h in holdings:
        symbol = h.get("symbol", "").upper()
        qty = float(h.get("qty", 0))
        avg_price = float(h.get("avg_price", 0))
        buy_date_str = h.get("buy_date", "")

        if not symbol or qty <= 0:
            continue

        nse_symbol = f"{symbol}.NS"
        invested = qty * avg_price
        total_invested += invested

        # Add purchase cashflow (outflow = negative)
        try:
            buy_dt = date.fromisoformat(buy_date_str)
            cashflows.append((buy_dt, -invested))
        except (ValueError, TypeError):
            buy_dt = None

        # Fetch current price
        try:
            ticker = yf.Ticker(nse_symbol)
            info = ticker.fast_info
            current_price = getattr(info, "last_price", None) or avg_price
        except Exception as e:
            logger.warning(f"Could not fetch price for {nse_symbol}: {e}")
            current_price = avg_price

        current_value = qty * current_price
        total_current += current_value
        pnl = current_value - invested
        pnl_pct = (pnl / invested * 100) if invested > 0 else 0

        results.append({
            "symbol": symbol,
            "qty": qty,
            "avg_price": round(avg_price, 2),
            "current_price": round(current_price, 2),
            "invested": round(invested, 2),
            "current_value": round(current_value, 2),
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "weight_pct": 0,  # filled below
        })

    # Calculate weights
    for r in results:
        if total_current > 0:
            r["weight_pct"] = round(r["current_value"] / total_current * 100, 2)

    # Calculate XIRR
    xirr_value = None
    if cashflows and total_current > 0:
        cashflows.append((date.today(), total_current))  # current value as inflow
        xirr_value = compute_xirr(cashflows)

    total_pnl = total_current - total_invested
    total_pnl_pct = (total_pnl / total_invested * 100) if total_invested > 0 else 0

    # Generate AI insights
    insights = await _generate_insights(results, total_pnl_pct)

    return {
        "total_invested": round(total_invested, 2),
        "total_value": round(total_current, 2),
        "total_pnl": round(total_pnl, 2),
        "total_pnl_pct": round(total_pnl_pct, 2),
        "xirr": round(xirr_value * 100, 2) if xirr_value is not None else None,
        "holdings": results,
        "insights": insights,
    }


async def _generate_insights(
    holdings: list[dict], total_pnl_pct: float
) -> list[str]:
    """Use Claude to generate portfolio insights."""
    try:
        import anthropic
        import json

        summary_lines = []
        for h in holdings:
            summary_lines.append(
                f"{h['symbol']}: ₹{h['current_value']:,.0f} ({h['pnl_pct']:+.1f}%), "
                f"weight {h['weight_pct']:.1f}%"
            )

        prompt = (
            f"Portfolio summary (total return: {total_pnl_pct:+.1f}%):\n"
            + "\n".join(summary_lines)
            + "\n\nProvide 3-5 brief, actionable insights about this portfolio "
            "(concentration risk, underperformers, rebalancing suggestions). "
            "Return as JSON array of strings."
        )

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = response.content[0].text.strip()
        if raw.startswith("["):
            return json.loads(raw)
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start >= 0 and end > start:
            return json.loads(raw[start:end])
        return [raw]

    except Exception as e:
        logger.error(f"Insight generation failed: {e}")
        return ["Unable to generate AI insights at this time."]
