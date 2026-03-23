"""
Utility functions for formatting data for API responses and display.
"""

from datetime import datetime, date
from typing import Any, Optional


def format_currency(value: float, symbol: str = "₹") -> str:
    """Format a number as Indian currency."""
    if abs(value) >= 1_00_00_000:  # 1 Crore
        return f"{symbol}{value / 1_00_00_000:.2f} Cr"
    elif abs(value) >= 1_00_000:  # 1 Lakh
        return f"{symbol}{value / 1_00_000:.2f} L"
    else:
        return f"{symbol}{value:,.2f}"


def format_large_number(value: int) -> str:
    """Format large numbers with abbreviated suffixes."""
    if abs(value) >= 1_00_00_000:
        return f"{value / 1_00_00_000:.2f} Cr"
    elif abs(value) >= 1_00_000:
        return f"{value / 1_00_000:.2f} L"
    elif abs(value) >= 1_000:
        return f"{value / 1_000:.1f} K"
    return str(value)


def format_percentage(value: float, decimal_places: int = 2) -> str:
    """Format a number as a percentage with sign."""
    return f"{value:+.{decimal_places}f}%"


def format_date(dt: Any, fmt: str = "%d %b %Y") -> str:
    """Format a date or datetime object to string."""
    if isinstance(dt, datetime):
        return dt.strftime(fmt)
    elif isinstance(dt, date):
        return dt.strftime(fmt)
    return str(dt)


def truncate_text(text: str, max_length: int = 200, suffix: str = "...") -> str:
    """Truncate text to max_length, adding suffix if truncated."""
    if len(text) <= max_length:
        return text
    return text[: max_length - len(suffix)] + suffix


def build_ohlcv_dict(record: Any) -> dict:
    """Convert an OHLCV record to a serializable dict."""
    return {
        "date": record.date.isoformat(),
        "open": record.open,
        "high": record.high,
        "low": record.low,
        "close": record.close,
        "volume": record.volume,
    }


def build_signal_dict(signal: Any, include_stock: bool = True) -> dict:
    """Convert a Signal record to a serializable dict."""
    result = {
        "id": signal.id,
        "signal_type": signal.signal_type,
        "confidence": signal.confidence,
        "one_line_summary": signal.one_line_summary,
        "action_hint": signal.action_hint,
        "reason": signal.reason,
        "created_at": signal.created_at.isoformat(),
    }
    if include_stock and hasattr(signal, "stock") and signal.stock:
        result["symbol"] = signal.stock.symbol
        result["stock_name"] = signal.stock.name
    return result
