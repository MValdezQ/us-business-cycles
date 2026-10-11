/**
 * Prices versus volume.
 *
 * The only figure in the set that exists to prevent a misreading: current-price export growth
 * is not the same as selling more goods, and for some economies the two are almost unrelated.
 *
 * The chart is deliberately a grouped bar rather than the usual scatter against a 45-degree
 * line. Cumulative growth can be extreme for small exporters, which squashes other economies into
 * the origin on a single scale. Bars keep the comparison exact for the economies the reader chose.
 */

import { useEffect, useMemo } from 'react'
import { GroupedBarChart, GroupedBarLegend, growthDomain, growthRows } from '../charts/GroupedBarChart'
import { Figure } from '../components/Figure'
import { EconomyPicker, Select } from '../components/controls'
import { parseAllowedList, parseList, parseYear } from '../lib/router'
import { rankEconomies } from '../lib/data'
import { FOCUS_ECONOMIES, economyName } from '../lib/derived'
import { fmtSignedPct, projectedNote } from '../lib/format'
import type { ViewProps } from '../lib/view'

/** Chain-linked volume growth accumulates from the index base year; 2016 is trivially zero. */
const BASE_YEAR = 2016
const MAX_ECONOMIES = 8

export function GrowthView({ data, params, setParams }: ViewProps) {
  const years = data.metadata.coverage.years.filter((year) => year > BASE_YEAR)
  const year = parseYear(params.get('year'), years, 2022)
  const economyOptions = useMemo(
    () =>
      rankEconomies(data, year, (i) => data.country.mfg_exports[i]).map(({ code }) => ({
        value: code,
        label: `${economyName(data, code)} (${code})`,
      })),
    [data, year],
  )
  const availableEconomies = economyOptions.map((entry) => entry.value)
  const resetEconomies = FOCUS_ECONOMIES.filter((code) => availableEconomies.includes(code))
  const focus = parseAllowedList(
    params.get('economies'),
    availableEconomies,
    resetEconomies.length > 0 ? resetEconomies : availableEconomies,
    MAX_ECONOMIES,
  )

  useEffect(() => {
    if (!params.has('economies')) return
    const valid = parseList(params.get('economies'))
      .filter((code) => availableEconomies.includes(code))
      .slice(0, MAX_ECONOMIES)
    const canonical = (valid.length > 0 ? valid : resetEconomies).join(',')
    if (canonical && canonical !== params.get('economies')) setParams({ economies: canonical })
  }, [availableEconomies.join(','), params.toString(), resetEconomies.join(','), setParams])

  const rows = useMemo(() => growthRows(data, year, focus), [data, year, focus.join(',')])
  const legend = [
    { label: 'Growth in value (current prices)', value: 0, colour: '#1f4ea1' },
    { label: 'Growth in volume (chain-linked)', value: 0, colour: '#7a5195' },
  ]

  const domain = useMemo(() => growthDomain(rows), [rows])

  return (
    <>
      <section className="prose">
        <h2>Export growth: value and volume</h2>
        <p>
          Export values reflect both price and volume changes. OECD reports exports at current
          prices and at previous-year prices; the latter are chain-linked to measure export-volume
          growth over time.
        </p>
      </section>

      <Figure
        title={`Manufacturing export growth, ${BASE_YEAR}–${projectedNote(year, data.metadata.coverage.projected_years.includes(year))}`}
        lede="Current-price growth combines price and volume changes; chain-linked volume growth uses previous-year prices."
        controls={
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
              alignItems: 'start',
              gap: '18px',
            }}
          >
            <Select
              label="To year"
              value={year}
              options={years.map((y) => ({
                value: y,
                label: projectedNote(y, data.metadata.coverage.projected_years.includes(y)),
              }))}
              onChange={(value) => setParams({ year: value })}
              hint={
                data.metadata.coverage.projected_years.includes(year) ? 'projected' : undefined
              }
            />
            <EconomyPicker
              label="Economies"
              values={economyOptions}
              selected={focus}
              resetValues={resetEconomies}
              onChange={(values) => setParams({ economies: values.join(',') })}
              max={MAX_ECONOMIES}
              hint={
                data.metadata.coverage.projected_years.includes(year)
                  ? 'volume data are projected'
                  : undefined
              }
            />
          </div>
        }
        note={
          <>
            Cumulative growth is measured from {BASE_YEAR}. The chain-linked volume series is an
            index-based measure, not a literal count of physical units.{' '}
            {data.metadata.coverage.projected_years.includes(year)
              ? `${year} is an OECD projection, not an observation.`
              : ''}
          </>
        }
      >
        <GroupedBarChart
          rows={rows}
          domain={domain}
          formatValue={(value) => fmtSignedPct(value, 0)}
        />
        <GroupedBarLegend bars={legend} />
      </Figure>
    </>
  )
}
