export const mockSignals = [
    { id: 1, stock: { symbol: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Automobile" }, signal_type: "earnings_beat", confidence: 84, one_line_summary: "Q3 PAT up 48% YoY beats estimates", action_hint: "buy_watch", reason: "Strong EV sales drove margin expansion beyond analyst consensus", created_at: new Date(Date.now() - 7200000).toISOString() },
    { id: 2, stock: { symbol: "HDFCBANK", name: "HDFC Bank", sector: "Banking" }, signal_type: "bulk_deal_buy", confidence: 76, one_line_summary: "Goldman Sachs buys 1.5cr shares at ₹1642", action_hint: "buy_watch", reason: "Institutional accumulation at support level signals confidence", created_at: new Date(Date.now() - 10800000).toISOString() },
    { id: 3, stock: { symbol: "INFY", name: "Infosys Ltd", sector: "IT" }, signal_type: "management_change", confidence: 61, one_line_summary: "COO resignation announced post market hours", action_hint: "sell_watch", reason: "Key leadership exit may signal strategic uncertainty", created_at: new Date(Date.now() - 18000000).toISOString() },
    { id: 4, stock: { symbol: "RELIANCE", name: "Reliance Industries", sector: "Energy" }, signal_type: "expansion", confidence: 71, one_line_summary: "New green energy capex of ₹75,000 cr announced", action_hint: "buy_watch", reason: "Large capex signals long term revenue visibility", created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 5, stock: { symbol: "SBIN", name: "State Bank of India", sector: "Banking" }, signal_type: "earnings_miss", confidence: 68, one_line_summary: "NPA provisions rise 22% dragging Q3 profit", action_hint: "sell_watch", reason: "Asset quality deterioration worse than street estimates", created_at: new Date(Date.now() - 5400000).toISOString() }
]

export const mockStocks = [
    { symbol: "RELIANCE", name: "Reliance Industries", exchange: "NSE", sector: "Energy" },
    { symbol: "TCS", name: "Tata Consultancy Services", exchange: "NSE", sector: "IT" },
    { symbol: "INFY", name: "Infosys Ltd", exchange: "NSE", sector: "IT" },
    { symbol: "HDFCBANK", name: "HDFC Bank", exchange: "NSE", sector: "Banking" },
    { symbol: "ICICIBANK", name: "ICICI Bank", exchange: "NSE", sector: "Banking" },
    { symbol: "WIPRO", name: "Wipro Ltd", exchange: "NSE", sector: "IT" },
    { symbol: "SBIN", name: "State Bank of India", exchange: "NSE", sector: "Banking" },
    { symbol: "LT", name: "Larsen & Toubro", exchange: "NSE", sector: "Infrastructure" },
    { symbol: "TITAN", name: "Titan Company", exchange: "NSE", sector: "Consumer" },
    { symbol: "BAJFINANCE", name: "Bajaj Finance", exchange: "NSE", sector: "NBFC" }
]

export const mockPatterns = [
    { pattern_name: "52_week_breakout", detected_today: true, explanation: "RELIANCE has crossed its 52-week high today at ₹2,901. This suggests strong buying momentum and could attract more institutional interest. Watch for volume confirmation above ₹2,950.", backtest: { occurrences: 7, success_rate: 0.71, avg_return_pct: 8.4 } },
    { pattern_name: "golden_cross", detected_today: true, explanation: "The 50-day moving average has crossed above the 200-day moving average — a classic bullish signal called Golden Cross. Historically this has preceded multi-week rallies. Watch for sustained closes above ₹2,850.", backtest: { occurrences: 3, success_rate: 0.67, avg_return_pct: 12.1 } }
]

export const mockOHLCV = Array.from({ length: 365 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 365 + i)
    const base = 2400 + Math.sin(i / 20) * 200 + i * 0.8
    return { date: d.toISOString().split('T')[0], open: +(base + Math.random() * 40 - 20).toFixed(2), high: +(base + Math.random() * 60).toFixed(2), low: +(base - Math.random() * 60).toFixed(2), close: +(base + Math.random() * 40 - 20).toFixed(2), volume: Math.floor(3000000 + Math.random() * 2000000) }
})

export const mockPortfolio = {
    session_id: "demo-session",
    total_value: 485000,
    xirr: 14.7,
    funds: [
        { fund_name: "Parag Parikh Flexi Cap", units: 234.5, current_nav: 68.42, current_value: 16046, allocation_pct: 3.3 },
        { fund_name: "Mirae Asset Large Cap", units: 890.2, current_nav: 102.4, current_value: 91157, allocation_pct: 18.8 },
        { fund_name: "HDFC Mid Cap Opportunities", units: 1240.0, current_nav: 98.7, current_value: 122388, allocation_pct: 25.2 },
        { fund_name: "Axis Small Cap Fund", units: 3100.0, current_nav: 42.1, current_value: 130510, allocation_pct: 26.9 },
        { fund_name: "SBI Bluechip Fund", units: 2800.0, current_nav: 44.6, current_value: 124880, allocation_pct: 25.8 }
    ],
    overlap: [
        { fund_a: "Mirae Asset Large Cap", fund_b: "HDFC Mid Cap Opportunities", overlap_pct: 62 },
        { fund_a: "SBI Bluechip Fund", fund_b: "Mirae Asset Large Cap", overlap_pct: 54 }
    ],
    expense_drag: 3240,
    rebalancing_suggestion: "• Consider consolidating Mirae Asset Large Cap and SBI Bluechip as they share 54% holdings overlap.\n• Axis Small Cap allocation at 26.9% is aggressive — consider trimming to 15% given current market valuations.\n• Increase debt allocation to at least 20% for stability — currently 0% debt exposure.\n• HDFC Mid Cap and Mirae overlap at 62% — replace one with a differentiated mid cap like Kotak Emerging Equity."
}
