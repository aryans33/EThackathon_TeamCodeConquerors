/* eslint-disable */
"use client"
import React, { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi } from 'lightweight-charts'
import { useTheme } from "next-themes"

export default function StockChart({ data }: { data: any[] }) {
    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)

    const [timeRange, setTimeRange] = useState('3M')
    const { theme } = useTheme()

    useEffect(() => {
        if (!chartContainerRef.current) return

        const handleResize = () => {
            chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth } as any)
        }

        const isDark = theme === "dark" || theme === "system"

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 400,
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: isDark ? "#94a3b8" : "#475569", // text-slate-400 / 600
            },
            grid: {
                vertLines: { color: isDark ? "#1e2d45" : "#e2e8f0" },
                horzLines: { color: isDark ? "#1e2d45" : "#e2e8f0" },
            },
            crosshair: { mode: 1 },
            rightPriceScale: { borderColor: '#1e2d45' },
            timeScale: { borderColor: '#1e2d45', timeVisible: true }
        } as any)

        chartRef.current = chart

        const candleSeries = chart.addCandlestickSeries({
            upColor: '#00c076', downColor: '#ef4444',
            borderUpColor: '#00c076', borderDownColor: '#ef4444',
            wickUpColor: '#00c076', wickDownColor: '#ef4444'
        } as any)
        candleSeriesRef.current = candleSeries

        const volumeSeries = chart.addHistogramSeries({
            color: '#1e2d45', priceFormat: { type: 'volume' },
            priceScaleId: ''
        } as any)

        chart.priceScale('').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 }
        } as any)

        volumeSeriesRef.current = volumeSeries

        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            chart.remove()
        }
    }, [theme])

    // Handle data updates when range or data changes
    useEffect(() => {
        if (!candleSeriesRef.current || !volumeSeriesRef.current || !data.length) return

        // Sort data oldest to newest
        const sortedData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

        let filteredData = sortedData
        const lastDate = new Date(sortedData[sortedData.length - 1].date)

        // Filter by time range
        if (timeRange !== '1Y') {
            const cutoff = new Date(lastDate)
            if (timeRange === '1W') cutoff.setDate(cutoff.getDate() - 7)
            else if (timeRange === '1M') cutoff.setMonth(cutoff.getMonth() - 1)
            else if (timeRange === '3M') cutoff.setMonth(cutoff.getMonth() - 3)
            else if (timeRange === '6M') cutoff.setMonth(cutoff.getMonth() - 6)

            filteredData = sortedData.filter(d => new Date(d.date) >= cutoff)
        }

        const candleData = filteredData.map(d => ({
            time: d.date,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close
        }))

        const volumeData = filteredData.map(d => ({
            time: d.date,
            value: d.volume,
            color: d.close >= d.open ? '#00c07640' : '#ef444440'
        }))

        candleSeriesRef.current.setData(candleData as any)
        volumeSeriesRef.current.setData(volumeData as any)

        // Fit content
        chartRef.current?.timeScale().fitContent()

    }, [data, timeRange])

    return (
        <div>
            <div ref={chartContainerRef} className="rounded-xl overflow-hidden border border-brand-border" />
            <div className="flex gap-2 mt-4 ml-2">
                {['1W', '1M', '3M', '6M', '1Y'].map(range => (
                    <button
                        key={range}
                        onClick={() => setTimeRange(range)}
                        className={`px-3 py-1 rounded text-sm font-medium transition-colors ${timeRange === range
                                ? 'bg-brand-surface border border-brand-border text-brand-text'
                                : 'text-brand-muted hover:text-brand-text'
                            }`}
                    >
                        {range}
                    </button>
                ))}
            </div>
        </div>
    )
}
