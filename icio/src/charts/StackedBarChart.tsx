/**
 * Horizontal stacked bars: the workhorse for every composition figure.
 *
 * Handles both 100%-stacked (share) and absolute (level) modes. A segment whose value is
 * null is skipped rather than treated as zero, so an undefined component leaves a visible
 * gap instead of quietly shrinking the bar.
 */

import { useState } from 'react'
import { linearScale } from '../lib/chart-utils'
import type { Numeric } from '../lib/types'

export interface StackSegment {
  key: string
  label: string
  colour: string
}

export interface StackBar {
  key: string
  label: string
  sublabel?: string
  /** Value per segment key. Missing or null segments are not drawn. */
  values: Record<string, Numeric>
  /** Pre-formatted total shown at the right edge; the caller decides what that total means. */
  totalText?: string
}

interface Props {
  bars: StackBar[]
  segments: StackSegment[]
  mode: 'share' | 'level'
  format: (value: number) => string
  ariaLabel: string
  onBarClick?: (key: string) => void
  activeBar?: string | null
  barHeight?: number
  labelWidth?: number
}

const VALUE_WIDTH = 92

export function StackedBarChart({
  bars,
  segments,
  mode,
  format,
  ariaLabel,
  onBarClick,
  activeBar = null,
  barHeight = 26,
  labelWidth = 150,
}: Props) {
  const [hovered, setHovered] = useState<{ bar: string; segment: string } | null>(null)

  if (bars.length === 0) return <p className="chart-empty">No bars to draw.</p>

  const totals = bars.map((bar) => {
    let total = 0
    for (const segment of segments) {
      const value = bar.values[segment.key]
      if (value !== null && value !== undefined && value > 0) total += value
    }
    return total
  })

  // In share mode every bar spans the full width; in level mode they share one scale.
  const maxTotal = mode === 'share' ? 1 : Math.max(...totals, 1e-9)
  const scale = linearScale([0, maxTotal], [0, 1])

  return (
    <div className="stacked-bars" role="img" aria-label={ariaLabel}>
      {bars.map((bar, index) => {
        const total = totals[index]!
        const value = bar.values
        const segmentsWithValue = segments
          .map((segment) => ({ segment, raw: value[segment.key] ?? null }))
          .filter((entry) => entry.raw !== null && (entry.raw as number) > 0)

        return (
          <div
            key={bar.key}
            className={`stacked-row${activeBar === bar.key ? ' is-active' : ''}${
              onBarClick ? ' is-clickable' : ''
            }`}
            onClick={onBarClick ? () => onBarClick(bar.key) : undefined}
            onKeyDown={
              onBarClick
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onBarClick(bar.key)
                    }
                  }
                : undefined
            }
            role={onBarClick ? 'button' : undefined}
            tabIndex={onBarClick ? 0 : undefined}
          >
            <div className="stacked-label" style={{ width: labelWidth }}>
              <span className="stacked-label-main">{bar.label}</span>
              {bar.sublabel ? <span className="stacked-label-sub">{bar.sublabel}</span> : null}
            </div>

            <div className="stacked-track" style={{ height: barHeight }}>
              {segmentsWithValue.map(({ segment, raw }) => {
                const amount = mode === 'share' ? (raw as number) / (total || 1) : (raw as number)
                const width = (scale(amount) as number) * 100
                const isHovered = hovered?.bar === bar.key && hovered.segment === segment.key
                return (
                  <div
                    key={segment.key}
                    className={`stacked-segment${isHovered ? ' is-hovered' : ''}`}
                    style={{ width: `${width}%`, background: segment.colour }}
                    title={`${bar.label}: ${segment.label}: ${format(raw as number)}`}
                    onMouseEnter={() => setHovered({ bar: bar.key, segment: segment.key })}
                    onMouseLeave={() => setHovered(null)}
                  />
                )
              })}
            </div>

            <div className="stacked-value" style={{ width: VALUE_WIDTH }}>
              {bar.totalText ?? format(total)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Legend for a stacked chart. Kept separate so figures can place it where it reads best. */
export function StackLegend({
  segments,
  note,
}: {
  segments: StackSegment[]
  note?: string
}) {
  return (
    <div className="legend">
      {segments.map((segment) => (
        <span key={segment.key} className="legend-item">
          <span className="legend-swatch" style={{ background: segment.colour }} />
          {segment.label}
        </span>
      ))}
      {note ? <span className="legend-note">{note}</span> : null}
    </div>
  )
}
