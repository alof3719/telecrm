import { useEffect, useRef } from 'react'
import { createChart, ColorType } from 'lightweight-charts'

export default function PriceChart({ data, height = 280 }) {
  const containerRef = useRef()
  const chartRef = useRef()
  const seriesRef = useRef()

  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#64748b' },
      grid: { vertLines: { color: '#f1f5f9' }, horzLines: { color: '#f1f5f9' } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: '#e2e8f0' },
      timeScale: { borderColor: '#e2e8f0', timeVisible: true },
      width: containerRef.current.clientWidth,
      height,
    })

    const series = chart.addAreaSeries({
      lineColor: '#2563eb',
      topColor: 'rgba(37,99,235,0.18)',
      bottomColor: 'rgba(37,99,235,0)',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    })

    if (data && data.length > 0) {
      series.setData(data)
      chart.timeScale().fitContent()
    }

    chartRef.current = chart
    seriesRef.current = series

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove() }
  }, [])

  useEffect(() => {
    if (!seriesRef.current || !data || data.length === 0) return
    seriesRef.current.setData(data)
    chartRef.current?.timeScale().fitContent()
  }, [data])

  return <div ref={containerRef} style={{ width: '100%' }} />
}
