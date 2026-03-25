/* eslint-disable */
"use client"
import React, { useEffect, useState } from "react"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { formatINR } from "@/lib/format"

interface AllocationChartProps {
  portfolio: any
}

const COLORS = ['#00c076', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4']

export default function AllocationChart({ portfolio }: AllocationChartProps) {
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return <div className="h-[350px] w-full animate-pulse bg-brand-card rounded-xl" />

  const data = portfolio.funds.map((f: any) => ({
    name: f.fund_name,
    value: f.allocation_pct,
    currentValue: f.current_value
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-brand-surface border border-brand-border p-3 rounded-lg shadow-xl shadow-black/50 z-50 relative">
          <p className="text-brand-text font-medium text-sm mb-1">{data.name}</p>
          <p className="text-sm font-bold" style={{ color: payload?.[0]?.color || '#fff' }}>{data.value.toFixed(1)}% allocation</p>
          <p className="text-xs text-brand-muted mt-1">{formatINR(data.currentValue)}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-[350px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry: any, index: number) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={48} 
            formatter={(value) => <span className="text-xs text-brand-muted ml-1">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
