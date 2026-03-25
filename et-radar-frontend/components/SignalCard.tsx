/* eslint-disable */
"use client"

import { useRouter } from "next/navigation"
import { timeAgo } from "@/lib/utils"

export default function SignalCard({ signal, onClick }: { signal: any, onClick?: () => void }) {
    const router = useRouter()

    const getActionHintStyle = (hint: string) => {
        switch (hint) {
            case 'buy_watch': return 'bg-brand-green/20 text-brand-green border border-brand-green/40'
            case 'sell_watch': return 'bg-brand-red/20 text-brand-red border border-brand-red/40'
            default: return 'bg-slate-700 text-brand-muted'
        }
    }

    const formatSignalType = (type: string) => {
        return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }

    const getConfidenceColor = (conf: number) => {
        if (conf >= 70) return 'bg-brand-green'
        if (conf >= 40) return 'bg-brand-amber'
        return 'bg-brand-red'
    }

    return (
        <div
            onClick={() => router.push(`/stock/${signal.stock.symbol}`)}
            className="bg-brand-card border border-brand-border rounded-xl p-4 cursor-pointer hover:border-slate-500 transition-colors"
        >
            <div className="flex justify-between items-start">
                <div>
                    <span className="font-bold text-brand-text text-base mr-2">{signal.stock.symbol}</span>
                    <span className="text-sm text-brand-muted">{signal.stock.name}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-md ${getActionHintStyle(signal.action_hint)}`}>
                    {signal.action_hint.replace('_', ' ').toUpperCase()}
                </span>
            </div>

            <div className="text-sm text-brand-text mt-3 mb-4">
                {signal.one_line_summary}
            </div>

            <div className="flex items-end justify-between">
                <div className="flex flex-col gap-2">
                    <span className="bg-slate-700/50 text-brand-muted text-xs px-2 py-0.5 rounded-full w-fit">
                        {formatSignalType(signal.signal_type)}
                    </span>
                    <span className="text-xs text-brand-muted">{timeAgo(signal.created_at)}</span>
                </div>

                <div className="flex flex-col items-end gap-1 w-24">
                    <span className="text-xs text-brand-muted">{signal.confidence}% confidence</span>
                    <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${getConfidenceColor(signal.confidence)}`}
                            style={{ width: `${signal.confidence}%` }}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
