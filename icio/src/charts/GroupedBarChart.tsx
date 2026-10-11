// Two labelled bars per row on a shared scale.
//
// This exists because the obvious chart for "value growth versus volume growth" - a scatter of
// all economies against a 45-degree line - is dominated by a handful of micro-exporters whose
// value grew by thousands of percent off a tiny base. A grouped bar keeps the comparison exact
// and readable for whatever set of economies the reader actually chose, and never needs an
// outlier to be silently dropped from the picture.

import { countryIndex } from '../lib/data'
import { economyName } from '../lib/derived'
import { fmtSignedPct } from '../lib/format'
import type { DashboardData } from '../lib/types'

export interface GroupedBar {
  label: string
  value: number
  colour: string
}

export interface GroupedRow {
  key: string
  label: string
  bars: GroupedBar[]
  /** Right-hand text for the row, already formatted by the caller. */
  readout: string
}

export const GROWTH_VALUE_COLOUR = '#1f4ea1'
export const GROWTH_VOLUME_COLOUR = '#7a5195'

/** Shared, read-only rows for the dashboard page and article embed. */
export function growthRows(data: DashboardData, year: number, economies: string[]): GroupedRow[] {
  return economies
    .map((code) => {
      const i = countryIndex(data, code, year)
      if (i < 0) return null
      const value = data.country.export_growth_nominal_cumulative[i]
      const volume = data.country.export_growth_volume_cumulative[i]
      if (value === null || volume === null) return null
      return {
        code,
        value,
        volume,
        gap: value - volume,
      }
    })
    .filter((entry): entry is { code: string; value: number; volume: number; gap: number } => entry !== null)
    .sort((a, b) => b.gap - a.gap)
    .map((entry) => ({
      key: entry.code,
      label: economyName(data, entry.code),
      bars: [
        { label: 'Growth in value (current prices)', value: entry.value, colour: GROWTH_VALUE_COLOUR },
        { label: 'Growth in volume (chain-linked)', value: entry.volume, colour: GROWTH_VOLUME_COLOUR },
      ],
      readout: `${fmtSignedPct(entry.value, 0)} value · ${fmtSignedPct(entry.volume, 0)} volume`,
    }))
}

export function growthDomain(rows: GroupedRow[]): [number, number] {
  const values = rows.flatMap((row) => row.bars.map((bar) => bar.value))
  if (values.length === 0) return [0, 1]
  const low = Math.min(0, ...values)
  const high = Math.max(0, ...values)
  const pad = (high - low) * 0.06 || 1
  return [low - (low < 0 ? pad : 0), high + (high > 0 ? pad : 0)]
}

interface Props {
  rows: GroupedRow[]
  /** Shared scale. Callers pass the domain so every figure on a page agrees on it. */
  domain: [number, number]
  formatValue: (value: number) => string
}

export function GroupedBarChart({ rows, domain, formatValue }: Props) {
  const [min, max] = domain
  const span = max - min || 1

  const toPercent = (value: number) => ((value - min) / span) * 100

  return (
    <div className="grouped-chart">
      {rows.map((row) => (
        <div className="grouped-row" key={row.key}>
          <div className="grouped-label">{row.label}</div>
          <div className="grouped-track">
            <span
              className="grouped-zero"
              aria-hidden="true"
              style={{ left: `${toPercent(0)}%` }}
            />
            {row.bars.map((bar) => {
              const start = toPercent(Math.min(bar.value, 0))
              const width = Math.abs(toPercent(bar.value) - toPercent(0))
              return (
                <div className="grouped-slot" key={bar.label}>
                  <span
                    className="grouped-fill"
                    style={{ left: `${start}%`, width: `${width}%`, background: bar.colour }}
                    title={`${bar.label}: ${formatValue(bar.value)}`}
                  />
                </div>
              )
            })}
          </div>
          <div className="grouped-readout">{row.readout}</div>
        </div>
      ))}
    </div>
  )
}

export function GroupedBarLegend({ bars }: { bars: GroupedBar[] }) {
  return (
    <div className="legend">
      {bars.map((bar) => (
        <span className="legend-item" key={bar.label}>
          <span className="legend-swatch" style={{ background: bar.colour }} />
          {bar.label}
        </span>
      ))}
    </div>
  )
}
