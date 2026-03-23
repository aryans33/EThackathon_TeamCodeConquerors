import asyncio
import sys
import os

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.tasks.fetch_prices import _fetch_all_prices_async
from app.tasks.fetch_filings import _fetch_filings_async
from app.tasks.run_radar import _run_radar_async

async def main():
    print("🚀 Starting Production Seeding...")
    
    print("\nStep 1: Fetching OHLCV data for all symbols (yfinance)...")
    try:
        await _fetch_all_prices_async()
        print("✅ OHLCV data complete.")
    except Exception as e:
        print(f"❌ OHLCV fetch failed: {e}")

    print("\nStep 2: Fetching latest corporate filings (BSE)...")
    try:
        await _fetch_filings_async()
        print("✅ Filings data complete.")
    except Exception as e:
        print(f"❌ Filings fetch failed: {e}")
    
    print("\nStep 3: Running Opportunity Radar AI analysis...")
    try:
        await _run_radar_async()
        print("✅ Signals generated successfully.")
    except Exception as e:
        print(f"❌ AI Radar analysis failed: {e}")
    
    print("\n🎉 Seeding complete!")

if __name__ == "__main__":
    asyncio.run(main())
