/**
 * Time-series chart with a categorical year axis.
 *
 * Years are categorical, not dates: the series are annual and the axis must not imply
 * anything about within-year timing. Projected years are shaded and their line segments
 * dashed, so an OECD projection can never be read as an observation.
 */

import { useState } from 'react'
import { linearScale, niceTicks, paddedDomain, useElementWidth } from '../lib/chart-utils'
import type { Numeric } from '../lib/types'

export interface TimeSeries {
  key: string
  label: string
  colour: string
  values: Numeric[]
  dashed?: boolean
}

interface Props {
  years: number[]
  series: TimeSeries[]
  mode: 'line' | 'stack'
  format: (value: number) => string
  ariaLabel: string
  height?: number
  /** First year that is an OECD projection; from here on the chart is shaded and a
   *  boundary line is drawn, so a projection is never read as an observation. */
  projectedFrom?: number | null
  yLabel?: string
  /** Force the y axis to start at zero (levels) rather than padding around the data. */
  fromZero?: boolean
  /** Explicit y range. Needed for share charts: every stacked total is exactly 1, and a
   *  degenerately flat series would otherwise be padded out to 0-200%. */
  yDomain?: [number, number] | null
}

const M = { top: 16, right: 18, bottom: 34, left: 70 }

/** Path for one series, lifting the pen at nulls so gaps are gaps, not interpolated lines. */
function lineSegments(values: Numeric[], x: (v: number) => number, y: (v: number) => number): string {
  let path = ''
  let pen = false
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      pen = false
      return
    }
    path += `${pen ? 'L' : 'M'}${x(index).toFixed(2)},${y(value).toFixed(2)}`
    pen = true
  })
  return path
}

export function TimeSeriesChart({
  years,
  series,
  mode,
  format,
  ariaLabel,
  height = 260,
  projectedFrom = null,
  yLabel,
  fromZero = false,
  yDomain = null,
}: Props) {
  const { ref, width } = useElementWidth<HTMLDivElement>()
  const [active, setActive] = useState<number | null>(null)

  const innerWidth = Math.max(width - M.left - M.right, 120)
  const innerHeight = height - M.top - M.bottom

  // Cumulative totals for stacked mode; for lines, just the values.
  const stacked: number[][] = []
  if (mode === 'stack') {
    for (let i = 0; i < years.length; i += 1) {
      let running = 0
      stacked.push(
        series.map((s) => {
          const value = s.values[i]
          const base = running
          if (value !== null && Number.isFinite(value)) running += value
          return base
        }),
      )
    }
  }

  const allValues: number[] = []
  if (mode === 'stack') {
    for (let i = 0; i < years.length; i += 1) {
      let total = 0
      for (const s of series) {
        const value = s.values[i]
        if (value !== null && Number.isFinite(value)) total += value
      }
      allValues.push(total)
    }
  } else {
    for (const s of series) {
      for (const value of s.values) if (value !== null) allValues.push(value)
    }
  }

  const domain =
    yDomain ??
    (fromZero
      ? ([0, Math.max(...allValues, 1e-9) * 1.08] as [number, number])
      : paddedDomain(allValues))
  const y = linearScale(domain, [innerHeight, 0])
  const x = linearScale([0, Math.max(years.length - 1, 1)], [0, innerWidth])
  const yTicks = niceTicks(domain[0], domain[1], 4)

  const projectedIndex = projectedFrom === null ? -1 : years.indexOf(projectedFrom)

  function handleMove(event: React.MouseEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1)
    const index = Math.round(ratio * Math.max(years.length - 1, 1))
    setActive(Math.min(Math.max(index, 0), years.length - 1))
  }

  const readout = active === null ? null : active

  return (
    <div className="chart-shell" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        <g transform={`translate(${M.left},${M.top})`}>
          {projectedIndex >= 0 ? (
            <rect
              x={x(projectedIndex - 0.5)}
              y={0}
              width={Math.max(innerWidth - x(projectedIndex - 0.5), 0)}
              height={innerHeight}
              className="projected-band"
            />
          ) : null}

          {yTicks.map((tick) => (
            <g key={tick}>
              <line x1={0} x2={innerWidth} y1={y(tick)} y2={y(tick)} className="grid-line" />
              <text x={-10} y={y(tick)} className="axis-text" textAnchor="end" dominantBaseline="middle">
                {format(tick)}
              </text>
            </g>
          ))}

          {years.map((year, index) => (
            <text
              key={year}
              x={x(index)}
              y={innerHeight + 18}
              className="axis-text time-axis-year"
              textAnchor="middle"
            >
              {year}
            </text>
          ))}

          {mode === 'stack'
            ? series.map((s, seriesIndex) => {
                const top = years.map((_, i) => {
                  let total = 0
                  for (let k = 0; k <= seriesIndex; k += 1) {
                    const value = series[k]!.values[i]
                    if (value !== null && Number.isFinite(value)) total += value
                  }
                  return total
                })
                const bottom = stacked.map((row) => row[seriesIndex] ?? 0)
                let path = ''
                years.forEach((_, i) => {
                  path += `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(top[i]!).toFixed(2)}`
                })
                for (let i = years.length - 1; i >= 0; i -= 1) {
                  path += `L${x(i).toFixed(2)},${y(bottom[i]!).toFixed(2)}`
                }
                return <path key={s.key} d={`${path}Z`} fill={s.colour} className="area-series" />
              })
            : series.map((s) => (
                <path
                  key={s.key}
                  d={lineSegments(s.values, x, y)}
                  fill="none"
                  stroke={s.colour}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? '5 4' : undefined}
                  className="line-series"
                />
              ))}

          {projectedIndex > 0 ? (
            <line
              x1={x(projectedIndex - 0.5)}
              x2={x(projectedIndex - 0.5)}
              y1={0}
              y2={innerHeight}
              className="projected-line"
            />
          ) : null}

          {projectedIndex > 0 ? (
            <text
              x={Math.min(x(projectedIndex - 0.5) + 5, innerWidth - 4)}
              y={12}
              className="projected-label"
              textAnchor="start"
            >
              OECD projections
            </text>
          ) : null}

          {readout !== null ? (
            <g className="crosshair">
              <line x1={x(readout)} x2={x(readout)} y1={0} y2={innerHeight} />
            </g>
          ) : null}

          {readout !== null
            ? series.map((s, seriesIndex) => {
                const value = s.values[readout]
                if (value === null) return null
                // In stacked mode the marker belongs on top of the stack, not at the raw value.
                let cy = y(value)
                if (mode === 'stack') {
                  let total = 0
                  for (let k = 0; k <= seriesIndex; k += 1) {
                    const part = series[k]!.values[readout]
                    if (part !== null && Number.isFinite(part)) total += part
                  }
                  cy = y(total)
                }
                return <circle key={s.key} cx={x(readout)} cy={cy} r={4} fill={s.colour} />
              })
            : null}

          <rect
            x={0}
            y={0}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setActive(null)}
          />

          {yLabel ? (
            <text transform={`translate(${-M.left + 16},${innerHeight / 2}) rotate(-90)`} className="axis-title" textAnchor="middle">
              {yLabel}
            </text>
          ) : null}
        </g>
      </svg>

      {readout !== null ? (
        <div className="chart-readout">
          <strong>{years[readout]}</strong>
          {series.map((s) => (
            <span key={s.key}>
              <span className="legend-swatch" style={{ background: s.colour }} />
              {s.label}: {format(s.values[readout] ?? 0)}
            </span>
          ))}
        </div>
      ) : null}

      <div className="legend">
        {series.map((s) => (
          <span key={s.key} className="legend-item">
            <span className="legend-swatch" style={{ background: s.colour }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
