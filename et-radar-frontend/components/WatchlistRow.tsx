/* eslint-disable */
import React, { useEffect, useState } from 'react'
import { formatINR } from '@/lib/format'

export default function WatchlistRow({ stock, index, onClick }: { stock: any, index: number, onClick: () => void }) {
  const [price, setPrice] = useState(0)
  const [change, setChange] = useState(0)

  useEffect(() => {
    // Generate deterministic pseudo-random price for demo
    const basePrice = 1000 + (stock.symbol.length * 150) + (index * 45)
    const randomChange = (Math.sin(Date.now() / 10000 + index) * 2.5)
    
    setPrice(basePrice)
    setChange(randomChange)
  }, [stock, index])

  const isPositive = change >= 0

  return (
    <div 
      onClick={onClick}
      className="flex items-center justify-between p-4 hover:bg-brand-surface/50 cursor-pointer border-b last:border-0 border-brand-border transition-colors"
    >
      <div>
        <div className="font-bold text-brand-text mb-0.5">{stock.symbol}</div>
        <div className="text-xs text-brand-muted">{stock.name}</div>
      </div>
      <div className="text-right">
        <div className="font-medium text-brand-text mb-0.5">
           {price === 0 ? <span className="text-transparent bg-slate-700 animate-pulse rounded">0000.00</span> : formatINR(price)}
        </div>
        <div className={`text-xs font-medium ${isPositive ? 'text-brand-green' : 'text-brand-red'}`}>
          {isPositive ? '+' : ''}{change.toFixed(2)}%
        </div>
      </div>
    </div>
  )
}
