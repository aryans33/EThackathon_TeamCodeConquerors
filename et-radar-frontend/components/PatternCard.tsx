/* eslint-disable */
import React from 'react'

export default function PatternCard({ pattern }: { pattern: any }) {
    const formatName = (name: string) => {
        return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
            .replace('52 Week', '52-Week')
    }

    const isBullish = ['52_week_breakout', 'golden_cross', 'rsi_bounce', 'support_bounce'].includes(pattern.pattern_name)
    const isBearish = ['death_cross'].includes(pattern.pattern_name)

    return (
        <div className="bg-brand-card rounded-xl p-4 border border-brand-border h-full flex flex-col justify-between">
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${isBullish ? 'bg-brand-green' : isBearish ? 'bg-brand-red' : 'bg-slate-400'}`} />
                    <h3 className="text-brand-text font-bold">{formatName(pattern.pattern_name)}</h3>
                </div>
                <p className="text-sm text-brand-muted mb-4">{pattern.explanation}</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-900/50 rounded-lg py-2 px-1 text-center flex flex-col justify-center">
                    <span className="text-[10px] text-slate-500 mb-1 leading-tight">Occurrences</span>
                    <span className="text-xs font-semibold text-brand-text leading-tight">{pattern.backtest.occurrences}x in 3Y</span>
                </div>
                <div className="bg-slate-900/50 rounded-lg py-2 px-1 text-center flex flex-col justify-center">
                    <span className="text-[10px] text-slate-500 mb-1 leading-tight">Success Rate</span>
                    <span className={`text-xs font-semibold leading-tight ${pattern.backtest.success_rate >= 0.6 ? 'text-brand-green' :
                            pattern.backtest.success_rate >= 0.4 ? 'text-brand-amber' : 'text-brand-red'
                        }`}>
                        {(pattern.backtest.success_rate * 100).toFixed(0)}%
                    </span>
                </div>
                <div className="bg-slate-900/50 rounded-lg py-2 px-1 text-center flex flex-col justify-center">
                    <span className="text-[10px] text-slate-500 mb-1 leading-tight">Avg Return</span>
                    <span className={`text-xs font-semibold leading-tight ${pattern.backtest.avg_return_pct >= 0 ? 'text-brand-green' : 'text-brand-red'
                        }`}>
                        {pattern.backtest.avg_return_pct >= 0 ? '+' : ''}{pattern.backtest.avg_return_pct}%
                    </span>
                </div>
            </div>
        </div>
    )
}
