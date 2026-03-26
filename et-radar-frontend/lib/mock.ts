import type { PortfolioResult } from './api'

export const mockPortfolio: PortfolioResult = {
  session_id: 'demo-session',
  total_value: 1250000,
  xirr: 15.4,
  funds: [
    {
      fund_name: 'Parag Parikh Flexi Cap Fund',
      units: 4500.5,
      current_nav: 75.4,
      current_value: 339337.7,
      allocation_pct: 27.1,
    },
    {
      fund_name: 'Nippon India Small Cap Fund',
      units: 2100.2,
      current_nav: 155.2,
      current_value: 325951.04,
      allocation_pct: 26.1,
    },
    {
      fund_name: 'HDFC Mid-Cap Opportunities Fund',
      units: 1800.0,
      current_nav: 121.5,
      current_value: 218700.0,
      allocation_pct: 17.5,
    },
    {
      fund_name: 'SBI Small Cap Fund',
      units: 1500.0,
      current_nav: 135.0,
      current_value: 202500.0,
      allocation_pct: 16.2,
    },
    {
      fund_name: 'ICICI Prudential Technology Fund',
      units: 800.0,
      current_nav: 204.4,
      current_value: 163511.26,
      allocation_pct: 13.1,
    }
  ],
  overlap: [
    {
      fund_a: 'Nippon India Small Cap Fund',
      fund_b: 'SBI Small Cap Fund',
      overlap_pct: 58.4
    }
  ],
  expense_drag: 8500,
  rebalancing_suggestion: '• High overlap between Nippon and SBI Small Cap funds (58.4%). Consider consolidating to reduce expense ratio overhead.\n• Mid and Small Cap allocation is above 60%, indicating an aggressive risk profile. Consider moving 10-15% to a Large Cap Index fund to buffer against volatility.\n• Sectoral exposure (ICICI Tech) is acceptable but watch for valuation stretch in the IT sector.'
}
