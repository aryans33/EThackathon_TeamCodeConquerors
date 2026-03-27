import asyncio
import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import func, select

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import AsyncSessionLocal
from app.models.tables import OHLCV, Signal, Stock


SCRIPTS_DIR = Path(__file__).resolve().parent


def _run_script(script_name: str) -> bool:
    script_path = SCRIPTS_DIR / script_name
    if not script_path.exists():
        return False

    print(f"\n▶ Running {script_name}...")
    result = subprocess.run([sys.executable, str(script_path)], check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)
    return True


async def _print_summary() -> None:
    async with AsyncSessionLocal() as db:
        stocks = int(await db.scalar(select(func.count(Stock.id))) or 0)
        ohlcv_rows = int(await db.scalar(select(func.count(OHLCV.id))) or 0)
        signals = int(await db.scalar(select(func.count(Signal.id))) or 0)

    print(f"\nSeeding complete. Stocks: {stocks}, OHLCV rows: {ohlcv_rows}, Signals: {signals}")


def main() -> None:
    print("🚀 Starting all seed scripts...")

    _run_script("seed_data.py")
    _run_script("seed_ohlcv.py")

    if _run_script("seed_signals.py"):
        print("✅ seed_signals.py executed")
    else:
        print("ℹ️  seed_signals.py not found, skipping")

    asyncio.run(_print_summary())


if __name__ == "__main__":
    main()
