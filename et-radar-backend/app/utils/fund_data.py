"""
Fund data utilities — NAV fetching and fund metadata.
Uses stdlib urllib to avoid third-party dependencies in type checking.
"""

import asyncio
import math
import urllib.request
from typing import Optional


AMFI_NAV_URL = "https://www.amfiindia.com/spages/NAVAll.txt"


def _fetch_amfi_raw() -> bytes:
    """Sync fetch of AMFI NAV file using stdlib urllib."""
    req = urllib.request.Request(AMFI_NAV_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.read()  # type: ignore[return-value]


async def fetch_current_nav(scheme_name: str) -> Optional[float]:
    """
    Fetch current NAV for a mutual fund scheme from AMFI.
    Returns None if not found.
    """
    try:
        fetch_fn = _fetch_amfi_raw
        raw: bytes = await asyncio.to_thread(fetch_fn)  # type: ignore[arg-type]
        text: str = raw.decode("utf-8", errors="ignore")

        # Build prefix safely — avoids str[int:int] slice that Pyre2 rejects
        name_lower: str = scheme_name.lower()
        prefix: str = name_lower if len(name_lower) <= 20 else name_lower[0:20]  # type: ignore[index]

        for line in text.splitlines():
            parts = line.split(";")
            if len(parts) >= 5:
                nav_name = parts[3].strip().lower()
                if nav_name.startswith(prefix):
                    try:
                        return float(parts[4].strip())
                    except ValueError:
                        continue
    except Exception:
        pass
    return None


def estimate_expense_ratio(fund_name: str) -> float:
    """
    Estimate expense ratio % based on fund name/category.
    Used when actual TER is not available in the statement.
    """
    name = fund_name.lower()
    if "index" in name or "nifty" in name or "sensex" in name:
        return 0.2
    elif "liquid" in name or "overnight" in name:
        return 0.3
    elif "debt" in name or "bond" in name or "gilt" in name:
        return 0.5
    elif "large cap" in name or "bluechip" in name:
        return 1.1
    elif "flexi" in name or "multi cap" in name:
        return 1.3
    elif "mid cap" in name:
        return 1.5
    elif "small cap" in name or "elss" in name:
        return 1.8
    elif "hybrid" in name or "balanced" in name:
        return 1.2
    else:
        return 1.0


def calculate_expense_drag(funds: list) -> float:
    """
    Compute annual expense drag in rupees.
    expense_drag = sum(fund_value * expense_ratio / 100)
    """
    total: float = 0.0
    for f in funds:
        value: float = float(f.get("current_value", 0))
        er: float = estimate_expense_ratio(str(f.get("fund_name", "")))
        total = total + (value * er / 100.0)
    # Use math.floor for 2dp — avoids Pyre2's broken round() overload stubs
    return math.floor(total * 100.0) / 100.0
