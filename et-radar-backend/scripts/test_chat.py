# scripts/test_chat.py
import httpx
import json

url = "http://localhost:8000/api/chat/"
payload = {
    "message": "What did you find in the latest BSE filings for Reliance or any other Nifty stocks? Any interesting signals?",
    "session_id": "demo-session-999",
    "include_portfolio": False
}

print("🗣️  Connecting to ET Radar AI...")
with httpx.stream("POST", url, json=payload, timeout=None) as response:
    print("-" * 50)
    for chunk in response.iter_text():
        print(chunk, end="", flush=True)
    print("\n" + "-" * 50)
