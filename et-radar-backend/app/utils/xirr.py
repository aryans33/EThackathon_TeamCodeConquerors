"""
XIRR (Extended Internal Rate of Return) calculator.

Computes the annualised return for irregular cashflows
using Newton-Raphson iteration via scipy.
"""

from datetime import date
from typing import Optional

from scipy.optimize import brentq


def compute_xirr(
    cashflows: list[tuple[date, float]],
    guess: float = 0.1,
) -> Optional[float]:
    """
    Compute XIRR for a list of (date, amount) cashflows.

    Negative amounts are outflows (investments), positives are inflows (withdrawals/current value).

    Args:
        cashflows: List of (date, amount) tuples.
        guess: Initial guess for the rate.

    Returns:
        The XIRR as a decimal (e.g. 0.15 = 15%), or None if computation fails.
    """
    if not cashflows or len(cashflows) < 2:
        return None

    # Sort by date
    cashflows = sorted(cashflows, key=lambda x: x[0])

    # Need at least one positive and one negative cashflow
    positives = sum(1 for _, amt in cashflows if amt > 0)
    negatives = sum(1 for _, amt in cashflows if amt < 0)
    if positives == 0 or negatives == 0:
        return None

    first_date = cashflows[0][0]

    def xnpv(rate: float) -> float:
        """Net present value for irregular cashflows."""
        return sum(
            amt / (1 + rate) ** ((dt - first_date).days / 365.0)
            for dt, amt in cashflows
        )

    try:
        # Use Brent's method to find the root in a reasonable range
        return brentq(xnpv, -0.99, 10.0, maxiter=1000)
    except (ValueError, RuntimeError):
        # Brent's method failed — try a narrower range
        try:
            return brentq(xnpv, -0.5, 5.0, maxiter=1000)
        except (ValueError, RuntimeError):
            return None
